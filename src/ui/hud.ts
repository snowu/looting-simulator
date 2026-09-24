import { flaskMax } from '../systems/healing';
import { DIR_NAMES, DX, DY, turnLeft, turnRight } from '../core/dir';
import { OATHS, findOath } from '../data/oaths';
import { oathProgress, runOaths } from '../systems/oaths';
import { biomeForFloor } from '../data/biomes';
import { THIEF_GLOW, enemyDef, enemyView } from '../data/enemies';
import { ELITES } from '../data/elites';
import { consumable } from '../data/items';
import { findSigil } from '../data/spells';
import { EnemyState, blocksSight, enemyAt } from '../systems/dungeon';
import { itemIcon, itemName } from '../systems/items';
import { DungeonRenderer } from '../render/dungeon-renderer';
import { BLESSINGS, CURSES, World } from '../world/world';
import { drawMap } from './automap';
import { PLAIN_FLASK_RAMP, draught } from '../systems/infusion';
import { artImg, esc, gold, h } from './dom';
import { settingsGearButton } from './settings';
import { clamp } from '../core/math';

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

/**
 * Per-frame DOM writes, made only on change. Assigning the same text or markup
 * still replaces the element's children and dirties layout, every frame.
 */
const lastHtml = new WeakMap<HTMLElement, string>();

function setHtml(el: HTMLElement, html: string): void {
  if (lastHtml.get(el) === html) return;
  lastHtml.set(el, html);
  el.innerHTML = html;
}

function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
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
  private flaskSlot: HTMLElement | null = null;
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
  /** Active pointer-drag reorder of the quick bar, if a slot is being dragged. */
  private quickDrag: { from: number; el: HTMLElement; over: number | null; pointerId: number; startX: number; startY: number; active: boolean } | null = null;
  /** Set when a drag just ended so the trailing click doesn't drink anything. */
  private suppressQuickClick = false;

  constructor(parent: HTMLElement, private actions: { interact: () => void; flask: () => void; quick: (i: number) => void; reorderQuick: (from: number, to: number) => void; settings: () => void }) {
    this.recallWrap.append(this.recallBar);
    // Tappable on touch screens.
    this.prompt.addEventListener('click', () => this.actions.interact());
    const gear = settingsGearButton(() => this.actions.settings(), 'Settings — sound, cloud saves', 22);
    gear.classList.add('hud-gear');
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
      gear,
      this.target,
      this.prompt,
      this.log,
      bars,
      this.quick,
      h('div', { class: 'hint-keys', text: 'W/S step · A/D turn · Q/E strafe · Space/LMB attack · Shift/RMB block & parry · F interact · I pack · M map · 1–4 use · Esc menu · Pad: stick move, A attack, B flask, LT block, Start menu' }),
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

  /**
   * Pointer-based reorder of the quick bar. One path for mouse and touch:
   * press-and-hold still taps to use, but moving past a small threshold turns
   * the gesture into a drag, and dropping on another slot swaps the order.
   */
  private quickDragStart(e: PointerEvent, index: number): void {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    const el = e.currentTarget as HTMLElement;
    this.quickDrag = { from: index, el, over: null, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: false };
    // Keep move/up events flowing to the source slot even after the pointer
    // leaves it, so a drag across slots works on mouse and touch alike.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // No capture (e.g. headless test DOM) — move events still work while over.
    }
  }

  private quickDragMove(e: PointerEvent): void {
    const d = this.quickDrag;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 10) return;
      d.active = true;
      this.quick.classList.add('dragging');
    }
    e.preventDefault();
    const over = this.quickSlotAt(e.clientX, e.clientY);
    if (over !== d.over) {
      d.over = over;
      for (const child of [...this.quick.children]) {
        const el = child as HTMLElement;
        el.classList.toggle('drag-src', Number(el.dataset.qi) === d.from);
        el.classList.toggle('drop-target', over !== null && Number(el.dataset.qi) === over);
      }
    }
  }

  private quickDragEnd(e: PointerEvent): void {
    const d = this.quickDrag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.quickDrag = null;
    this.quick.classList.remove('dragging');
    for (const child of [...this.quick.children]) (child as HTMLElement).classList.remove('drag-src', 'drop-target');
    if (d.active) {
      this.suppressQuickClick = true;
      if (d.over !== null && d.over !== d.from) this.actions.reorderQuick(d.from, d.over);
      // A tap that became a drag must not also arm a tooltip or a click.
      setTimeout(() => {
        this.suppressQuickClick = false;
      }, 0);
    }
  }

  private quickDragCancel(): void {
    this.quickDrag = null;
    this.suppressQuickClick = false;
    this.quick.classList.remove('dragging');
    for (const child of [...this.quick.children]) (child as HTMLElement).classList.remove('drag-src', 'drop-target');
  }

  /** Which visible quick slot sits under this viewport point, if any. */
  private quickSlotAt(x: number, y: number): number | null {
    for (const child of [...this.quick.children]) {
      const el = child as HTMLElement;
      if (el.dataset.qi === undefined) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return Number(el.dataset.qi);
    }
    return null;
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
    const left = def.cooldown > 0 ? clamp(active.cd / def.cooldown, 0, 1) : 0;
    this.sigilDial.hidden = left <= 0;
    if (left > 0) this.sigilDial.style.background = `conic-gradient(#000000a0 ${left * 360}deg, transparent 0deg)`;
    setText(this.sigilText, active.cd > 0 ? `${Math.ceil(active.cd)}s` : '');
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
    setText(this.hpText, `${Math.ceil(p.hp)} / ${d.maxHp}`);
    const stPct = Math.max(0, (p.stamina / d.maxStamina) * 100);
    this.stBar.style.width = `${stPct}%`;
    this.stWrap.classList.toggle('low', stPct < 50);
    this.recallWrap.hidden = world.anim.recall === null;
    if (world.anim.recall !== null) this.recallBar.style.width = `${(1 - world.anim.recall / 5) * 100}%`;

    const f = world.facingName();
    setHtml(this.compass, `<span class="side">${DIR_NAMES[turnLeft(p.facing)][0]}</span>${f}<span class="side">${DIR_NAMES[turnRight(p.facing)][0]}</span>`);

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
    const sealCount = world.run.seals?.length ?? 0;
    // Everything the oath lines read, so their markup is only built on change.
    const stats = world.run.stats;
    const oathKey = runOaths(world.run).map((o) => `${o.id}:${o.status}:${o.marks}:${o.kills}:${o.prayers}`).join()
      + `|${stats.goldFound}|${stats.deepest}|${stats.bossKilled}|${sealCount}`;
    const statusKey = `${world.run.depth}|${biome.id}|${world.run.gold}|${keyNames.join()}|${bless}|${curse}|${world.freeSlots}|${ward}|${snuffed}|${beltKey}|${oathKey}`;
    if (statusKey !== this.statusKey) {
      this.statusKey = statusKey;
      const oathLine = oathStatus(world) + (sealCount ? `<div style="color:#c080ff">Sealed ×${sealCount}</div>` : '');
      const beltLine = !belt
        ? ''
        : belt.calling
          ? `<div class="ward">Calling them back · ${belt.held}/${belt.cap} in hand · ${belt.floor + belt.flying} out · R to stop</div>`
          : belt.floor + belt.flying > 0
            ? `<div class="coin">Belt ${belt.held}/${belt.cap} · ${belt.floor + belt.flying} on the ground · Hold R to call back</div>`
            : `<div class="coin">Belt ${belt.held}/${belt.cap}</div>`;
      this.status.innerHTML =
        `<div class="depth">Depth ${world.run.depth}</div><div class="biome">${biome.name}</div>` +
        `<div class="coin">${gold(world.run.gold)} carried · pack ${world.run.backpack.items.length}/${world.run.backpack.capacity}</div>` +
        beltLine +
        (keyNames.length ? `<div class="keys">${keyNames.join(', ')}</div>` : '') +
        (bless ? `<div class="bless">Blessing of ${bless}</div>` : '') +
        (curse ? `<div class="curse">${curse}</div>` : '') +
        oathLine +
        (ward ? `<div class="ward">Consecrated ground · ${ward}s</div>` : '') +
        (snuffed ? `<div class="ward">Snuffed · ${snuffed}s</div>` : '');
    }

    this.updateSigil(world);

    drawMap(this.minimap, world.floor, p.x, p.y, p.facing, { cell: 6, cx: p.x, cy: p.y, radius: 12, visibleEnemies: world.visibleEnemies() }, this.time);

    // Quick slots: distinct consumables in the player's chosen bar order.
    const seen = world.quickRefs();
    const counts = new Map<string, number>();
    for (const it of world.run.backpack.items) {
      if (it.kind !== 'consumable') continue;
      counts.set(it.ref, (counts.get(it.ref) ?? 0) + it.qty);
    }
    const flask = world.run.flask;
    const infusion = world.state.flask?.infusion ?? '';
    const qk = `${infusion}|${flask.charges}/${world.state.flask?.shards ?? 0}:${flask.dregs.toFixed(1)}|${seen.slice(0, 3).map((r) => `${r}:${counts.get(r)}`).join('|')}`;
    if (qk !== this.quickKey) {
      this.quickKey = qk;
      this.quickDrag = null;
      this.quick.classList.remove('dragging');
      const max = flaskMax(world.state.flask?.shards ?? 0, world.diff.flaskBonus);
      const dregs = Math.min(100, flask.dregs / Math.max(1, world.derived.maxHp * 0.5) * 100);
      // Charges left as one number, like every other stack on the bar: "3/3"
      // in the pixel font ran into the bottle and the dregs bar and read as
      // noise. The maximum lives in the tooltip.
      const d = draught(infusion);
      const title = `Flask: ${flask.charges} of ${max} charges${d ? `\n${d.name}: ${d.effect}` : ''}`;
      const flaskSlot = h('div', { class: `slot flask-slot${flask.charges ? '' : ' dry'}`, style: `--sz:44px;--dregs:${dregs}%;--fxc:${d?.color ?? '#63d5bd'}`, title });
      flaskSlot.addEventListener('click', () => this.actions.flask());
      flaskSlot.append(artImg('ic_potion', d?.ramp ?? PLAIN_FLASK_RAMP, 36), h('span', { class: 'qty', text: String(flask.charges) }));
      this.flaskSlot = flaskSlot;
      this.quick.replaceChildren(
        h('div', { class: 'qs' }, flaskSlot, h('span', { class: 'key', text: '1' })),
        ...[0, 1, 2].map((i) => {
          const ref = seen[i];
          const slot = h('div', { class: `slot${ref ? '' : ' empty'}`, style: '--sz:44px', title: ref ? `${consumable(ref).name} — drag to reorder` : '' });
          if (ref) {
            slot.addEventListener('click', () => {
              if (this.suppressQuickClick) {
                this.suppressQuickClick = false;
                return;
              }
              this.actions.quick(i);
            });
            // Native image drag would fight the pointer reorder with a ghost
            // image; the pointer handlers below are the drag on every device.
            slot.addEventListener('dragstart', (e) => e.preventDefault());
            slot.addEventListener('pointerdown', (e) => this.quickDragStart(e, i));
            slot.addEventListener('pointermove', (e) => this.quickDragMove(e));
            slot.addEventListener('pointerup', (e) => this.quickDragEnd(e));
            slot.addEventListener('pointercancel', () => this.quickDragCancel());
            const ic = itemIcon({ uid: '', kind: 'consumable', ref, qty: 1 });
            const img = artImg(ic.icon, ic.ramp, 36);
            img.draggable = false;
            slot.append(img, h('span', { class: 'qty', text: String(counts.get(ref)) }));
          }
          return h('div', { class: 'qs', attrs: { 'data-qi': String(i) } }, slot, h('span', { class: 'key', text: String(i + 2) }));
        }),
      );
    }

    // The draught waiting to be spent drains across the top of the flask.
    const fx = world.anim.draught;
    this.flaskSlot?.style.setProperty('--fx', fx ? String(Math.max(0, fx.t / fx.total)) : '0');

    const hint = world.interactionHint();
    this.prompt.hidden = !hint || world.busy;
    if (hint) setHtml(this.prompt, `<kbd>F</kbd>${hint}`);

    // Target: the first living enemy straight ahead within 3 tiles.
    let tgt: EnemyState | undefined;
    for (let k = 1; k <= 3; k++) {
      const t = world.frontTile(k);
      tgt = enemyAt(world.floor, t.x, t.y);
      if (tgt || blocksSight(world.floor, t.x, t.y)) break;
    }
    this.target.hidden = !tgt;
    if (tgt) {
      const def = enemyView(enemyDef(tgt.def), tgt.hp, tgt.maxHp, { elite: tgt.elite, marked: tgt.marked, calm: tgt.calm });
      const weak = Object.entries(def.resist).filter(([, v]) => (v ?? 1) >= 1.4).map(([k]) => k);
      const res = Object.entries(def.resist).filter(([, v]) => (v ?? 1) <= 0.6).map(([k]) => k);
      // An elite's name carries its trait in the trait's colour, and hovering
      // it says what the trait does.
      const elite = tgt.marked ? { color: OATHS.hunter.color, rule: 'Your quarry: the Hunter oath asks for its death.' } : tgt.elite ? ELITES[tgt.elite] : null;
      const name = elite
        ? `<div style="color:${elite.color}" title="${esc(elite.rule)}">${esc(def.name)}</div>`
        : `<div>${esc(def.name)}</div>`;
      const carrying = tgt.stolen?.length ? `<div class="tag" style="color:${THIEF_GLOW}">carrying your ${esc(tgt.stolen.map(itemName).join(', '))}</div>` : '';
      setHtml(this.target,
        `${name}<div class="bar"><i style="width:${(tgt.hp / tgt.maxHp) * 100}%"></i></div>` +
        `<div class="tag">${weak.length ? `weak: ${weak.join(', ')}` : ''}${weak.length && res.length ? ' · ' : ''}${res.length ? `resists: ${res.join(', ')}` : ''}</div>` + carrying);
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

/** The oath line in the status block: what was sworn and how it stands. Strings come from code only. */
function oathStatus(world: World): string {
  const run = world.run;
  return runOaths(run).map((oath) => {
    const def = findOath(oath.id);
    if (!def) return '';
    let progress = oath.status === 'broken' ? 'broken' : oathProgress(run, oath).left || 'done, bring it home';
    if (oath.id === 'silence' && oath.status !== 'broken') progress += ', quietly';
    return `<div style="color:${def.color}">Oath: ${def.name} · ${progress}</div>`;
  }).join('');
}
