import { DIR_NAMES, DX, DY, turnLeft, turnRight } from '../core/dir';
import { biomeForDepth } from '../data/biomes';
import { enemyDef } from '../data/enemies';
import { consumable } from '../data/items';
import { EnemyState, blocksSight, enemyAt } from '../systems/dungeon';
import { itemIcon } from '../systems/items';
import { DungeonRenderer } from '../render/dungeon-renderer';
import { BLESSINGS, World } from '../world/world';
import { drawMap } from './automap';
import { artImg, h } from './dom';

interface Float {
  el: HTMLElement;
  x: number;
  y: number;
  t: number;
}

interface LogLine {
  el: HTMLElement;
  t: number;
}

/** Everything drawn over the 3D view while in the dungeon. */
export class Hud {
  readonly root = h('div', { class: 'layer', attrs: { id: 'hud' } });
  private hpBar = h('i');
  private hpGhost = h('b');
  private hpText = h('span');
  private stBar = h('i');
  private stWrap = h('div', { class: 'bar st' }, this.stBar);
  private recallWrap = h('div', { class: 'bar recall' });
  private recallBar = h('i');
  private compass = h('div', { class: 'compass' });
  private status = h('div', { class: 'status' });
  private minimap = h('canvas', { class: 'minimap', attrs: { width: '150', height: '150' } });
  private quick = h('div', { class: 'quick' });
  private prompt = h('div', { class: 'prompt' });
  private target = h('div', { class: 'target' });
  private log = h('div', { class: 'log' });
  private floatsEl = h('div', { class: 'floats' });
  private floats: Float[] = [];
  private lines: LogLine[] = [];
  private quickKey = '';
  private statusKey = '';
  private time = 0;

  constructor(parent: HTMLElement) {
    this.recallWrap.append(this.recallBar);
    const bars = h(
      'div',
      { class: 'bars' },
      h('div', { class: 'bar-label' }, h('span', { text: 'Health' }), this.hpText),
      h('div', { class: 'bar hp' }, this.hpGhost, this.hpBar),
      h('div', { class: 'bar-label' }, h('span', { text: 'Stamina' })),
      this.stWrap,
      this.recallWrap,
    );
    this.root.append(
      this.floatsEl,
      this.status,
      this.compass,
      this.minimap,
      this.target,
      this.prompt,
      this.log,
      bars,
      this.quick,
      h('div', { class: 'hint-keys', text: 'WASD move · Q/E turn · Space/LMB attack · Shift/RMB block · F interact · I pack · M map · 1–4 use · Esc menu' }),
    );
    parent.append(this.root);
  }

  set visible(v: boolean) {
    this.root.hidden = !v;
  }

  message(text: string, color = '#e8dcc4'): void {
    const el = h('div', { text, style: `color:${color}` });
    this.log.append(el);
    this.lines.push({ el, t: 0 });
    while (this.lines.length > 6) this.lines.shift()!.el.remove();
  }

  clearLog(): void {
    for (const l of this.lines) l.el.remove();
    this.lines = [];
  }

  float(x: number, y: number, text: string, color: string): void {
    const el = h('div', { class: 'float', text, style: `color:${color}` });
    this.floatsEl.append(el);
    this.floats.push({ el, x: x + (Math.random() - 0.5) * 0.3, y: y + (Math.random() - 0.5) * 0.3, t: 0 });
  }

  update(world: World, renderer: DungeonRenderer, dt: number): void {
    this.time += dt;
    const p = world.player;
    const d = world.derived;

    const hpPct = Math.max(0, (p.hp / d.maxHp) * 100);
    this.hpBar.style.width = `${hpPct}%`;
    this.hpGhost.style.width = `${hpPct}%`;
    this.hpText.textContent = `${Math.ceil(p.hp)} / ${d.maxHp}`;
    const stPct = Math.max(0, (p.stamina / d.maxStamina) * 100);
    this.stBar.style.width = `${stPct}%`;
    this.stWrap.classList.toggle('low', stPct < 50);
    this.recallWrap.hidden = world.anim.recall === null;
    if (world.anim.recall !== null) this.recallBar.style.width = `${(1 - world.anim.recall / 5) * 100}%`;

    const f = world.facingName();
    this.compass.innerHTML = `<span class="side">${DIR_NAMES[turnLeft(p.facing)][0]}</span>${f}<span class="side">${DIR_NAMES[turnRight(p.facing)][0]}</span>`;

    const biome = biomeForDepth(world.run.depth);
    const keyNames = world.run.keys.map((k) => world.floor.keys.find((kd) => kd.id === k)?.name ?? 'Key');
    const bless = world.run.blessing ? BLESSINGS[world.run.blessing].name : '';
    const statusKey = `${world.run.depth}|${world.run.gold}|${keyNames.join()}|${bless}|${world.freeSlots}`;
    if (statusKey !== this.statusKey) {
      this.statusKey = statusKey;
      this.status.innerHTML =
        `<div class="depth">Depth ${world.run.depth}</div><div class="biome">${biome.name}</div>` +
        `<div class="coin">${world.run.gold}g carried · pack ${world.run.backpack.items.length}/${world.run.backpack.capacity}</div>` +
        (keyNames.length ? `<div class="keys">${keyNames.join(', ')}</div>` : '') +
        (bless ? `<div class="bless">Blessing of ${bless}</div>` : '');
    }

    drawMap(this.minimap, world.floor, p.x, p.y, p.facing, { cell: 6, cx: p.x, cy: p.y, radius: 12, visibleEnemies: world.visibleEnemies() }, this.time);

    // Quick slots (first four distinct consumables).
    const seen: string[] = [];
    const counts = new Map<string, number>();
    for (const it of world.run.backpack.items) {
      if (it.kind !== 'consumable') continue;
      if (!seen.includes(it.ref)) seen.push(it.ref);
      counts.set(it.ref, (counts.get(it.ref) ?? 0) + it.qty);
    }
    const qk = seen.slice(0, 4).map((r) => `${r}:${counts.get(r)}`).join('|');
    if (qk !== this.quickKey) {
      this.quickKey = qk;
      this.quick.replaceChildren(
        ...[0, 1, 2, 3].map((i) => {
          const ref = seen[i];
          const slot = h('div', { class: `slot${ref ? '' : ' empty'}`, style: '--sz:44px', title: ref ? consumable(ref).name : '' });
          if (ref) {
            const ic = itemIcon({ uid: '', kind: 'consumable', ref, qty: 1 });
            slot.append(artImg(ic.icon, ic.ramp, 36), h('span', { class: 'qty', text: String(counts.get(ref)) }));
          }
          return h('div', { class: 'qs' }, slot, h('span', { class: 'key', text: String(i + 1) }));
        }),
      );
    }

    const hint = world.interactionHint();
    this.prompt.hidden = !hint || world.busy;
    if (hint) this.prompt.innerHTML = `<kbd>F</kbd>${hint}`;

    // Target: the first living enemy straight ahead within 3 tiles.
    let tgt: EnemyState | undefined;
    for (let k = 1; k <= 3; k++) {
      const t = world.frontTile(k);
      tgt = enemyAt(world.floor, t.x, t.y);
      if (tgt || blocksSight(world.floor, t.x, t.y)) break;
    }
    this.target.hidden = !tgt;
    if (tgt) {
      const def = enemyDef(tgt.def);
      const weak = Object.entries(def.resist).filter(([, v]) => (v ?? 1) >= 1.4).map(([k]) => k);
      const res = Object.entries(def.resist).filter(([, v]) => (v ?? 1) <= 0.6).map(([k]) => k);
      this.target.innerHTML =
        `<div>${def.name}</div><div class="bar"><i style="width:${(tgt.hp / tgt.maxHp) * 100}%"></i></div>` +
        `<div class="tag">${weak.length ? `weak: ${weak.join(', ')}` : ''}${weak.length && res.length ? ' · ' : ''}${res.length ? `resists: ${res.join(', ')}` : ''}</div>`;
    }

    // Log fade.
    for (const l of this.lines) {
      l.t += dt;
      l.el.style.opacity = String(l.t < 6 ? 1 : Math.max(0, 1 - (l.t - 6) / 2));
    }
    this.lines = this.lines.filter((l) => {
      if (l.t > 8) {
        l.el.remove();
        return false;
      }
      return true;
    });

    // Floating numbers rise from the enemy.
    for (const fl of this.floats) {
      fl.t += dt;
      const s = renderer.project(fl.x, fl.y, 1.6 + fl.t * 0.9);
      if (!s) {
        fl.el.style.display = 'none';
        continue;
      }
      fl.el.style.display = '';
      fl.el.style.left = `${s.x}px`;
      fl.el.style.top = `${s.y}px`;
      fl.el.style.opacity = String(Math.max(0, 1 - fl.t / 1.1));
    }
    this.floats = this.floats.filter((fl) => {
      if (fl.t > 1.1) {
        fl.el.remove();
        return false;
      }
      return true;
    });
  }
}

export { DX, DY };
