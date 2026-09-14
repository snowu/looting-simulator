import { EquipSlot, Item, STAT_LABELS } from '../types';
import { consumable, itemBase } from '../data/items';
import { enemyDef } from '../data/enemies';
import { biomeForFloor } from '../data/biomes';
import { isTwoHanded, itemName } from '../systems/items';
import { equipFrom, unequipTo, defaultSlot } from '../systems/equip';
import { sortContainer } from '../state/inventory';
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
  { slot: 'thrown', area: '3 / 3', label: 'Belt' },
];

export function paperDoll(eq: Record<EquipSlot, Item | null>, onClick: (slot: EquipSlot) => void): HTMLElement {
  const doll = h('div', { class: 'paperdoll' });
  const offhandDisabled = isTwoHanded(eq.weapon);
  for (const d of DOLL) {
    const it = eq[d.slot];
    const el = itemSlot(it, { size: 56, placeholder: d.label, onclick: () => it && onClick(d.slot), tip: it ? () => itemTooltip(it, { hint: 'Click to unequip' }) : undefined });
    if (d.slot === 'offhand' && offhandDisabled) {
      el.classList.add('stowed');
      el.append(h('span', { class: 'stowed-label', text: '2H' }));
      el.title = 'Disabled while a two-handed weapon is equipped';
    }
    el.style.gridArea = d.area;
    doll.append(el);
  }
  return doll;
}

export function statSheet(world: { derived: World['derived'] } & Partial<Pick<World, 'thrownCounts'>>): HTMLElement {
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
  if (d.twoHanded) rows.push(['Guard', '2H block; parry unchanged']);
  if (d.swing.cleave) rows.push(['Cleave', `${Math.round(d.swing.cleave * 100)}% around the target`]);
  if (d.thrown) {
    // In a run the belt is three numbers — in hand, on the floor, flying home —
    // and the stock alone would repeat the old lie of promising what never
    // arrives. Out of a run (town doll) there is no stock, so capacity stands in.
    const c = world.thrownCounts?.();
    rows.push(['Throw', c
      ? `${d.thrownAttack} ${d.thrownDamageType} · ${d.thrown.range} tiles · belt ${c.held}/${c.cap}${c.floor + c.flying > 0 ? ` · ${c.floor + c.flying} out` : ''}`
      : `${d.thrownAttack} ${d.thrownDamageType} · ${d.thrown.range} tiles · ${d.thrownCapacity} carried`]);
  }
  for (const k of ['leech', 'fire', 'frost', 'shadow', 'holy'] as const) if (s[k]) rows.push([STAT_LABELS[k], String(s[k])]);
  return h('div', { class: 'statsheet' }, ...rows.map(([k, v]) => h('div', {}, h('span', { class: 'dim', text: k }), h('b', { text: v }))));
}

/** Inventory, loot, map and help panels during a run. All of them pause the world. */
export class DungeonOverlays {
  readonly root = h('div', { class: 'layer overlays' });
  mode: OverlayMode | null = null;
  private pickupId = '';
  private world: World | null = null;
  /** Uid of the Scroll of Identify currently being read, awaiting a target choice. */
  private identifyScrollUid: string | null = null;

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
    this.identifyScrollUid = null;
    world.held.clear();
    this.render();
  }

  close(): void {
    this.mode = null;
    this.identifyScrollUid = null;
    hideTooltip();
    this.root.replaceChildren();
  }

  toggle(mode: OverlayMode, world: World): void {
    // The loot panel already shows the backpack beside the pile, so asking
    // for the pack from there keeps the pile open instead of swapping away.
    if (mode === 'inventory' && this.mode === 'loot') return;
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
    // The loot panel shows the backpack beside the pile, so [I] leaves it
    // open — the pack is already here to swap with.
    if (this.mode === 'loot' && (k === 'i' || k === 'tab')) return true;
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

  /** Shared click behaviour for pack items: identify, equip or drink. */
  private activatePackItem(w: World, it: Item): void {
    const eq = w.state.equipment;
    const pack = w.run.backpack;
    const readingScroll = this.identifyScrollUid !== null;
    const unid = it.kind === 'equipment' && it.identified === false;
    if (readingScroll) {
      if (unid) {
        w.use(this.identifyScrollUid!, it.uid);
        this.identifyScrollUid = null;
        w.refreshDerived();
      } else {
        this.notify('That doesn\'t need identifying — pick an unidentified item.', '#888');
      }
      this.render();
      return;
    }
    if (it.kind === 'equipment') {
      if (unid) {
        this.notify('Unidentified — read a Scroll of Identify first.', '#ff9070');
      } else {
        const err = equipFrom(eq, pack, it.uid);
        if (err) this.notify(err, '#ff9070');
        else audio.play('ui');
        w.refreshDerived();
      }
    } else if (it.kind === 'consumable') {
      if (consumable(it.ref).effect.type === 'identify' && w.unidentifiedItems().length > 1) {
        // More than one candidate: let the player choose instead of
        // spending the scroll on whatever happens to be first.
        this.identifyScrollUid = it.uid;
      } else {
        w.use(it.uid);
      }
    }
    this.render();
  }

  private packHint(w: World, it: Item, dropWhere: string): string {
    const readingScroll = this.identifyScrollUid !== null;
    const unid = it.kind === 'equipment' && it.identified === false;
    if (readingScroll && unid) return 'Click: identify this item';
    if (it.kind === 'equipment') return unid ? 'Unidentified — read a Scroll of Identify first' : `Click: equip · Right-click: drop ${dropWhere}`;
    if (it.kind === 'consumable') {
      return consumable(it.ref).effect.type === 'identify' ? 'Click: choose what to identify' : `Click: use · Right-click: drop ${dropWhere}`;
    }
    return `Right-click: drop ${dropWhere}`;
  }

  /** Slot grid for the pack. `dropPickupId` drops onto that pile, else to the ground. */
  private packGrid(w: World, dropPickupId?: string): HTMLElement {
    const eq = w.state.equipment;
    const pack = w.run.backpack;
    const grid = h('div', { class: 'grid-slots' });
    for (let i = 0; i < pack.capacity; i++) {
      const it = pack.items[i] ?? null;
      if (!it) {
        grid.append(itemSlot(null, { size: 44 }));
        continue;
      }
      const slot = defaultSlot(it, eq);
      const cmp = slot ? eq[slot] : null;
      const dropWhere = dropPickupId ? 'onto the pile' : 'on the ground';
      const el = itemSlot(it, {
        size: 44,
        tip: () => itemTooltip(it, { compare: cmp, hint: this.packHint(w, it, dropWhere) }),
        onclick: () => this.activatePackItem(w, it),
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        w.drop(it.uid, dropPickupId);
        this.notify(dropPickupId ? `Put ${itemName(it)} back on the pile.` : `Dropped ${itemName(it)}.`, '#aaa');
        this.render();
      });
      grid.append(el);
    }
    return grid;
  }

  private sortPack(w: World): void {
    sortContainer(w.run.backpack);
    audio.play('ui');
    this.render();
  }

  private identifyBanner(): HTMLElement | null {
    if (this.identifyScrollUid === null) return null;
    return h('div', {},
      h('p', { class: 'gold-t small', text: 'Reading a Scroll of Identify — click which item to reveal.', style: 'margin:0 0 6px' }),
      btn('Cancel identify', () => { this.identifyScrollUid = null; this.render(); }, 'small'),
    );
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
    return h(
      'div',
      { class: 'modal frame' },
      btn('Close [I]', () => this.close(), 'small close'),
      h('h2', { text: 'Pack & Gear' }),
      this.identifyBanner(),
      h(
        'div',
        { class: 'inv' },
        h('div', {}, doll, statSheet(w)),
        h(
          'div',
          {},
          h('div', { class: 'row' }, h('h3', { text: `Backpack ${pack.items.length}/${pack.capacity}` }), h('span', { class: 'gold-t right', text: `${w.run.gold}g carried` })),
          h('div', { class: 'row', style: 'margin:2px 0 6px' }, btn('Sort pack', () => this.sortPack(w), 'small', pack.items.length < 2)),
          this.packGrid(w),
          h('p', { class: 'dim small', style: 'margin-top:8px', text: 'Everything in the pack is lost if you die. Get it home.' }),
        ),
      ),
    );
  }

  private loot(w: World): HTMLElement {
    const pk = w.floor.pickups.find((p) => p.id === this.pickupId);
    const pack = w.run.backpack;
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
    // The pack beside the pile, so a full bag is a swap instead of a trip
    // back: right-click (long-press on touch) puts a slot onto the pile, and
    // the Drop button below does the same one tap at a time.
    const packRows = h('div', { class: 'loot-list pack-swap' });
    for (const it of pack.items) {
      const slot = defaultSlot(it, w.state.equipment);
      const cmp = slot ? w.state.equipment[slot] : null;
      packRows.append(
        h(
          'div',
          { class: 'loot-row' },
          itemSlot(it, {
            size: 40,
            tip: () => itemTooltip(it, { compare: cmp, hint: this.packHint(w, it, 'onto the pile') }),
            onclick: () => this.activatePackItem(w, it),
          }),
          h('span', { class: 'name', text: itemName(it) + (it.qty > 1 ? ` ×${it.qty}` : ''), style: `color:${rarityColor(it)}` }),
          btn('Drop', () => {
            w.drop(it.uid, this.pickupId);
            this.notify(`Put ${itemName(it)} back on the pile.`, '#aaa');
            this.render();
          }, 'small'),
        ),
      );
    }
    if (!pack.items.length) packRows.append(h('p', { class: 'dim small', text: 'Pack is empty.' }));
    const full = w.freeSlots <= 0;
    return h(
      'div',
      { class: 'modal frame loot loot-wide' },
      h('h2', { text: 'Loot' }),
      this.identifyBanner(),
      h(
        'div',
        { class: 'loot-cols' },
        h(
          'div',
          {},
          h('h3', { text: `Pile (${pk?.items.length ?? 0})` }),
          pk?.items.length ? list : h('p', { class: 'dim small', text: 'Nothing left here.' }),
        ),
        h(
          'div',
          {},
          h('div', { class: 'row' }, h('h3', { text: `Backpack ${pack.items.length}/${pack.capacity}` }), h('span', { class: 'row right' }, btn('Sort', () => this.sortPack(w), 'small', pack.items.length < 2))),
          packRows,
        ),
      ),
      full ? h('p', { class: 'red-t small', text: 'Your pack is full — drop something onto the pile below to make room, then take what you want.' }) : null,
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
      h('h2', { text: `Depth ${w.run.depth} — ${biomeForFloor(w.floor).name}` }),
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
      ['Shield', 'Hold to block — raise it as they strike to parry'],
      ['Throw button', 'Hurl one shaft from your belt'],
      ['R button', 'Call shafts back — tap to start or stop, they fly to your raised hand'],
      ['Sigil button', 'Cast your attuned sigil when ready'],
      ['Quick slots', 'Tap to drink / read'],
      ['Pack · Map', 'Gear, backpack and the automap'],
    ];
    const rows: [string, string][] = isTouchMode() ? touchRows : [
      ['W / S', 'Step forward / back'],
      ['A / D  ← →', 'Turn'],
      ['Q / E', 'Strafe left / right'],
      ['Space / LMB', 'Swing — hits harder with stamina above half'],
      ['Shift / RMB', 'Hold to block — raise it as they strike to parry'],
      ['F', 'Open, search, loot, pray, push marked walls'],
      ['T', 'Throw one shaft from your belt'],
      ['R', 'Call shafts back — tap to start or stop, they fly to your raised hand'],
      ['G / C', 'Cast your attuned sigil'],
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
          'Raise it just as the blow lands and you parry instead: no damage at all, melee attackers reel and take double, and arrows and bolts fly back the way they came. ' +
          'Your shield flashes while the window is open. Holding the guard up does not parry — you have to meet the swing. ' +
          'Two-handed weapons leave the offhand disabled and block only 20%, but parry exactly like any other weapon. Their blow cleaves for a quarter into every tile touching the thing they hit, including the one behind it. Thrown shafts ride on their own belt slot, so you carry them alongside a weapon and a shield, and you hurl one with T rather than with the attack button. They land where they stop and stay on that floor: walk over one to collect it, or tap R to call them back — one leaves the floor every three quarters of a second and flies to your raised left hand, which is the animation for it. The call costs no stamina and stopping it never loses a shaft already in the air; it still lands. Swinging, casting, a blow, or tapping R again stops the call. Each shaft that lands back in your hand wears the belt by one. ' +
          'Sigils are inscribed and attuned at the Sigils bench in the forge, and cast with G or C. Casting spends stamina and a hit interrupts it without starting the cooldown. ' +
          'Chalk X marks on a wall mean something is hidden behind it, and loose flagstones mean a trap — watch the floor ahead of you. ' +
          'The way out is the stairs you came down. A Scroll of Recall instead opens a portal you can step back through, so you can sell and restock mid-delve.',
      ),
    );
  }
}

export function slotLabel(item: Item): string {
  return item.kind === 'equipment' ? itemBase(item.ref).slot : item.kind;
}
