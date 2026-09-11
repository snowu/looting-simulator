import { EquipSlot, Item, STAT_LABELS } from '../types';
import { itemBase } from '../data/items';
import { enemyDef } from '../data/enemies';
import { biomeForDepth } from '../data/biomes';
import { itemName } from '../systems/items';
import { equipFrom, unequipTo, defaultSlot } from '../systems/equip';
import { World } from '../world/world';
import { drawMap } from './automap';
import { btn, h, hideTooltip, isTouchMode, itemSlot, itemTooltip, rarityColor } from './dom';
import { audio } from '../audio/sfx';

export type OverlayMode = 'inventory' | 'loot' | 'map' | 'help';

const DOLL: { slot: EquipSlot; area: string; label: string }[] = [
  { slot: 'ring1', area: '1 / 1', label: 'Ring' },
  { slot: 'head', area: '1 / 2', label: 'Head' },
  { slot: 'amulet', area: '1 / 3', label: 'Neck' },
  { slot: 'weapon', area: '2 / 1', label: 'Weapon' },
  { slot: 'body', area: '2 / 2', label: 'Body' },
  { slot: 'offhand', area: '2 / 3', label: 'Shield' },
  { slot: 'ring2', area: '3 / 1', label: 'Ring' },
  { slot: 'hands', area: '3 / 2', label: 'Hands' },
];

export function paperDoll(eq: Record<EquipSlot, Item | null>, onClick: (slot: EquipSlot) => void): HTMLElement {
  const doll = h('div', { class: 'paperdoll' });
  for (const d of DOLL) {
    const it = eq[d.slot];
    const el = itemSlot(it, { size: 56, placeholder: d.label, onclick: () => it && onClick(d.slot), tip: it ? () => itemTooltip(it, { hint: 'Click to unequip' }) : undefined });
    el.style.gridArea = d.area;
    doll.append(el);
  }
  return doll;
}

export function statSheet(world: { derived: World['derived'] }): HTMLElement {
  const d = world.derived;
  const s = d.stats;
  const rows: [string, string][] = [
    ['Attack', `${d.attack} ${d.damageType}`],
    ['Defense', String(s.defense)],
    ['Max health', String(d.maxHp)],
    ['Max stamina', String(d.maxStamina)],
    ['Block', `${Math.round(d.block * 100)}%`],
    ['Crit', `${s.luck}%`],
    ['Speed', `${s.speed}%`],
    ['Loot find', `${d.find}%`],
  ];
  for (const k of ['leech', 'fire', 'frost', 'shadow', 'holy'] as const) if (s[k]) rows.push([STAT_LABELS[k], String(s[k])]);
  return h('div', { class: 'statsheet' }, ...rows.map(([k, v]) => h('div', {}, h('span', { class: 'dim', text: k }), h('b', { text: v }))));
}

/** Inventory, loot, map and help panels during a run. All of them pause the world. */
export class DungeonOverlays {
  readonly root = h('div', { class: 'layer overlays' });
  mode: OverlayMode | null = null;
  private pickupId = '';
  private world: World | null = null;

  constructor(parent: HTMLElement, private notify: (text: string, color?: string) => void) {
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.mode !== null;
  }

  open(mode: OverlayMode, world: World, pickupId = ''): void {
    this.mode = mode;
    this.world = world;
    this.pickupId = pickupId;
    world.held.clear();
    this.render();
  }

  close(): void {
    this.mode = null;
    hideTooltip();
    this.root.replaceChildren();
  }

  toggle(mode: OverlayMode, world: World): void {
    if (this.mode === mode) this.close();
    else this.open(mode, world);
  }

  /** Returns true if the key was consumed. */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.mode || !this.world) return false;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      this.close();
      return true;
    }
    if (this.mode === 'loot' && (k === ' ' || k === 'e' || k === 'f' || k === 'enter')) {
      this.world.take(this.pickupId);
      this.afterLoot();
      return true;
    }
    if ((this.mode === 'inventory' && (k === 'i' || k === 'tab')) || (this.mode === 'map' && k === 'm') || (this.mode === 'help' && k === 'h')) {
      this.close();
      return true;
    }
    return true;
  }

  private afterLoot(): void {
    const w = this.world!;
    const pk = w.floor.pickups.find((p) => p.id === this.pickupId);
    if (!pk || !pk.items.length) this.close();
    else this.render();
  }

  render(): void {
    const w = this.world;
    if (!w || !this.mode) return;
    hideTooltip();
    let body: HTMLElement;
    switch (this.mode) {
      case 'inventory':
        body = this.inventory(w);
        break;
      case 'loot':
        body = this.loot(w);
        break;
      case 'map':
        body = this.map(w);
        break;
      case 'help':
        body = this.help();
        break;
    }
    const wrap = h('div', { class: 'modal-wrap' }, body);
    const openedAt = performance.now();
    wrap.addEventListener('pointerdown', (e) => {
      // A tap that opened the panel can arrive late as a mouse event; ignore it.
      if (e.target === wrap && performance.now() - openedAt > 350) this.close();
    });
    wrap.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.replaceChildren(wrap);
  }

  private inventory(w: World): HTMLElement {
    const eq = w.state.equipment;
    const pack = w.run.backpack;
    const doll = paperDoll(eq, (slot) => {
      const err = unequipTo(eq, slot, pack);
      if (err) this.notify(err, '#ff9070');
      else audio.play('ui');
      w.refreshDerived();
      this.render();
    });
    const grid = h('div', { class: 'grid-slots' });
    for (let i = 0; i < pack.capacity; i++) {
      const it = pack.items[i] ?? null;
      if (!it) {
        grid.append(itemSlot(null, { size: 44 }));
        continue;
      }
      const slot = defaultSlot(it, eq);
      const cmp = slot ? eq[slot] : null;
      const hint =
        it.kind === 'equipment' ? 'Click: equip · Right-click: drop' : it.kind === 'consumable' ? 'Click: use · Right-click: drop' : 'Right-click: drop';
      const el = itemSlot(it, {
        size: 44,
        tip: () => itemTooltip(it, { compare: cmp, hint }),
        onclick: () => {
          if (it.kind === 'equipment') {
            const err = equipFrom(eq, pack, it.uid);
            if (err) this.notify(err, '#ff9070');
            else audio.play('ui');
            w.refreshDerived();
          } else if (it.kind === 'consumable') {
            w.use(it.uid);
          }
          this.render();
        },
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        w.drop(it.uid);
        this.notify(`Dropped ${itemName(it)}.`, '#aaa');
        this.render();
      });
      grid.append(el);
    }
    return h(
      'div',
      { class: 'modal frame' },
      btn('Close [I]', () => this.close(), 'small close'),
      h('h2', { text: 'Pack & Gear' }),
      h(
        'div',
        { class: 'inv' },
        h('div', {}, doll, statSheet(w)),
        h(
          'div',
          {},
          h('div', { class: 'row' }, h('h3', { text: `Backpack ${pack.items.length}/${pack.capacity}` }), h('span', { class: 'gold-t right', text: `${w.run.gold}g carried` })),
          grid,
          h('p', { class: 'dim small', style: 'margin-top:8px', text: 'Everything in the pack is lost if you die. Get it home.' }),
        ),
      ),
    );
  }

  private loot(w: World): HTMLElement {
    const pk = w.floor.pickups.find((p) => p.id === this.pickupId);
    const list = h('div', { class: 'loot-list' });
    for (const it of pk?.items ?? []) {
      const cmpSlot = defaultSlot(it, w.state.equipment);
      const cmp = cmpSlot ? w.state.equipment[cmpSlot] : null;
      list.append(
        h(
          'div',
          { class: 'loot-row' },
          itemSlot(it, { size: 40, tip: () => itemTooltip(it, { compare: cmp }) }),
          h('span', { class: 'name', text: itemName(it) + (it.qty > 1 ? ` ×${it.qty}` : ''), style: `color:${rarityColor(it)}` }),
          btn('Take', () => {
            w.take(this.pickupId, it.uid);
            this.afterLoot();
          }, 'small', !w.canTake(it)),
        ),
      );
    }
    const full = w.freeSlots <= 0;
    return h(
      'div',
      { class: 'modal frame loot' },
      h('h2', { text: 'Loot' }),
      list,
      full ? h('p', { class: 'red-t small', text: 'Your pack is full — drop something from the pack [I] to make room.' }) : null,
      h(
        'div',
        { class: 'row' },
        btn('Take all [Space]', () => {
          w.take(this.pickupId);
          this.afterLoot();
        }, 'primary'),
        btn('Leave [Esc]', () => this.close()),
        h('span', { class: 'dim small right', text: `Pack ${w.run.backpack.items.length}/${w.run.backpack.capacity}` }),
      ),
    );
  }

  private map(w: World): HTMLElement {
    const f = w.floor;
    const cell = Math.max(6, Math.min(16, Math.floor(Math.min(window.innerWidth * 0.8, window.innerHeight * 0.72) / f.width)));
    const c = h('canvas', { class: 'bigmap', attrs: { width: String(f.width * cell), height: String(f.height * cell) } });
    drawMap(c, f, w.player.x, w.player.y, w.player.facing, { cell, visibleEnemies: w.visibleEnemies() }, 0);
    const kills = f.enemies.filter((e) => e.ai === 'dead').length;
    const bosses = f.enemies.filter((e) => e.ai !== 'dead' && enemyDef(e.def).behavior === 'boss').length;
    return h(
      'div',
      { class: 'modal frame' },
      btn('Close [M]', () => this.close(), 'small close'),
      h('h2', { text: `Depth ${w.run.depth} — ${biomeForDepth(w.run.depth).name}` }),
      c,
      h(
        'p',
        { class: 'dim small center', style: 'margin-top:6px' },
        h('span', { style: 'color:#e0d070', text: '■ stairs up ' }),
        h('span', { style: 'color:#50d0d0', text: '■ stairs down ' }),
        h('span', { style: 'color:#b07840', text: '■ door ' }),
        h('span', { style: 'color:#e0b040', text: '■ locked / key ' }),
        h('span', { style: 'color:#ffd24a', text: '■ loot ' }),
        h('span', { style: 'color:#c08850', text: '■ chest ' }),
        ` · ${kills} slain here${bosses ? ' · the King waits' : ''}`,
      ),
    );
  }

  private help(): HTMLElement {
    const touchRows: [string, string][] = [
      ['Drag ↑ ↓', 'Walk forward / back — hold to keep walking'],
      ['Drag ← →', 'Turn — hold to keep turning'],
      ['Tap view', 'Swing — or Loot / Open / Pray / Descend when facing something'],
      ['Main button', 'Same as a tap; hold to keep swinging'],
      ['Shield', 'Hold to block (shields block far more)'],
      ['Quick slots', 'Tap to drink / read'],
      ['Pack · Map', 'Gear, backpack and the automap'],
    ];
    const rows: [string, string][] = isTouchMode() ? touchRows : [
      ['W / S', 'Step forward / back'],
      ['A / D  ← →', 'Turn'],
      ['Q / E', 'Strafe left / right'],
      ['Space / LMB', 'Swing — hits harder with stamina above half'],
      ['Shift / RMB', 'Hold to block (shields block far more)'],
      ['F', 'Open, search, loot, pray, push marked walls'],
      ['1 – 4', 'Drink / read your first four consumables'],
      ['I / Tab', 'Pack & gear'],
      ['M', 'Map'],
      ['Esc', 'Close / pause'],
    ];
    return h(
      'div',
      { class: 'modal frame' },
      btn('Resume [Esc]', () => this.close(), 'small close'),
      h('h2', { text: 'Paused' }),
      h('div', { class: 'help' }, ...rows.map(([k, v]) => h('div', {}, h('kbd', { text: k }), v))),
      h(
        'p',
        { class: 'dim', style: 'margin-top:10px;max-width:640px' },
        'Enemies telegraph: they lean in and flash red before striking. Step out of the tile they are aiming at, or raise your guard. ' +
          'Chalk X marks on a wall mean something is hidden behind it. The way out is the stairs you came down — or a Scroll of Recall.',
      ),
    );
  }
}

export function slotLabel(item: Item): string {
  return item.kind === 'equipment' ? itemBase(item.ref).slot : item.kind;
}
