import { GameState } from '../state/game-state';
import { MaterialCategory, RARITY_COLORS } from '../types';
import { MATERIALS, material } from '../data/materials';
import { CONSUMABLES, itemBase } from '../data/items';
import { RECIPES, recipe } from '../data/recipes';
import { META_UPGRADES, backpackCapacity, haggleLevel, metaLevel, nextCost } from '../systems/meta';
import {
  buyCommodity,
  commodityBuyPrice,
  commoditySellPrice,
  eventMultiplier,
  itemBuyPrice,
  itemSellPrice,
  marketEvent,
  quoteSell,
  sellCommodity,
  trendPercent,
} from '../systems/market';
import { MAX_ACCEPTED, contractTitle, gearCandidates, isComplete } from '../systems/contracts';
import { buildCrafted, craft, materialsForSlot, selectionError } from '../systems/crafting';
import { identify, identifyCost, itemName, itemStats, makeConsumable, salvage } from '../systems/items';
import { addItem, countOf, removeItem, removeOf, sortContainer } from '../state/inventory';
import { derivePlayer } from '../systems/player';
import { defaultSlot, equipFrom, unequipTo } from '../systems/equip';
import { createRng, randomSeed } from '../core/rng';
import { artImg, btn, gold, h, hideTooltip, itemSlot, itemTooltip, rarityColor, sparkline, statLines } from './dom';
import { paperDoll, statSheet } from './dungeon-ui';
import { audio } from '../audio/sfx';

export type TownTab = 'market' | 'forge' | 'guild' | 'stash' | 'warden';

export interface TownCtx {
  state: () => GameState;
  save: () => void;
  descend: () => void;
  newGame: () => void;
  toast: (text: string, color?: string) => void;
}

const CATS: { id: MaterialCategory; name: string }[] = [
  { id: 'valuable', name: 'Valuables' },
  { id: 'metal', name: 'Metals' },
  { id: 'gem', name: 'Gems' },
  { id: 'hide', name: 'Hides' },
  { id: 'cloth', name: 'Cloth' },
  { id: 'wood', name: 'Wood' },
  { id: 'bone', name: 'Bone' },
];

export class Town {
  readonly root = h('div', { class: 'town' });
  tab: TownTab = 'market';
  private forgeRecipe = 'r_short_sword';
  private forgeMats: (string | null)[] = [];
  private stashFilter: 'all' | 'gear' | 'materials' | 'other' = 'all';
  private confirmReset = false;
  private scrollMemo = 0;

  constructor(parent: HTMLElement, private ctx: TownCtx) {
    parent.append(this.root);
  }

  set visible(v: boolean) {
    this.root.hidden = !v;
  }

  private get s(): GameState {
    return this.ctx.state();
  }

  private get hag(): number {
    return haggleLevel(this.s.meta);
  }

  private commit(sfx: Parameters<typeof audio.play>[0] = 'ui'): void {
    audio.play(sfx);
    this.ctx.save();
    this.render();
  }

  render(): void {
    hideTooltip();
    this.scrollMemo = this.root.scrollTop;
    const s = this.s;
    const running = !!s.run && s.run.outcome === 'active';
    const readyContracts = s.contracts.filter((c) => c.accepted && isComplete(c, s.stash)).length;
    const tabs: [TownTab, string, number][] = [
      ['market', 'Market', 0],
      ['forge', 'Forge', s.stash.items.filter((i) => i.kind === 'blueprint').length],
      ['guild', 'Guild', readyContracts],
      ['stash', 'Stash & Gear', 0],
      ['warden', 'Warden', META_UPGRADES.some((u) => (nextCost(u, s.meta) ?? Infinity) <= s.renown) ? 1 : 0],
    ];
    const head = h(
      'div',
      { class: 'town-head' },
      h('div', {}, h('h1', { text: 'Hollowmere' }), h('div', { class: 'dim', text: `Day ${s.market.day} · the market town above the old crypt` })),
      h(
        'div',
        { class: 'purse grow' },
        h('span', { class: 'gold-t', text: `◆ ${gold(s.gold)}` }),
        h('span', { class: 'violet-t', text: `✦ ${s.renown} renown` }),
        h('span', { class: 'dim', text: `pack ${backpackCapacity(s.meta)} slots` }),
      ),
      btn(running ? 'Return to the Depths' : 'Descend', () => this.ctx.descend(), 'primary big'),
    );
    const tabBar = h(
      'div',
      { class: 'tabs' },
      ...tabs.map(([id, label, badge]) =>
        h('button', { class: `tab${this.tab === id ? ' on' : ''}`, onclick: () => { this.tab = id; audio.play('ui'); this.render(); } }, label, badge ? h('span', { class: 'badge', text: String(badge) }) : null),
      ),
    );
    let body: HTMLElement;
    switch (this.tab) {
      case 'market':
        body = this.market();
        break;
      case 'forge':
        body = this.forge();
        break;
      case 'guild':
        body = this.guild();
        break;
      case 'stash':
        body = this.stash();
        break;
      case 'warden':
        body = this.warden();
        break;
    }
    this.root.replaceChildren(head, this.news(), tabBar, body);
    this.root.scrollTop = this.scrollMemo;
  }

  private news(): HTMLElement {
    const m = this.s.market;
    const lines: HTMLElement[] = [];
    for (const ev of m.events) {
      const def = marketEvent(ev.id);
      lines.push(h('div', { class: 'event', text: `◆ ${def.name} (${ev.daysLeft} day${ev.daysLeft === 1 ? '' : 's'} left) — ${def.description}` }));
    }
    for (const n of m.news) if (!m.events.some((ev) => n.startsWith(marketEvent(ev.id).name))) lines.push(h('div', { class: 'dim', text: n }));
    if (m.upcoming && metaLevel(this.s.meta, 'insider') >= 2) {
      const def = marketEvent(m.upcoming);
      lines.push(h('div', { class: 'rumour', text: `Rumour: ${def.name} tomorrow. ${def.description}` }));
    }
    const last = this.s.lastRun;
    if (last) {
      lines.push(
        h('div', {
          class: last.outcome === 'extracted' ? 'green-t' : 'red-t',
          text: last.outcome === 'extracted'
            ? `Last delve: made it home from depth ${last.depth} with ${last.items.length} stacks and ${gold(last.gold)}.`
            : `Last delve: slain at depth ${last.depth}${last.killedBy ? ` by ${last.killedBy}` : ''}. Lost ${last.lost.length} stacks.`,
        }),
      );
    }
    return h('div', { class: 'news frame' }, ...lines);
  }

  // ---------------------------------------------------------------------------
  // Market
  // ---------------------------------------------------------------------------

  private market(): HTMLElement {
    const s = this.s;
    const m = s.market;
    const insider = metaLevel(s.meta, 'insider');
    const rows: HTMLElement[] = [];
    for (const cat of CATS) {
      rows.push(h('tr', { class: 'cat-row' }, h('td', { attrs: { colspan: '8' }, text: cat.name })));
      for (const mat of MATERIALS.filter((x) => x.category === cat.id)) {
        const c = m.commodities[mat.id];
        const owned = countOf(s.stash, 'material', mat.id);
        const sell = commoditySellPrice(m, mat.id, this.hag);
        const buy = commodityBuyPrice(m, mat.id, this.hag);
        const trend = trendPercent(c.history);
        const ev = eventMultiplier(m, { materialId: mat.id });
        const trendEl = h('span', { class: trend > 2 ? 'up' : trend < -2 ? 'down' : 'dim', text: trend > 2 ? '▲' : trend < -2 ? '▼' : '–' });
        const trendCell = h('td', { class: 'col-trend' }, h('div', { class: 'row', style: 'gap:4px' }, trendEl, insider ? h('span', { class: 'small', text: `${trend > 0 ? '+' : ''}${trend}%` }) : null, insider ? sparkline(c.history, 70, 18, ev > 1 ? '#e8b84a' : ev < 1 ? '#d0443a' : '#8a7f6e') : null));
        const icon = itemSlot({ uid: mat.id, kind: 'material', ref: mat.id, qty: 1 }, { size: 32, tip: () => itemTooltip({ uid: '', kind: 'material', ref: mat.id, qty: Math.max(1, owned) }, { price: { label: 'Sells for', value: sell } }) });
        rows.push(
          h(
            'tr',
            {},
            h('td', {}, icon),
            h('td', {}, h('span', { style: `color:${RARITY_COLORS[mat.rarity]}`, text: mat.name }), ev !== 1 ? h('span', { class: ev > 1 ? 'gold-t small' : 'red-t small', text: ev > 1 ? ' ★' : ' ▾' }) : null),
            h('td', { class: 'num gold-t', text: `${sell}` }),
            h('td', { class: 'num dim', text: `${buy}` }),
            trendCell,
            h('td', { class: 'num', text: owned ? String(owned) : '·' }),
            h('td', { class: 'num dim small col-stock', text: c.stock ? `${c.stock} in stock` : 'sold out' }),
            h(
              'td',
              {},
              h(
                'div',
                { class: 'row', style: 'gap:3px' },
                btn('Sell', () => this.sellMat(mat.id, 1), 'small', owned < 1),
                btn('All', () => this.sellMat(mat.id, owned), 'small', owned < 2),
                btn('Buy', () => this.buyMat(mat.id, 1), 'small', c.stock < 1 || s.gold < buy),
              ),
            ),
          ),
        );
        const allBtn = rows[rows.length - 1].querySelectorAll('button')[1] as HTMLButtonElement;
        if (owned > 1) allBtn.title = `Sell ${owned} for ${gold(quoteSell(m, mat.id, owned, this.hag))} (price slips as you dump)`;
      }
    }
    const table = h(
      'div',
      { class: 'table-wrap' },
      h(
        'table',
        { class: 'market' },
        h('thead', {}, h('tr', {}, h('th', {}), h('th', { text: 'Commodity' }), h('th', { class: 'num', text: 'Sell' }), h('th', { class: 'num', text: 'Buy' }), h('th', { class: 'col-trend', text: insider ? 'Trend (30d)' : 'Trend' }), h('th', { class: 'num', text: 'Owned' }), h('th', {}), h('th', {}))),
        h('tbody', {}, ...rows),
      ),
    );

    // Right side: sell gear, merchant wares, supplies.
    const sellables = s.stash.items.filter((i) => i.kind !== 'material');
    const sellList = h('div', { class: 'grid-slots' });
    for (const it of sellables) {
      const price = itemSellPrice(m, it, this.hag) * it.qty;
      const unid = it.kind === 'equipment' && it.identified === false;
      const idCost = unid ? identifyCost(it, metaLevel(s.meta, 'appraiser')) : 0;
      const el = itemSlot(it, {
        size: 44,
        tip: () => itemTooltip(it, { price: { label: 'Sells for', value: price }, hint: unid ? `Click: sell · Right-click: identify for ${idCost}g` : 'Click: sell' }),
        onclick: () => {
          removeItem(s.stash, it.uid);
          s.gold += price;
          s.lifetime.goldEarned += price;
          this.ctx.toast(`Sold ${itemName(it)} for ${gold(price)}.`, '#e8b84a');
          this.commit('sell');
        },
      });
      if (unid) {
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (s.gold < idCost) return this.ctx.toast('Not enough gold to identify that.', '#ff9070');
          s.gold -= idCost;
          identify(it);
          this.ctx.toast(`The appraiser squints: ${itemName(it)}.`, '#c8b8ff');
          this.commit('magic');
        });
      }
      sellList.append(el);
    }
    const unids = sellables.filter((i) => i.kind === 'equipment' && i.identified === false);
    const idAllCost = unids.reduce((sum, i) => sum + identifyCost(i, metaLevel(s.meta, 'appraiser')), 0);

    const wares = h('div', { class: 'wares' });
    for (const it of m.wares) {
      const price = itemBuyPrice(m, it, this.hag);
      const slot = defaultSlot(it, s.equipment);
      wares.append(
        h(
          'div',
          { class: 'ware' },
          itemSlot(it, { size: 48, tip: () => itemTooltip(it, { compare: slot ? s.equipment[slot] : null, price: { label: 'Costs', value: price } }) }),
          h('span', { class: 'gold-t', text: gold(price) }),
          btn('Buy', () => {
            s.gold -= price;
            m.wares = m.wares.filter((w) => w !== it);
            addItem(s.stash, it);
            this.ctx.toast(`Bought ${itemName(it)}.`, '#e8b84a');
            this.commit('gold');
          }, 'small', s.gold < price),
        ),
      );
    }
    const supplies = h('div', { class: 'wares' });
    for (const c of CONSUMABLES) {
      const price = Math.ceil(c.value * (1.2 - 0.04 * this.hag));
      const it = makeConsumable(c.id);
      supplies.append(
        h(
          'div',
          { class: 'ware' },
          itemSlot(it, { size: 48, tip: () => itemTooltip(it, { price: { label: 'Costs', value: price } }) }),
          h('span', { class: 'gold-t', text: gold(price) }),
          btn('Buy', () => {
            s.gold -= price;
            addItem(s.stash, makeConsumable(c.id));
            this.commit('gold');
          }, 'small', s.gold < price),
        ),
      );
    }

    return h(
      'div',
      { class: 'panes' },
      h('div', { class: 'pane frame' }, h('h3', { text: 'Commodities' }), h('p', { class: 'dim small', text: 'Prices drift back toward fair value each day. Dumping a stack pushes the price down; it recovers over a few days. Events move whole categories.' }), table),
      h(
        'div',
        { class: 'col' },
        h(
          'div',
          { class: 'pane frame' },
          h('div', { class: 'row' }, h('h3', { text: 'Sell your gear' }), unids.length ? btn(`Identify all (${gold(idAllCost)})`, () => {
            if (s.gold < idAllCost) return this.ctx.toast('Not enough gold.', '#ff9070');
            s.gold -= idAllCost;
            unids.forEach(identify);
            this.commit('magic');
          }, 'small right', s.gold < idAllCost) : null),
          sellables.length ? sellList : h('p', { class: 'dim', text: 'Nothing but raw materials in the stash.' }),
          h('p', { class: 'dim small', style: 'margin-top:4px', text: `Unidentified gear sells for less than half. Weapons ×${m.sentiment.weapon.toFixed(2)} · armour ×${m.sentiment.armor.toFixed(2)} · jewellery ×${m.sentiment.jewelry.toFixed(2)} today.` }),
        ),
        h('div', { class: 'pane frame' }, h('h3', { text: 'Merchant\'s wares' }), m.wares.length ? wares : h('p', { class: 'dim', text: 'Sold out until tomorrow.' })),
        h('div', { class: 'pane frame' }, h('h3', { text: 'Supplies' }), supplies),
      ),
    );
  }

  private sellMat(id: string, qty: number): void {
    const s = this.s;
    if (qty <= 0 || !removeOf(s.stash, 'material', id, qty)) return;
    const g = sellCommodity(s.market, id, qty, this.hag);
    s.gold += g;
    s.lifetime.goldEarned += g;
    this.ctx.toast(`Sold ${qty} × ${material(id).name} for ${gold(g)}.`, '#e8b84a');
    this.commit('sell');
  }

  private buyMat(id: string, qty: number): void {
    const s = this.s;
    const res = buyCommodity(s.market, id, qty, this.hag, s.gold);
    if (!res) return;
    s.gold -= res.cost;
    addItem(s.stash, { uid: `m${Date.now()}`, kind: 'material', ref: id, qty: res.qty });
    this.commit('gold');
  }

  // ---------------------------------------------------------------------------
  // Forge
  // ---------------------------------------------------------------------------

  private defaultMats(recipeId: string): (string | null)[] {
    const r = recipe(recipeId);
    const s = this.s;
    const used = new Map<string, number>();
    return r.slots.map((slot) => {
      if (slot.optional) return null;
      const opts = materialsForSlot(slot, s.stash)
        .filter((o) => o.owned - (used.get(o.def.id) ?? 0) >= slot.qty)
        .sort((a, b) => a.def.tier - b.def.tier);
      const pick = opts[0]?.def.id ?? null;
      if (pick) used.set(pick, (used.get(pick) ?? 0) + slot.qty);
      return pick;
    });
  }

  private forge(): HTMLElement {
    const s = this.s;
    const smith = metaLevel(s.meta, 'master_smith');
    if (this.forgeMats.length !== recipe(this.forgeRecipe).slots.length) this.forgeMats = this.defaultMats(this.forgeRecipe);

    const list = h('div', { class: 'recipes' });
    for (const r of RECIPES) {
      const known = s.knownRecipes.includes(r.id);
      const base = itemBase(r.baseId);
      list.append(
        h(
          'div',
          {
            class: `recipe${this.forgeRecipe === r.id ? ' on' : ''}${known ? '' : ' locked'}`,
            onclick: () => {
              if (!known) return this.ctx.toast('Find or buy this blueprint first.', '#9ab0d8');
              this.forgeRecipe = r.id;
              this.forgeMats = this.defaultMats(r.id);
              this.commit();
            },
          },
          artImg(base.icon, undefined, 28),
          h('span', { class: 'grow', text: base.name }),
          h('span', { class: 'dim small', text: known ? r.slots.filter((x) => !x.optional).map((x) => `${x.qty} ${x.categories[0]}`).join(' + ') : 'blueprint needed' }),
        ),
      );
    }

    // Blueprints waiting to be learned.
    const bps = s.stash.items.filter((i) => i.kind === 'blueprint');
    const learn = bps.length
      ? h(
          'div',
          { class: 'pane frame' },
          h('h3', { text: 'Blueprints' }),
          h(
            'div',
            { class: 'wares' },
            ...bps.map((bp) => {
              const known = s.knownRecipes.includes(bp.ref);
              return h(
                'div',
                { class: 'ware' },
                itemSlot(bp, { size: 44 }),
                btn(known ? 'Known' : 'Learn', () => {
                  removeItem(s.stash, bp.uid);
                  s.knownRecipes.push(bp.ref);
                  this.forgeRecipe = bp.ref;
                  this.forgeMats = this.defaultMats(bp.ref);
                  this.ctx.toast(`Learned to forge the ${itemBase(recipe(bp.ref).baseId).name}.`, '#9ab0d8');
                  this.commit('magic');
                }, 'small', known),
              );
            }),
          ),
          h('p', { class: 'dim small', text: 'Known blueprints can still be sold at the market.' }),
        )
      : null;

    // Selected recipe.
    const r = recipe(this.forgeRecipe);
    const slotRows = r.slots.map((slot, i) => {
      const picker = h('div', { class: 'mat-pick' });
      if (slot.optional) {
        picker.append(itemSlot(null, { size: 38, placeholder: 'none', onclick: () => { this.forgeMats[i] = null; this.commit(); }, selected: this.forgeMats[i] === null }));
      }
      for (const { def, owned } of materialsForSlot(slot, s.stash)) {
        if (owned === 0 && def.tier > 2) continue;
        const el = itemSlot({ uid: def.id, kind: 'material', ref: def.id, qty: owned }, {
          size: 38,
          instant: true,
          selected: this.forgeMats[i] === def.id,
          tip: () => itemTooltip({ uid: '', kind: 'material', ref: def.id, qty: Math.max(1, owned) }, { hint: owned >= slot.qty ? 'Click to use' : `Need ${slot.qty}` }),
          onclick: () => {
            this.forgeMats[i] = def.id;
            this.commit();
          },
        });
        if (owned < slot.qty) el.classList.add('cant');
        picker.append(el);
      }
      return h('div', { class: 'forge-slot' }, h('span', { class: 'lbl', text: `${slot.label} ×${slot.qty}${slot.optional ? '?' : ''}` }), picker);
    });

    const sel = { recipeId: r.id, materials: this.forgeMats };
    const err = selectionError(sel, s.stash);
    let preview: HTMLElement | null = null;
    if (this.forgeMats[0]) {
      const item = buildCrafted(sel, smith);
      const cmpSlot = defaultSlot(item, s.equipment);
      const cmp = cmpSlot ? s.equipment[cmpSlot] : null;
      preview = h(
        'div',
        { class: 'preview' },
        itemSlot(item, { size: 56, tip: () => itemTooltip(item, { compare: cmp }) }),
        h('div', { html: `<div style="color:${rarityColor(item)};font-size:22px">${itemName(item)}</div><div class="dim">${item.rarity} · quality ~${Math.round((item.quality ?? 1) * 100)}%</div>${statLines(itemStats(item), cmp ? itemStats(cmp) : undefined).join('')}` }),
      );
    }

    // Salvage.
    const gear = s.stash.items.filter((i) => i.kind === 'equipment');
    const salvageGrid = h('div', { class: 'grid-slots' });
    for (const it of gear) {
      salvageGrid.append(
        itemSlot(it, {
          size: 44,
          tip: () => itemTooltip(it, { hint: 'Click to salvage into materials' }),
          onclick: () => {
            removeItem(s.stash, it.uid);
            const mats = salvage(it, createRng(randomSeed()));
            for (const mt of mats) addItem(s.stash, mt);
            this.ctx.toast(`Salvaged into ${mats.map((mt) => `${mt.qty} ${material(mt.ref).name}`).join(', ') || 'dust'}.`, '#c8c0b0');
            this.commit('break');
          },
        }),
      );
    }

    return h(
      'div',
      { class: 'panes' },
      h(
        'div',
        { class: 'pane frame' },
        h('h3', { text: `Forge: ${itemBase(r.baseId).name}` }),
        h('p', { class: 'dim small', text: 'The primary material decides tier, colour and name. A gem catalyst adds its property and lifts rarity. Master Smith improves quality.' }),
        ...slotRows,
        preview,
        h('div', { class: 'row' }, btn('Forge it', () => {
          const item = craft(sel, s.stash, createRng(randomSeed()), smith);
          if (!item) return;
          addItem(s.stash, item);
          this.forgeMats = this.defaultMats(r.id);
          this.ctx.toast(`Forged: ${itemName(item)}.`, rarityColor(item));
          this.commit('craft');
        }, 'primary', !!err), err ? h('span', { class: 'dim small', text: err }) : null),
        gear.length ? h('div', {}, h('h3', { style: 'margin-top:10px', text: 'Salvage' }), salvageGrid) : null,
      ),
      h('div', { class: 'col' }, h('div', { class: 'pane frame' }, h('h3', { text: 'Recipes' }), list), learn),
    );
  }

  // ---------------------------------------------------------------------------
  // Guild
  // ---------------------------------------------------------------------------

  private guild(): HTMLElement {
    const s = this.s;
    const accepted = s.contracts.filter((c) => c.accepted).length;
    const cards = s.contracts.map((c) => {
      const done = c.accepted && isComplete(c, s.stash);
      let progress = '';
      if (c.kind === 'deliver') progress = `You have ${countOf(s.stash, 'material', c.materialId!)}/${c.qty}`;
      if (c.kind === 'gear') progress = `${gearCandidates(c, s.stash).length} suitable in stash`;
      if (c.kind === 'slay') progress = `${c.progress}/${c.count} slain`;
      if (c.kind === 'delve') progress = `Deepest this contract: ${c.progress}`;
      return h(
        'div',
        { class: `contract frame${done ? ' gold done' : ''}` },
        h('div', { class: 'who', text: `${c.giver} · ${c.daysLeft} day${c.daysLeft === 1 ? '' : 's'} left` }),
        h('div', { class: 'what', text: contractTitle(c) }),
        h('div', { class: 'reward', text: `${gold(c.reward.gold)} · ✦ ${c.reward.renown}` }),
        c.accepted ? h('div', { class: done ? 'green-t' : 'dim', text: progress }) : null,
        h(
          'div',
          { class: 'row' },
          !c.accepted ? btn('Accept', () => { c.accepted = true; this.commit(); }, 'small', accepted >= MAX_ACCEPTED) : null,
          c.accepted ? btn('Turn in', () => this.turnIn(c.id), 'small primary', !done) : null,
          c.accepted ? btn('Abandon', () => { c.accepted = false; c.progress = 0; this.commit(); }, 'small') : null,
        ),
      );
    });
    return h(
      'div',
      {},
      h('p', { class: 'dim', style: 'margin-bottom:8px', text: `Up to ${MAX_ACCEPTED} contracts at a time. Slay and delve contracts only count once accepted. New work is posted each morning.` }),
      h('div', { class: 'contracts' }, ...cards),
    );
  }

  private turnIn(id: string): void {
    const s = this.s;
    const c = s.contracts.find((x) => x.id === id);
    if (!c || !isComplete(c, s.stash)) return;
    if (c.kind === 'deliver') removeOf(s.stash, 'material', c.materialId!, c.qty!);
    if (c.kind === 'gear') removeItem(s.stash, gearCandidates(c, s.stash)[0].uid);
    s.gold += c.reward.gold;
    s.renown += c.reward.renown;
    s.contracts = s.contracts.filter((x) => x !== c);
    this.ctx.toast(`${c.giver} pays ${gold(c.reward.gold)} and speaks well of you (+${c.reward.renown} renown).`, '#e8b84a');
    this.commit('gold');
  }

  // ---------------------------------------------------------------------------
  // Stash
  // ---------------------------------------------------------------------------

  private stash(): HTMLElement {
    const s = this.s;
    const eq = s.equipment;
    const doll = paperDoll(eq, (slot) => {
      unequipTo(eq, slot, s.stash);
      this.commit();
    });
    const filters: [typeof this.stashFilter, string][] = [['all', 'All'], ['gear', 'Gear'], ['materials', 'Materials'], ['other', 'Other']];
    const shown = s.stash.items.filter((i) =>
      this.stashFilter === 'all' ? true : this.stashFilter === 'gear' ? i.kind === 'equipment' : this.stashFilter === 'materials' ? i.kind === 'material' : i.kind === 'consumable' || i.kind === 'blueprint',
    );
    const grid = h('div', { class: 'grid-slots' });
    for (const it of shown) {
      const slot = defaultSlot(it, eq);
      grid.append(
        itemSlot(it, {
          size: 44,
          tip: () => itemTooltip(it, { compare: slot ? eq[slot] : null, hint: it.kind === 'equipment' ? 'Click to equip' : undefined }),
          onclick: () => {
            if (it.kind !== 'equipment') return;
            equipFrom(eq, s.stash, it.uid);
            this.commit();
          },
        }),
      );
    }
    return h(
      'div',
      { class: 'panes' },
      h(
        'div',
        { class: 'pane frame' },
        h('div', { class: 'row' }, h('h3', { text: `Stash (${s.stash.items.length})` }), h('div', { class: 'row right' }, ...filters.map(([f, l]) => btn(l, () => { this.stashFilter = f; this.commit(); }, `small${this.stashFilter === f ? ' primary' : ''}`)), btn('Sort', () => { sortContainer(s.stash); this.commit(); }, 'small'))),
        shown.length ? grid : h('p', { class: 'dim', text: 'Empty.' }),
      ),
      h('div', { class: 'pane frame' }, h('h3', { text: 'Equipped' }), doll, statSheet({ derived: derivePlayer(eq, s.meta) }), h('p', { class: 'dim small', text: 'Your equipped gear comes back even if you die. Your backpack does not.' })),
    );
  }

  // ---------------------------------------------------------------------------
  // Warden (meta progression)
  // ---------------------------------------------------------------------------

  private warden(): HTMLElement {
    const s = this.s;
    const cards = META_UPGRADES.map((u) => {
      const lvl = metaLevel(s.meta, u.id);
      const cost = nextCost(u, s.meta);
      return h(
        'div',
        { class: 'upgrade frame' },
        h('div', { class: 'row' }, h('span', { style: 'font-size:22px', text: u.name }), h('div', { class: 'pips right' }, ...u.costs.map((_, i) => h('i', { class: i < lvl ? 'on' : '' })))),
        h('div', { class: 'dim', text: u.description }),
        h(
          'div',
          { class: 'row' },
          cost === null
            ? h('span', { class: 'gold-t', text: 'Mastered' })
            : btn(`Train · ✦ ${cost}`, () => {
                s.renown -= cost;
                s.meta[u.id] = lvl + 1;
                this.ctx.toast(`${u.name} ${lvl + 1}.`, '#c080ff');
                this.commit('magic');
              }, 'small primary', s.renown < cost),
        ),
      );
    });
    const L = s.lifetime;
    return h(
      'div',
      {},
      h('p', { class: 'dim', style: 'margin-bottom:8px', text: 'Renown is earned by coming home alive (deeper is better), by slaying the Ashen King, and by guild contracts.' }),
      h('div', { class: 'upgrades' }, ...cards),
      h(
        'div',
        { class: 'pane frame', style: 'margin-top:14px' },
        h('h3', { text: 'Chronicle' }),
        h('p', { text: `${L.runs} delves · ${L.extractions} returns · ${L.deaths} deaths · deepest ${L.bestDepth} · ${L.kills} slain · ${gold(L.goldEarned)} earned` }),
        h('div', { class: 'row', style: 'margin-top:8px' }, btn(this.confirmReset ? 'Really erase everything? Click again' : 'Start a new life', () => {
          if (!this.confirmReset) {
            this.confirmReset = true;
            this.render();
            return;
          }
          this.confirmReset = false;
          this.ctx.newGame();
        }, 'small danger')),
      ),
    );
  }
}
