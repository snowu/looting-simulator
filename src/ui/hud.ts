import { DIR_NAMES, DX, DY, turnLeft, turnRight } from '../core/dir';
import { biomeForFloor } from '../data/biomes';
import { enemyDef } from '../data/enemies';
import { consumable } from '../data/items';
import { findSigil } from '../data/spells';
import { EnemyState, blocksSight, enemyAt } from '../systems/dungeon';
import { itemIcon } from '../systems/items';
import { DungeonRenderer } from '../render/dungeon-renderer';
import { BLESSINGS, CURSES, World } from '../world/world';
import { drawMap } from './automap';
import { artImg, esc, h } from './dom';

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
  /**
   * The sigil readout. It had none at all: a cast spent stamina and the only
   * way to know whether the spell was ready, running or still cooling was to
   * press the key and see. The dial is the whole thing — a wedge of darkness
   * that sweeps off the icon as the cooldown burns down, so "how long" is
   * something you glance at rather than count.
   */
  private sigilWrap = h('div', { class: 'sigil' });
  private sigilIcon = h('div', { class: 'sigil-icon' });
  private sigilDial = h('div', { class: 'sigil-dial' });
  private sigilText = h('span', { class: 'sigil-cd' });
  private sigilCastWrap = h('div', { class: 'sigil-cast' });
  private sigilCastBar = h('i');
  private sigilKey = '';
  /**
   * Standing in a Threshold ward. The floor sprite for it can never be seen —
   * at eye height your own tile is below the view — so the thing you are
   * standing in gets a glow at the bottom of the screen instead, which is the
   * only place a tile under your feet can be shown from.
   */
  private wardGlow = h('div', { class: 'ward-glow' });
  private time = 0;

  constructor(parent: HTMLElement, private actions: { interact: () => void; quick: (i: number) => void }) {
    this.recallWrap.append(this.recallBar);
    // Tappable on touch screens.
    this.prompt.addEventListener('click', () => this.actions.interact());
    const bars = h(
      'div',
      { class: 'bars' },
      h('div', { class: 'bar-label' }, h('span', { text: 'Health' }), this.hpText),
      h('div', { class: 'bar hp' }, this.hpGhost, this.hpBar),
      h('div', { class: 'bar-label' }, h('span', { text: 'Stamina' })),
      this.stWrap,
      this.recallWrap,
    );
    this.sigilCastWrap.append(this.sigilCastBar);
    this.sigilWrap.append(this.sigilIcon, this.sigilDial, this.sigilText, this.sigilCastWrap);
    this.sigilWrap.hidden = true;
    this.wardGlow.hidden = true;
    this.root.append(
      this.wardGlow,
      this.floatsEl,
      this.sigilWrap,
      this.status,
      this.compass,
      this.minimap,
      this.target,
      this.prompt,
      this.log,
      bars,
      this.quick,
      h('div', { class: 'hint-keys', text: 'W/S step · A/D turn · Q/E strafe · Space/LMB attack · Shift/RMB block & parry · F interact · I pack · M map · 1–4 use · Esc menu' }),
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

  /** Icon, cooldown dial and cast bar for the attuned sigil. */
  private updateSigil(world: World): void {
    const active = world.run.sigil;
    const def = active ? findSigil(active.id) : undefined;
    this.sigilWrap.hidden = !def;
    if (!def || !active) return;
    if (this.sigilKey !== def.id) {
      this.sigilKey = def.id;
      this.sigilIcon.replaceChildren(artImg(def.icon, undefined, 44));
      this.sigilWrap.title = `${def.name} — ${def.description}`;
    }
    const casting = world.anim.cast?.id === def.id ? world.anim.cast : null;
    const ready = active.cd <= 0 && !casting;
    this.sigilWrap.classList.toggle('ready', ready);
    this.sigilWrap.classList.toggle('casting', !!casting);
    // Wedge of darkness over the icon, unwinding anticlockwise as it recovers.
    const left = def.cooldown > 0 ? Math.max(0, Math.min(1, active.cd / def.cooldown)) : 0;
    this.sigilDial.hidden = left <= 0;
    if (left > 0) this.sigilDial.style.background = `conic-gradient(#000000a0 ${left * 360}deg, transparent 0deg)`;
    this.sigilText.textContent = active.cd > 0 ? `${Math.ceil(active.cd)}s` : '';
    this.sigilCastWrap.hidden = !casting;
    if (casting) this.sigilCastBar.style.width = `${(1 - casting.t / Math.max(0.01, def.cast)) * 100}%`;
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

    const biome = biomeForFloor(world.floor);
    // Key names are generated, but they live in the save file, so they are the
    // one string here that a hand-edited save controls. Everything else in this
    // panel comes from the data tables in code.
    const keyNames = world.run.keys.map((k) => esc(world.floor.keys.find((kd) => kd.id === k)?.name ?? 'Key'));
    const bless = world.run.blessing ? BLESSINGS[world.run.blessing]?.name ?? '' : '';
    const curse = world.run.curse ? CURSES[world.run.curse]?.name ?? '' : '';
    // Threshold consecrates the tile you are standing on, which in first person
    // is the one tile you cannot see. Without a line here the only way to know
    // whether you were still on it was to be parrying and find out.
    const ward = world.anim.ward ? Math.ceil(world.anim.ward.t) : 0;
    this.wardGlow.hidden = !ward;
    this.wardGlow.classList.toggle('fading', ward > 0 && ward <= 2);
    const snuffed = world.anim.snuffT > 0 ? Math.ceil(world.anim.snuffT) : 0;
    // The belt is three numbers, not one: in hand, on the floor, and flying
    // home. The call used to show only the stock, which is how it could promise
    // shafts it never delivered — the counter moved when one left the floor
    // and the stock only when one arrived, and a stop between the two kept the
    // difference. All three are read off the same helper the world uses.
    const belt = world.thrownCounts();
    const beltKey = belt ? `${belt.held}|${belt.floor}|${belt.flying}|${belt.calling}` : '';
    const statusKey = `${world.run.depth}|${biome.id}|${world.run.gold}|${keyNames.join()}|${bless}|${curse}|${world.freeSlots}|${ward}|${snuffed}|${beltKey}`;
    if (statusKey !== this.statusKey) {
      this.statusKey = statusKey;
      const beltLine = !belt
        ? ''
        : belt.calling
          ? `<div class="ward">Calling them back · ${belt.held}/${belt.cap} in hand · ${belt.floor + belt.flying} out · R to stop</div>`
          : belt.floor + belt.flying > 0
            ? `<div class="coin">Belt ${belt.held}/${belt.cap} · ${belt.floor + belt.flying} on the ground · R to call back</div>`
            : `<div class="coin">Belt ${belt.held}/${belt.cap}</div>`;
      this.status.innerHTML =
        `<div class="depth">Depth ${world.run.depth}</div><div class="biome">${biome.name}</div>` +
        `<div class="coin">${world.run.gold}g carried · pack ${world.run.backpack.items.length}/${world.run.backpack.capacity}</div>` +
        beltLine +
        (keyNames.length ? `<div class="keys">${keyNames.join(', ')}</div>` : '') +
        (bless ? `<div class="bless">Blessing of ${bless}</div>` : '') +
        (curse ? `<div class="curse">${curse}</div>` : '') +
        (ward ? `<div class="ward">Consecrated ground · ${ward}s</div>` : '') +
        (snuffed ? `<div class="ward">Snuffed · ${snuffed}s</div>` : '');
    }

    this.updateSigil(world);

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
          if (ref) slot.addEventListener('click', () => this.actions.quick(i));
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
