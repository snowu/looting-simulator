import { GameState } from '../state/game-state';
import { EQUIP_SLOTS, Item, MaterialCategory, Rarity, RARITY_COLORS, STAT_KEYS, STAT_LABELS, Stats } from '../types';
import { MATERIALS, catalystAffixBonus, material, secondaryMaterialMods } from '../data/materials';
import { consumable, itemBase } from '../data/items';
import { affix } from '../data/affixes';
import { MAX_RECIPE_RANK, RECIPE_LADDER, blueprintCostForNextRank, masteryBonus, recipe, recipeRank } from '../data/recipes';
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
  SHOP_CONSUMABLES,
  trendPercent,
} from '../systems/market';
import { MAX_ACCEPTED, contractTitle, gearCandidates, isComplete } from '../systems/contracts';
import { BESTIARY_ORDER, bestiaryEntry, bestiaryProgress, isKnown, isSeen } from '../systems/bestiary';
import { RELIC_ORDER, findRelic, forgetRelic, forgetRelicName, isFound, isNamed, nameRelic, relicProgress } from '../systems/relics';
import { UniqueDef } from '../data/uniques';
import { ELEMENTS } from '../types';
import { buildCrafted, craft, materialsForSlot, selectionError, studyBlueprint } from '../systems/crafting';
import { durability, identify, identifyCost, itemIcon, itemName, itemStats, itemValue, makeConsumable, makeUnique, repairCost, repairItem, salvage, uniqueOf } from '../systems/items';
import { Container, addItem, canFit, countOf, freeSlots, removeItem, removeOf, roomFor, sortContainer, takeQty } from '../state/inventory';
import { syncLoadout } from '../systems/run';
import { attuneSigil, inscribeSigil } from '../systems/spells';
import { findSigil, sigil } from '../data/spells';
import { derivePlayer } from '../systems/player';
import { defaultSlot, equipFrom, unequipTo } from '../systems/equip';
import { createRng, hashString, randomSeed } from '../core/rng';
import { artImg, bothRegisters, btn, gold, h, hideTooltip, isTouchMode, itemSlot, itemTooltip, rarityColor, sparkline, statLines, toggleDetailed } from './dom';
import { esc } from '../core/escape';
import { artUrl } from '../render/art-cache';
import { paperDoll, statSheet } from './dungeon-ui';
import { audio } from '../audio/sfx';
import { difficultyOf } from '../data/difficulty';
import { AccountSummary } from './account';
import { openSettings, settingsGearButton } from './settings';

export type TownTab = 'market' | 'forge' | 'guild' | 'stash' | 'bestiary' | 'warden';

export interface TownCtx {
  state: () => GameState;
  save: () => void;
  descend: () => void;
  newGame: () => void;
  toast: (text: string, color?: string) => void;
  /**
   * The account and sync block. It lives on the title screen too, and an
   * element is only ever in one place, so opening settings moves it there —
   * which is what we want: whoever is signed in and whether the save has
   * reached the cloud should be legible while playing, not only before
   * starting. The town header itself keeps only the compact status below.
   */
  account?: () => HTMLElement | null;
  /** Compact sync status for the header: "Synced", or a Connect invitation. */
  accountSummary?: () => AccountSummary;
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

type ForgeMaterialRole = 'primary' | 'secondary' | 'catalyst';

function forgeMaterialNote(id: string | null, role: ForgeMaterialRole, baseId: string, smith: number, rank: number, primaryId?: string | null): string {
  if (!id) return role === 'catalyst' ? 'None · no guaranteed affix · rarity unchanged' : `No ${role} material selected`;
  const def = material(id);
  if (role === 'catalyst') {
    const affixDef = def.catalystAffix ? affix(def.catalystAffix) : null;
    const primaryTier = primaryId ? material(primaryId).tier : 1;
    const ilvl = primaryTier * 2 + def.tier;
    const value = affixDef ? Math.max(1, Math.round((affixDef.min + affixDef.max + 1) / 2 + affixDef.perLevel * ilvl)) + catalystAffixBonus(def) : 0;
    const effect = affixDef ? `${affixDef.name}: +${value}\u00a0${STAT_LABELS[affixDef.stat]} · +1 rarity` : '+1 rarity';
    return `${def.name} · Tier ${def.tier} · ${effect}`;
  }
  if (role === 'primary') {
    const base = itemBase(baseId);
    const quality = 1.02 + smith * 0.06;
    const core: Partial<Stats> = {};
    for (const key of STAT_KEYS) {
      let value = ((base.base[key] ?? 0) + (base.perTier[key] ?? 0) * (def.tier - 1)) * quality;
      if (value > 0) value *= 1 + masteryBonus(rank);
      value += def.mods[key] ?? 0;
      if (value) core[key] = Math.round(value);
    }
    return `${def.name} · Tier ${def.tier} · ${formatForgeStats(core) || 'no stat contribution'}`;
  }
  const combined: Partial<Stats> = {};
  const structural = secondaryMaterialMods(def);
  for (const key of STAT_KEYS) combined[key] = (structural[key] ?? 0) + (def.mods[key] ?? 0);
  return `${def.name} · Tier ${def.tier} · ${formatForgeStats(combined) || 'no stat contribution'}`;
}

function formatForgeStats(stats: Partial<Stats>): string {
  return STAT_KEYS.flatMap((key) => {
    const value = stats[key] ?? 0;
    return value ? [`${value > 0 ? '+' : ''}${value}\u00a0${STAT_LABELS[key].replaceAll(' ', '\u00a0')}`] : [];
  }).join(', ');
}

export class Town {
  readonly root = h('div', { class: 'town' });
  tab: TownTab = 'market';
  /** Codex: which half is showing, which creature is open, and the bench. */
  private codex: 'creatures' | 'relics' = 'creatures';
  private relic: string | null = null;
  private beast: string | null = null;
  private beastFrame: 'idle' | 'atk' | 'block' | 'play' = 'play';
  private beastTint: 'none' | 'hurt' | 'windup' | 'dead' = 'none';
  private beastBob = true;
  private beastTimer: number | null = null;
  /**
   * Which bench the forge's right-hand column is showing.
   *
   * Repairs, sigils, recipes and blueprints used to be four panes stacked in
   * one column, so the recipe list — the thing you came to the forge to use —
   * started a screen and a half down. They are tabs now, and the badges carry
   * the one thing stacking them was good for: you can still see at a glance
   * that something is broken or that a stone is waiting, without the pane
   * itself taking the room.
   */
  private forgeSide: 'recipes' | 'repairs' | 'sigils' = 'recipes';
  private forgeRecipe = 'r_short_sword';
  private forgeMats: (string | null)[] = [];
  private stashFilter: 'all' | 'gear' | 'materials' | 'other' = 'all';
  /** What a click on a stash item does: wear it, or pack it for the delve. */
  private stashAction: 'equip' | 'pack' = 'equip';
  private confirmReset = false;
  private scrollMemo = 0;
  private recipeScrollMemo = 0;

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
    if (this.beastTimer !== null) {
      clearInterval(this.beastTimer);
      this.beastTimer = null;
    }
    this.scrollMemo = this.root.scrollTop;
    const currentRecipes = this.root.querySelector<HTMLElement>('.recipes');
    if (currentRecipes) this.recipeScrollMemo = currentRecipes.scrollTop;
    const s = this.s;
    const running = !!s.run && s.run.outcome === 'active';
    const readyContracts = s.contracts.filter((c) => c.accepted && isComplete(c, s.stash)).length;
    const blueprintCounts = new Map<string, number>();
    for (const item of s.stash.items) {
      if (item.kind === 'blueprint') blueprintCounts.set(item.ref, (blueprintCounts.get(item.ref) ?? 0) + item.qty);
    }
    const readyBlueprints = [...blueprintCounts].filter(([id, owned]) => {
      const rank = recipeRank(s.recipeRanks, id);
      return rank < MAX_RECIPE_RANK && owned >= blueprintCostForNextRank(rank);
    }).length;
    const tabs: [TownTab, string, number][] = [
      ['market', 'Market', 0],
      ['forge', 'Forge', readyBlueprints],
      ['guild', 'Guild', readyContracts],
      ['stash', 'Stash & Gear', 0],
      ['bestiary', 'Bestiary', 0],
      ['warden', 'Warden', META_UPGRADES.some((u) => (nextCost(u, s.meta) ?? Infinity) <= s.renown) ? 1 : 0],
    ];
    const head = h(
      'div',
      { class: 'town-head' },
      h('div', {}, h('h1', { text: 'Bleakmere' }), h('div', { class: 'dim', text: `Day ${s.market.day} · the market town above the old crypt` })),
      h(
        'div',
        { class: 'purse grow' },
        h('span', { class: 'gold-t', text: `◆ ${gold(s.gold)}` }),
        h('span', { class: 'violet-t', text: `✦ ${s.renown} renown` }),
        h('span', { class: 'dim', text: `pack ${backpackCapacity(s.meta)} slots` }),
      ),
      btn(
        s.run?.portal ? 'Step back through the portal' : running ? 'Return to the Depths' : 'Descend',
        () => this.ctx.descend(),
        'primary big',
      ),
      this.syncCompact(),
      settingsGearButton(() => this.openSettings(), 'Settings — difficulty, sound, cloud saves', 28),
    );
    const tabBar = h(
      'div',
      { class: 'tabs' },
      ...tabs.map(([id, label, badge]) =>
        h('button', { class: `tab${this.tab === id ? ' on' : ''}`, onclick: () => { this.tab = id; audio.play('ui'); this.render(); } }, label, badge ? h('span', { class: 'badge', text: String(badge) }) : null),
      ),
    );
    let body: HTMLElement;
    // Mid-delve with no portal open means this screen was reached without
    // earning the trip — a reload used to land here. Town services stay shut:
    // moving the live backpack into the stash would make everything carried
    // safe before the delve gets dangerous. A proper portal trip keeps full
    // access; this lock is only for the trip that never happened.
    if (running && !s.run!.portal) {
      body = h(
        'div',
        { class: 'pane frame' },
        h('h3', { text: 'The delve is still open' }),
        h('p', { class: 'dim', text: 'You left in the middle of a delve. Bleakmere keeps its doors shut until you go back and finish what you started — or find a Scroll of Recall to earn the trip home.' }),
        h('div', { class: 'row' }, btn('Return to the Depths', () => this.ctx.descend(), 'primary big')),
      );
    } else switch (this.tab) {
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
      case 'bestiary':
        body = this.bestiary();
        break;
      case 'warden':
        body = this.warden();
        break;
    }
    this.root.replaceChildren(head, this.news(), tabBar, body);
    this.root.scrollTop = this.scrollMemo;
    const nextRecipes = this.root.querySelector<HTMLElement>('.recipes');
    if (nextRecipes) nextRecipes.scrollTop = this.recipeScrollMemo;
  }

  /**
   * The header keeps only the sync status: the coordinator's note while
   * signed in ("Synced"), a Connect button otherwise. Everything with room
   * to breathe — the sign-in flow, the difficulty switch — lives behind the
   * gear. Refreshed on every town render, and on settings close.
   */
  private syncCompact(): HTMLElement | null {
    const sum = this.ctx.accountSummary?.();
    if (!sum || !sum.available) return null;
    if (sum.connected) {
      return h('span', {
        class: 'dim small',
        text: sum.note || 'Synced',
        title: 'Cloud saves are up to date. Details behind the gear.',
      });
    }
    const el = btn('Connect', () => this.openSettings(), 'small');
    el.title = 'Sync saves across devices';
    return el;
  }

  /**
   * The difficulty the stat sheet should read at: the run snapshot while a
   * delve is open, the town setting otherwise. Same rule the world uses, so
   * the health the town shows is the health you actually walk in with.
   */
  private get difficultyId() {
    const s = this.s;
    return difficultyOf(s.run?.outcome === 'active' ? s.run.difficulty ?? s.difficulty : s.difficulty).id;
  }

  private openSettings(): void {
    openSettings({
      state: () => this.s,
      save: () => this.ctx.save(),
      toast: (t, c) => this.ctx.toast(t, c),
      account: () => this.ctx.account?.() ?? null,
      onClose: () => this.render(),
      showDifficulty: true,
    });
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
        const questRequired = s.contracts
          .filter((c) => c.accepted && c.kind === 'deliver' && c.materialId === mat.id)
          .reduce((n, c) => n + (c.qty ?? 0), 0);
        const questShortfall = Math.max(0, questRequired - owned);
        const questLabel = questRequired ? `Quest: ${owned}/${questRequired}${questShortfall ? ` · need ${questShortfall} more` : ' · ready to deliver'}` : '';
        const icon = itemSlot({ uid: mat.id, kind: 'material', ref: mat.id, qty: 1 }, { size: 32, tip: () => itemTooltip({ uid: '', kind: 'material', ref: mat.id, qty: Math.max(1, owned) }, { price: { label: 'Sells for', value: sell } }) + (questRequired ? `<div class="tt-warn">${questLabel}</div>` : '') });
        if (questRequired) icon.classList.add('quest');
        rows.push(
          h(
            'tr',
            {},
            h('td', {}, icon),
            h('td', {}, h('span', { style: `color:${RARITY_COLORS[mat.rarity]}`, text: mat.name }), questRequired ? h('span', { class: 'gold-t small', attrs: { title: questLabel }, text: ` ⚑ ${owned}/${questRequired}` }) : null, ev !== 1 ? h('span', { class: ev > 1 ? 'gold-t small' : 'red-t small', text: ev > 1 ? ' ★' : ' ▾' }) : null),
            h('td', { class: 'num gold-t', text: `${sell}` }),
            h('td', { class: 'num dim', text: `${buy}` }),
            trendCell,
            h('td', { class: 'num market-owned', text: String(owned) }),
            h('td', { class: 'num dim col-stock', text: String(c.stock) }),
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
        h('thead', {}, h('tr', {}, h('th', {}), h('th', { text: 'Commodity' }), h('th', { class: 'num', text: 'Sell' }), h('th', { class: 'num', text: 'Buy' }), h('th', { class: 'col-trend', text: insider ? 'Trend (30d)' : 'Trend' }), h('th', { class: 'num', text: 'Yours' }), h('th', { class: 'num col-stock', text: 'Merchant' }), h('th', {}))),
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
          const relic = uniqueOf(it);
          if (relic && nameRelic((s.lifetime.uniquesKnown ??= []), relic.id)) {
            this.ctx.toast(`${relic.name}. The codex has a page for it now.`, '#e8b84a');
          }
          this.ctx.toast(`The appraiser squints: ${itemName(it)}.`, '#c8b8ff');
          this.commit('study');
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
    // SHOP_CONSUMABLES, not every consumable in the game: it is the one place
    // that decides what a merchant stocks, and it already leaves out the
    // found-only tonics.
    for (const c of SHOP_CONSUMABLES.map(consumable)) {
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

    // Sell only valuables beyond the quantity promised to accepted contracts.
    const valuablesOwned = this.valuablesOwned();
    const valuablesQuote = valuablesOwned.reduce((sum, v) => sum + quoteSell(m, v.id, v.qty, this.hag), 0);
    return h(
      'div',
      { class: 'panes' },
      h('div', { class: 'pane frame' }, h('div', { class: 'row' }, h('h3', { text: 'Commodities' }), valuablesOwned.length ? btn(`Sell spare valuables (${gold(valuablesQuote)})`, () => this.sellAllValuables(), 'small right') : null), h('p', { class: 'dim small', text: '⚑ marks materials needed for accepted quests; the count shows yours / required. Yours means your stash; Merchant means available to buy.' }), table),
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
            this.commit('study');
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

  /** Valuables available to sell after reserving accepted delivery contracts. */
  private valuablesOwned(): { id: string; qty: number }[] {
    return MATERIALS.filter((x) => x.category === 'valuable')
      .map((mat) => ({ id: mat.id, qty: Math.max(0, countOf(this.s.stash, 'material', mat.id) - this.s.contracts.filter((c) => c.accepted && c.kind === 'deliver' && c.materialId === mat.id).reduce((n, c) => n + (c.qty ?? 0), 0)) }))
      .filter((v) => v.qty > 0);
  }

  /** Sell spare valuables through the same per-commodity pricing as the row buttons. */
  private sellAllValuables(): void {
    const s = this.s;
    const owned = this.valuablesOwned();
    if (!owned.length) return;
    let total = 0;
    const names: string[] = [];
    for (const v of owned) {
      if (!removeOf(s.stash, 'material', v.id, v.qty)) continue;
      total += sellCommodity(s.market, v.id, v.qty, this.hag);
      names.push(`${v.qty} × ${material(v.id).name}`);
    }
    if (!total) return;
    s.gold += total;
    s.lifetime.goldEarned += total;
    this.ctx.toast(`Sold ${names.join(', ')} for ${gold(total)}.`, '#e8b84a');
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
    for (const r of RECIPE_LADDER) {
      const rank = recipeRank(s.recipeRanks, r.id);
      const known = rank > 0;
      const base = itemBase(r.baseId);
      const status = known ? `Rank ${rank} · +${Math.round(masteryBonus(rank) * 100)}% core` : 'blueprint needed';
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
          h('span', { class: 'dim small', text: status }),
        ),
      );
    }

    // Blueprints waiting to be learned.
    const grouped = new Map<string, { sample: Item; owned: number }>();
    for (const bp of s.stash.items.filter((i) => i.kind === 'blueprint')) {
      const group = grouped.get(bp.ref);
      if (group) group.owned += bp.qty;
      else grouped.set(bp.ref, { sample: bp, owned: bp.qty });
    }
    const bps = [...grouped.values()].sort((a, b) => {
      const aCapped = recipeRank(s.recipeRanks, a.sample.ref) >= MAX_RECIPE_RANK;
      const bCapped = recipeRank(s.recipeRanks, b.sample.ref) >= MAX_RECIPE_RANK;
      return Number(aCapped) - Number(bCapped) || itemName(a.sample).localeCompare(itemName(b.sample));
    });
    const learn = bps.length
      ? h(
          'div',
          { class: 'pane frame' },
          h('h3', { text: 'Blueprints' }),
          h(
            'div',
            { class: 'wares blueprint-wares' },
            ...bps.map(({ sample: bp, owned }) => {
              const rank = recipeRank(s.recipeRanks, bp.ref);
              const capped = rank >= MAX_RECIPE_RANK;
              const cost = blueprintCostForNextRank(rank);
              const enough = owned >= cost;
              const status = capped ? `Rank 5 · ${owned} spare` : rank === 0 ? `Locked · ${owned}/${cost} owned` : `Rank ${rank} · ${owned}/${cost} owned`;
              const action = capped ? 'Capped' : rank === 0 ? `Learn · ${cost} BP` : `Upgrade · ${cost} BP`;
              return h(
                'div',
                { class: 'ware blueprint-ware' },
                itemSlot({ ...bp, qty: owned }, { size: 44 }),
                h(
                  'div',
                  { class: 'blueprint-details grow' },
                  h('b', { text: itemBase(recipe(bp.ref).baseId).name }),
                  h('span', { class: 'dim small', text: status }),
                ),
                btn(action, () => {
                  const next = studyBlueprint(bp, s.stash, s.recipeRanks);
                  if (!next) return;
                  this.forgeRecipe = bp.ref;
                  this.forgeMats = this.defaultMats(bp.ref);
                  const name = itemBase(recipe(bp.ref).baseId).name;
                  this.ctx.toast(next === 1 ? `Learned to forge the ${name}.` : `${name} mastery reached Rank ${next} for ${cost} blueprints.`, '#9ab0d8');
                  this.commit('study');
                }, 'small', capped || !enough),
              );
            }),
          ),
          h('p', { class: 'dim small', text: 'Duplicate blueprints raise mastery to Rank 5. Capped copies can be sold.' }),
        )
      : null;

    // Selected recipe.
    const r = recipe(this.forgeRecipe);
    const rank = recipeRank(s.recipeRanks, r.id);
    const sel = { recipeId: r.id, materials: this.forgeMats };
    const selectedPreview = this.forgeMats[0] ? buildCrafted(sel, smith, undefined, rank) : null;
    const slotRows = r.slots.map((slot, i) => {
      const role: ForgeMaterialRole = i === 0 ? 'primary' : slot.categories.length === 1 && slot.categories[0] === 'gem' ? 'catalyst' : 'secondary';
      const roleName = role[0].toUpperCase() + role.slice(1);
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
          tip: () => itemTooltip(
            { uid: '', kind: 'material', ref: def.id, qty: Math.max(1, owned) },
            {
              forgeEffect: forgeMaterialNote(def.id, role, r.baseId, smith, rank, this.forgeMats[0]),
              hint: owned >= slot.qty ? `Use ${slot.qty} ${def.name}` : `Need ${slot.qty}; you own ${owned}`,
            },
          ),
          onclick: () => {
            this.forgeMats[i] = def.id;
            this.commit();
          },
        });
        if (owned < slot.qty) el.classList.add('cant');
        picker.append(el);
      }
      return h(
        'div',
        { class: 'forge-slot' },
        h('div', { class: 'lbl' }, h('span', { text: slot.label }), h('b', { class: `forge-role ${role}`, text: roleName }), h('small', { text: `×${slot.qty}${slot.optional ? ' optional' : ''}` })),
        h('div', { class: 'forge-choice' }, picker, h('div', { class: 'role-note', text: forgeMaterialNote(this.forgeMats[i], role, r.baseId, smith, rank, this.forgeMats[0]) })),
      );
    });

    const err = selectionError(sel, s.stash);
    let preview: HTMLElement | null = null;
    if (selectedPreview) {
      const item = selectedPreview;
      const cmpSlot = defaultSlot(item, s.equipment);
      const cmp = cmpSlot ? s.equipment[cmpSlot] : null;
      preview = h(
        'div',
        { class: 'preview' },
        itemSlot(item, { size: 56, tip: () => itemTooltip(item, { compare: cmp }) }),
        // itemName/item.rarity ultimately derive from save data (a hand-edited
        // or console-injected save can carry anything), so both are escaped
        // before going into innerHTML. rarityColor/statLines only emit
        // constants and numbers.
        h('div', { html: `<div style="color:${rarityColor(item)};font-size:22px">${esc(itemName(item))}</div><div class="dim">${esc(String(item.rarity))} · Rank ${rank} · quality ~${Math.round((item.quality ?? 1) * 100)}%</div>${statLines(itemStats(item), cmp ? itemStats(cmp) : undefined).join('')}` }),
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
        h('h3', { text: `Forge: ${itemBase(r.baseId).name} · Rank ${rank}` }),
        h('p', { class: 'dim small', text: `Rank ${rank} mastery: +${Math.round(masteryBonus(rank) * 100)}% core stats and durability. Hover a material to see exactly what it contributes in that slot.` }),
        ...slotRows,
        preview,
        h('div', { class: 'row' }, btn('Forge it', () => {
          const item = craft(sel, s.stash, createRng(randomSeed()), smith, rank);
          if (!item) return;
          addItem(s.stash, item);
          this.forgeMats = this.defaultMats(r.id);
          this.ctx.toast(`Forged: ${itemName(item)}.`, rarityColor(item));
          this.commit('craft');
        }, 'primary', !!err), err ? h('span', { class: 'dim small', text: err }) : null),
        gear.length ? h('div', {}, h('h3', { style: 'margin-top:10px', text: 'Salvage' }), salvageGrid) : null,
      ),
      this.forgeBenches(list, learn),
    );
  }

  /**
   * The forge's right-hand column: one bench at a time, with a badge on any
   * other that wants attention.
   */
  private forgeBenches(list: HTMLElement, learn: HTMLElement | null): HTMLElement {
    const s = this.s;
    const wornCount = EQUIP_SLOTS.filter((slot) => {
      const it = s.equipment[slot];
      return it && repairCost(it) > 0;
    }).length + s.stash.items.filter((it) => it.kind === 'equipment' && repairCost(it) > 0).length;
    const stones = s.stash.items.filter((it) => it.kind === 'sigil' && findSigil(it.ref) && !(s.spells ?? []).includes(it.ref)).length;
    const blueprints = new Map<string, number>();
    for (const item of s.stash.items) {
      if (item.kind === 'blueprint') blueprints.set(item.ref, (blueprints.get(item.ref) ?? 0) + item.qty);
    }
    const readyBlueprints = [...blueprints].filter(([id, owned]) => {
      const rank = recipeRank(s.recipeRanks, id);
      return rank < MAX_RECIPE_RANK && owned >= blueprintCostForNextRank(rank);
    }).length;

    const benches: [typeof this.forgeSide, string, number][] = [
      ['recipes', 'Recipes', readyBlueprints],
      ['repairs', 'Repairs', wornCount],
      ['sigils', 'Sigils', stones],
    ];
    const bar = h(
      'div',
      { class: 'tabs subtabs' },
      ...benches.map(([id, label, badge]) =>
        h('button', {
          class: `tab${this.forgeSide === id ? ' on' : ''}`,
          onclick: () => { this.forgeSide = id; audio.play('ui'); this.render(); },
        }, label, badge ? h('span', { class: 'badge', text: String(badge) }) : null),
      ),
    );
    const body = this.forgeSide === 'repairs'
      ? this.repairs()
      : this.forgeSide === 'sigils'
        ? this.sigils()
        : h('div', { class: 'col' }, h('div', { class: 'pane frame' }, h('h3', { text: 'Recipes' }), list), learn);
    return h('div', { class: 'col' }, bar, body);
  }

  /**
   * The repair bench. Everything you are wearing and everything in the stash
   * that has taken a beating, with what the smith wants for it. Broken gear is
   * listed first because that is the gear costing you something right now.
   */
  private repairs(): HTMLElement {
    const s = this.s;
    const worn: { item: Item; where: string }[] = [];
    for (const slot of EQUIP_SLOTS) {
      const it = s.equipment[slot];
      if (it && repairCost(it) > 0) worn.push({ item: it, where: 'worn' });
    }
    for (const it of s.stash.items) if (it.kind === 'equipment' && repairCost(it) > 0) worn.push({ item: it, where: 'stash' });
    worn.sort((a, b) => Number(durability(b.item).broken) - Number(durability(a.item).broken) || repairCost(b.item) - repairCost(a.item));

    const total = worn.reduce((sum, w) => sum + repairCost(w.item), 0);
    const rows = worn.map(({ item, where }) => {
      const d = durability(item);
      const cost = repairCost(item);
      return h(
        'div',
        { class: 'row repair-row' },
        itemSlot(item, { size: 34, tip: () => itemTooltip(item) }),
        h('div', { class: 'grow' },
          h('div', { style: `color:${rarityColor(item)}`, text: itemName(item) }),
          h('div', { class: 'dim small', text: `${where} · ${d.broken ? 'broken' : `${Math.round(d.frac * 100)}%`}` }),
        ),
        btn(`Mend · ${gold(cost)}`, () => {
          if (s.gold < cost) return;
          s.gold -= cost;
          repairItem(item);
          this.commit('craft');
        }, 'small', s.gold < cost),
      );
    });

    return h(
      'div',
      { class: 'pane frame' },
      h('div', { class: 'row' },
        h('h3', { text: `Repairs${worn.length ? ` (${worn.length})` : ''}` }),
        worn.length
          ? h('div', { class: 'row right' }, btn(`Mend all · ${gold(total)}`, () => {
              if (s.gold < total) return;
              s.gold -= total;
              for (const w of worn) repairItem(w.item);
              this.ctx.toast(`Mended ${worn.length} piece${worn.length === 1 ? '' : 's'}.`, '#c8c0b0');
              this.commit('craft');
            }, 'small primary', s.gold < total))
          : null,
      ),
      worn.length
        ? h('div', { class: 'col' }, ...rows)
        : h('p', { class: 'dim', text: 'Nothing needs the hammer. Weapons wear 2 on every blow that lands (3 on a cleave), shields 2 on every blow taken, armour 2 when one gets through — and every third swing at air dulls the edge.' }),
    );
  }


  /**
   * The sigil bench. Two separate things that both belong here: cutting a
   * recovered stone into the book, which is permanent and one-way, and
   * choosing which one you carry down, which is the actual decision.
   *
   * You carry exactly one. That is the whole design — you cannot hold both the
   * escape and the control, so a fight is played with the tool you guessed at
   * up here. Swapping mid-delve is refused by `attuneSigil` unless a portal is
   * open, and the note under the list says so rather than the button silently
   * doing nothing.
   */
  private sigils(): HTMLElement {
    const s = this.s;
    const known = s.spells ?? [];
    const stones = s.stash.items.filter((it) => it.kind === 'sigil' && findSigil(it.ref));
    const locked = !!s.run && !s.run.portal;
    const vigil = metaLevel(s.meta, 'attunement');

    const stoneRows = stones.map((it) => {
      const def = sigil(it.ref);
      const already = known.includes(it.ref);
      return h(
        'div',
        { class: 'row repair-row' },
        itemSlot(it, { size: 34, tip: () => itemTooltip(it) }),
        h('div', { class: 'grow' },
          h('div', { style: 'color:#b89ad8', text: def.name }),
          h('div', { class: 'dim small', text: already ? 'already inscribed — worth selling' : def.description }),
        ),
        btn('Inscribe', () => {
          if (!inscribeSigil(s, s.stash, it.uid)) return;
          this.ctx.toast(`${def.name} inscribed. It is yours for good.`, '#b89ad8');
          this.commit('craft');
        }, 'small', already),
      );
    });

    const rows = known.map((id) => {
      const def = sigil(id);
      const on = s.attuned === id;
      return h(
        'div',
        { class: `row repair-row${on ? ' gold' : ''}` },
        artImg(def.icon, undefined, 34),
        h('div', { class: 'grow' },
          h('div', { style: `color:${on ? '#e0c060' : '#b89ad8'}`, text: def.name }),
          h('div', { class: 'dim small', text: `${def.description} · ${def.cast.toFixed(2)}s cast · ${def.stamina} stamina · ${def.cooldown}s` }),
        ),
        btn(on ? 'Attuned' : 'Attune', () => {
          if (!attuneSigil(s, id)) return this.ctx.toast('Not while you are down there. Step back through a portal first.', '#9ab0d8');
          this.ctx.toast(`Attuned to the ${def.name}.`, '#b89ad8');
          this.commit('study');
        }, `small${on ? ' primary' : ''}`, on || locked),
      );
    });

    return h(
      'div',
      { class: 'pane frame' },
      h('h3', { text: 'Sigils' }),
      stoneRows.length ? h('div', { class: 'col' }, ...stoneRows) : null,
      rows.length
        ? h('div', { class: 'col' }, ...rows)
        : h('p', { class: 'dim', text: 'None inscribed. The stones are cut deep and rarely — the King keeps one, and the old wardens left the rest where they fell.' }),
      known.length
        ? h('p', { class: 'dim small', text: `You carry one at a time, cast with G or C. ${locked ? 'Attunement is fixed until you are back in town or a portal is open. ' : ''}${vigil ? `Warden's Vigil takes ${25 * vigil}% more off the cooldown on every kill, up to a fifth of it.` : "Warden's Vigil, on the Warden's board, shortens the cooldown with every kill."}` })
        : null,
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

  /**
   * The pack you are filling: the live backpack if a run is open (you came
   * home through a portal), otherwise the loadout that becomes it on descent.
   */
  private get pack(): { c: Container; live: boolean } {
    const s = this.s;
    const live = !!s.run && s.run.outcome === 'active';
    return { c: live ? s.run!.backpack : syncLoadout(s), live };
  }

  /** Stash → pack, as much of the stack as there is room for. */
  private toPack(uid: string): void {
    const s = this.s;
    const { c } = this.pack;
    const it = s.stash.items.find((i) => i.uid === uid);
    if (!it) return;
    const room = roomFor(c, it);
    if (room <= 0) {
      this.ctx.toast('Your pack is full.', '#ff9070');
      return;
    }
    const moved = takeQty(s.stash, uid, Math.min(it.qty, room));
    if (!moved) return;
    const left = addItem(c, moved);
    if (left > 0) addItem(s.stash, { ...moved, qty: left });
    this.commit('pickup');
  }

  /** Pack → stash. The stash is unlimited, so this always works. */
  private toStash(uid: string): void {
    const { c } = this.pack;
    const it = removeItem(c, uid);
    if (!it) return;
    addItem(this.s.stash, it);
    this.commit('ui');
  }

  private packPane(): HTMLElement {
    const s = this.s;
    const { c, live } = this.pack;
    const grid = h('div', { class: 'grid-slots' });
    for (const it of c.items) {
      grid.append(
        itemSlot(it, {
          size: 44,
          tip: () => itemTooltip(it, { hint: 'Click to put it back in the stash' }),
          onclick: () => this.toStash(it.uid),
        }),
      );
    }
    const potions = () => {
      for (const it of [...s.stash.items]) {
        if (it.kind !== 'consumable') continue;
        if (freeSlots(this.pack.c) <= 0 && !canFit(this.pack.c, it)) continue;
        this.toPack(it.uid);
      }
    };
    return h(
      'div',
      { class: 'pane frame' },
      h(
        'div',
        { class: 'row' },
        h('h3', { text: `Pack (${c.items.length}/${c.capacity})` }),
        h(
          'div',
          { class: 'row right' },
          btn('Take potions', potions, 'small', !s.stash.items.some((i) => i.kind === 'consumable')),
          btn('Stow all', () => {
            for (const it of [...c.items]) this.toStash(it.uid);
          }, 'small', !c.items.length),
        ),
      ),
      c.items.length ? grid : h('p', { class: 'dim', text: 'Empty. Pack potions and scrolls before you go down.' }),
      h('p', {
        class: 'dim small',
        text: live
          ? 'This is the pack on your back right now. Everything in it is lost if you die.'
          : 'This goes down with you. Everything in it is lost if you die — equipped gear always comes back.',
      }),
    );
  }

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
    const packing = this.stashAction === 'pack';
    const grid = h('div', { class: 'grid-slots' });
    for (const it of shown) {
      const slot = defaultSlot(it, eq);
      // Only gear can be worn, so a click on anything else always packs it.
      const wears = !packing && it.kind === 'equipment';
      const unidGear = wears && it.identified === false;
      grid.append(
        itemSlot(it, {
          size: 44,
          tip: () => itemTooltip(it, { compare: slot ? eq[slot] : null, hint: unidGear ? 'Unidentified — see the appraiser under Sell' : wears ? 'Click to equip' : 'Click to move it into your pack' }),
          onclick: () => {
            if (wears) {
              const err = equipFrom(eq, s.stash, it.uid);
              if (err) this.ctx.toast(err, '#ff9070');
              this.commit();
            } else {
              this.toPack(it.uid);
            }
          },
        }),
      );
    }
    const modes: [typeof this.stashAction, string][] = [['equip', 'Equip'], ['pack', 'Pack']];
    return h(
      'div',
      { class: 'panes' },
      h(
        'div',
        { class: 'pane frame' },
        h(
          'div',
          { class: 'row' },
          h('h3', { text: `Stash (${s.stash.items.length})` }),
          h(
            'div',
            { class: 'row right' },
            ...filters.map(([f, l]) => btn(l, () => { this.stashFilter = f; this.commit(); }, `small${this.stashFilter === f ? ' primary' : ''}`)),
            btn('Sort', () => { sortContainer(s.stash); this.commit(); }, 'small'),
          ),
        ),
        h(
          'div',
          { class: 'row' },
          h('span', { class: 'dim small', text: 'Clicking gear:' }),
          ...modes.map(([m, l]) => btn(l, () => { this.stashAction = m; this.commit(); }, `small${this.stashAction === m ? ' primary' : ''}`)),
          h('span', { class: 'dim small', text: 'everything else always packs' }),
        ),
        shown.length ? grid : h('p', { class: 'dim', text: 'Empty.' }),
      ),
      h(
        'div',
        { class: 'pane-col' },
        this.packPane(),
        h('div', { class: 'pane frame' }, h('h3', { text: 'Equipped' }), doll, statSheet({ derived: derivePlayer(eq, s.meta, this.difficultyId) }), h('p', { class: 'dim small', text: 'Your equipped gear comes back even if you die. Your backpack does not.' })),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Warden (meta progression)
  // ---------------------------------------------------------------------------

  /**
   * The codex. Locked creatures show as silhouettes; field notes open the full
   * entry — resistances included, which is what tells you what to bring.
   *
   * The open entry doubles as an animation bench: every frame, tint and motion
   * the dungeon renderer can put a creature in is reproducible here, so new
   * sprites can be checked without hunting one down on a floor.
   */
  private bestiary(): HTMLElement {
    const toggle = h('div', { class: 'row', style: 'margin-bottom:8px' },
      ...([['creatures', 'Creatures'], ['relics', 'Relics']] as const).map(([id, label]) =>
        btn(label, () => { this.codex = id; this.commit(); }, `small${this.codex === id ? ' primary' : ''}`)));
    return h('div', {}, toggle, this.codex === 'relics' ? this.relics() : this.creatures());
  }

  /**
   * The relic half of the codex: the bespoke legendaries, what each one does,
   * and which of them this playthrough has actually turned up. An unfound relic
   * is a shape and a depth — enough to know something is missing, not enough to
   * know what. The dev bench below reveals one so a new icon and a new effect
   * can be read without going and finding it first.
   */
  private relics(): HTMLElement {
    const s = this.s;
    const seen = s.lifetime.uniquesSeen;
    const known = s.lifetime.uniquesKnown;
    const p = relicProgress(seen, known);
    const grid = h('div', { class: 'beast-grid' });
    for (const def of RELIC_ORDER) {
      const named = isNamed(known, def.id);
      const held = isFound(seen, def.id);
      const art = itemIcon(this.relicItem(def));
      grid.append(
        h(
          'div',
          {
            class: `beast${named ? '' : ' locked'}${this.relic === def.id ? ' on' : ''}`,
            onclick: () => {
              this.relic = this.relic === def.id ? null : def.id;
              this.commit();
            },
          },
          h('div', { class: 'beast-art' }, artImg(art.icon, art.ramp, 48)),
          h('span', { class: 'beast-name', text: named ? def.name : '???' }),
          h('span', { class: 'dim small', text: named
            ? (def.kind === 'tonic' ? 'Draught' : itemBase(def.baseId).name)
            : held ? 'unappraised' : `depth ${def.minDepth}+` }),
        ),
      );
    }
    const open = this.relic ? RELIC_ORDER.find((d) => d.id === this.relic) ?? null : null;
    return h(
      'div',
      { class: 'panes beast-panes' },
      h(
        'div',
        { class: 'col' },
        h('div', { class: 'row' },
          h('h3', { class: 'grow', text: 'Relics' }),
          h('span', { class: 'dim small', text: `${p.named} of ${p.total} named${p.found > p.named ? ` · ${p.found - p.named} carried, unappraised` : ''}` })),
        h('p', { class: 'dim small', style: 'margin-bottom:6px', text: 'There are no Legendaries but these. A page opens when the appraiser names one — carrying it is not the same as knowing it. The Ashen King always gives up one you have never held, until there are none left to give.' }),
        grid,
      ),
      open ? this.relicDetail(open) : h('div', { class: 'pane frame beast-detail' },
        h('p', { class: 'dim', text: 'Choose a relic to study it.' })),
    );
  }

  /**
   * A representative roll of one relic, for display only. Seeded off the id so
   * the codex shows the same numbers every time it is opened, and never spends
   * a draw from the run's own stream.
   */
  private relicItem(def: UniqueDef): Item {
    if (def.kind === 'tonic') return makeConsumable(def.baseId);
    return makeUnique(def, createRng(hashString(`codex:${def.id}`)), def.minDepth, true);
  }

  /**
   * How to see the numbers. A keyboard holds Shift; a touchscreen has no Shift,
   * so it gets a button that latches the same global flag.
   */
  private detailSwitch(): HTMLElement {
    if (!isTouchMode()) {
      return h('div', { class: 'tt-detail-hint' },
        h('span', { class: 'detail-hide', text: 'Hold Shift for exact numbers' }),
        h('span', { class: 'detail-only', text: 'Release Shift for plain words' }));
    }
    return h('div', { class: 'row', style: 'margin-top:6px' },
      btn('Numbers', () => { toggleDetailed(); audio.play('ui'); }, 'small'));
  }

  private relicDetail(def: UniqueDef): HTMLElement {
    const s = this.s;
    const seen = (s.lifetime.uniquesSeen ??= []);
    const known = (s.lifetime.uniquesKnown ??= []);
    const found = isNamed(known, def.id);
    const held = isFound(seen, def.id);
    const item = this.relicItem(def);
    const art = itemIcon(item);
    const stage = h('div', { class: found ? 'beast-stage' : 'beast-stage locked' }, artImg(art.icon, art.ramp, 128));

    // The same dev-only door the animation bench uses, for the same reason:
    // checking a new relic's art and its effect should not need a lucky drop.
    const bench = !import.meta.env.DEV ? null : h(
      'div',
      { class: 'beast-bench' },
      h('div', { class: 'row beast-row' },
        h('span', { class: 'dim small grow', text: 'Relic bench · dev build only' }),
        btn(found ? 'Relock' : 'Unlock', () => {
          if (found) {
            forgetRelic(seen, def.id);
            forgetRelicName(known, def.id);
          } else {
            findRelic(seen, def.id);
            nameRelic(known, def.id);
          }
          this.commit();
        }, 'small')),
      h('div', { class: 'dim small', text: `id ${def.id} · icon ${art.icon} · effect ${def.effect} · power ${def.power}` }),
    );

    return h(
      'div',
      { class: 'pane frame beast-detail' },
      h('h3', { style: `color:${RARITY_COLORS[Rarity.Legendary]}`, text: found ? def.name : '???' }),
      stage,
      found
        ? h('div', {},
            h('p', { class: 'small dim', text: def.kind === 'tonic'
              ? `Legendary draught · drunk in the dark · found from depth ${def.minDepth}`
              : `${material(def.materialId!).name} ${itemBase(def.baseId).name} · ${itemBase(def.baseId).slot} · found from depth ${def.minDepth}` }),
            // Plain words by default here too. The codex is a reference, but
            // it is read far more often than it is consulted, and an item that
            // leads with its arithmetic stops reading like an object.
            bothRegisters(def.rule, def.detail, 'tt-unique'),
            h('div', { class: 'tt-flavour', text: def.flavour }),
            this.detailSwitch(),
            h('div', { style: 'margin-top:6px', html: statLines(itemStats(item)).join('') }),
            h('p', { class: 'small dim', style: 'margin-top:6px', text: def.kind === 'tonic'
              ? `Worth about ${gold(itemValue(item))}. No merchant stocks it and no forge makes it.`
              : `A fair example rolls at about ${gold(itemValue(item))}. Every one of them differs — two ordinary affixes ride on top of the effect.` }),
          )
        : h('p', { class: 'dim', text: held
            ? 'You are carrying one. What it is, the appraiser will tell you.'
            : 'Something of this shape is down there. You have not held it.' }),
      bench,
    );
  }

  private creatures(): HTMLElement {
    const s = this.s;
    const p = bestiaryProgress(s.bestiary);
    const grid = h('div', { class: 'beast-grid' });
    for (const def of BESTIARY_ORDER) {
      const known = isKnown(s.bestiary, def.id);
      const seen = isSeen(s.bestiary, def.id);
      grid.append(
        h(
          'div',
          {
            class: `beast${known ? '' : ' locked'}${this.beast === def.id ? ' on' : ''}`,
            onclick: () => {
              this.beast = this.beast === def.id ? null : def.id;
              this.commit();
            },
          },
          h('div', { class: 'beast-art' }, artImg(`${def.sprite}_0`, undefined, 48)),
          h('span', { class: 'beast-name', text: known || seen ? def.name : '???' }),
          h('span', {
            class: 'dim small',
            text: known ? (def.minDepth === def.maxDepth ? `depth ${def.minDepth}` : `depth ${def.minDepth}–${def.maxDepth}`) : seen ? 'notes needed' : 'unrecorded',
          }),
        ),
      );
    }

    const open = this.beast ? BESTIARY_ORDER.find((d) => d.id === this.beast) ?? null : null;
    return h(
      'div',
      { class: 'panes beast-panes' },
      h(
        'div',
        { class: 'col' },
        h('div', { class: 'row' },
          h('h3', { class: 'grow', text: 'Codex' }),
          h('span', { class: 'dim small', text: `${p.known} of ${p.total} recorded · ${p.seen} met` })),
        h('p', { class: 'dim small', style: 'margin-bottom:6px', text: 'Field notes fall from the creature they describe and are read where they lie. A page you already have will not drop again.' }),
        grid,
      ),
      open ? this.beastDetail(open) : h('div', { class: 'pane frame beast-detail' },
        h('p', { class: 'dim', text: 'Choose a creature to study it.' })),
    );
  }

  private beastDetail(def: (typeof BESTIARY_ORDER)[number]): HTMLElement {
    const s = this.s;
    const known = isKnown(s.bestiary, def.id);
    const entry = bestiaryEntry(s.bestiary, def.id);
    const img = artImg(`${def.sprite}_0`, undefined, 128);
    // Undiscovered creatures are a shape and nothing else: no tint (which would
    // paint the model back in), no second frame (whose silhouette gives away
    // the attack), no motion. The bench comes with the notes.
    const stage = h('div', {
      class: known
        ? `beast-stage${this.beastBob && def.floats ? ' beast-floats' : ''} tint-${this.beastTint}`
        : 'beast-stage locked',
    }, img);

    // Drive the bench. 'play' alternates the two frames the renderer uses;
    // the fixed settings hold one so a single frame can be inspected.
    // 'block' holds the guard pose, which only shieldbearers have.
    if (known && this.beastFrame === 'play') {
      let on = false;
      this.beastTimer = window.setInterval(() => {
        on = !on;
        img.src = artUrl(`${def.sprite}_${on ? 'atk' : '0'}`);
      }, 620);
    } else if (known) {
      img.src = artUrl(`${def.sprite}_${this.beastFrame === 'atk' ? 'atk' : this.beastFrame === 'block' ? 'block' : '0'}`);
    }

    const pick = <T extends string>(label: string, value: T, options: [T, string][], set: (v: T) => void) =>
      h('div', { class: 'row beast-row' },
        h('span', { class: 'dim small beast-label', text: label }),
        ...options.map(([v, text]) =>
          btn(text, () => { set(v); this.commit(); }, `small${known && value === v ? ' primary' : ''}`, !known)));

    // The animation bench is a development tool, not part of the game: it is
    // built only under `vite dev` and the whole block is dropped from a
    // production bundle, since import.meta.env.DEV is replaced at build time.
    // Shieldbearers get a third frame for the guard; everyone else plays idle
    // and attack, which are the two frames the renderer uses.
    const frames: [typeof this.beastFrame, string][] = [['play', 'Play'], ['idle', 'Idle'], ['atk', 'Attack']];
    if (def.shield) frames.push(['block', 'Block']);
    const bench = !import.meta.env.DEV ? null : h(
      'div',
      { class: 'beast-bench' },
      h('div', { class: 'row beast-row' },
        h('span', { class: 'dim small grow', text: 'Animation bench · dev build only' }),
        btn(known ? 'Relock' : 'Unlock', () => {
          const e = (s.bestiary[def.id] ??= { kills: 0, deaths: 0, bestHit: 0, worstHit: 0, known: false });
          e.known = !known;
          this.commit();
        }, 'small')),
      pick('Frame', this.beastFrame, frames, (v) => { this.beastFrame = v; }),
      pick('Tint', this.beastTint, [['none', 'None'], ['hurt', 'Hurt'], ['windup', 'Wind-up'], ['dead', 'Death']], (v) => { this.beastTint = v; }),
      h('div', { class: 'row beast-row' },
        h('span', { class: 'dim small beast-label', text: 'Motion' }),
        btn(this.beastBob ? 'Hover on' : 'Hover off', () => { this.beastBob = !this.beastBob; this.commit(); }, 'small', !known),
        h('span', { class: 'dim small', text: def.floats ? 'this one floats' : 'walker — hover is cosmetic' })),
      h('div', { class: 'dim small', text: `sprite ${def.sprite} · scale ${def.scale} · windup ${def.windup}s · recovery ${def.recovery}s` }),
    );

    const resists = [...['blunt', 'slash', 'pierce'], ...ELEMENTS]
      .map((t) => [t, def.resist[t as keyof typeof def.resist] ?? 1] as const)
      .filter(([, v]) => v !== 1);

    const tally = h('div', { class: 'beast-tally' },
      h('span', {}, h('b', { text: String(entry.kills) }), h('span', { class: 'dim small', text: entry.kills === 1 ? ' slain' : ' slain' })),
      h('span', {}, h('b', { class: entry.deaths ? 'red-t' : '', text: String(entry.deaths) }), h('span', { class: 'dim small', text: entry.deaths === 1 ? ' death to it' : ' deaths to it' })),
      h('span', {}, h('b', { text: String(entry.bestHit) }), h('span', { class: 'dim small', text: ' best hit' })),
      h('span', {}, h('b', { class: entry.worstHit ? 'red-t' : '', text: String(entry.worstHit) }), h('span', { class: 'dim small', text: ' worst taken' })));

    return h(
      'div',
      { class: 'pane frame beast-detail' },
      h('h3', { text: known ? def.name : '???' }),
      stage,
      known
        ? h('div', {},
            h('p', { class: 'tt-desc', text: def.description }),
            tally,
            h('p', { class: 'small', text: `${def.hp} HP · ${def.attack} attack · ${def.defense} defense · deals ${def.damageType} · ${def.behavior}` }),
            h('p', { class: 'small dim', text: def.minDepth === def.maxDepth ? `Found on depth ${def.minDepth}.` : `Found on depths ${def.minDepth}–${def.maxDepth}.` }),
            resists.length
              ? h('div', { class: 'beast-resists' }, ...resists.map(([t, v]) =>
                  h('span', { class: `beast-resist ${v > 1 ? 'weak' : 'strong'}`, text: `${t} ×${v}` })))
              : h('p', { class: 'small dim', text: 'Nothing it fears, nothing it shrugs off.' }),
          )
        : h('p', { class: 'dim', text: 'Its field notes would tell you what it is and what it fears.' }),
      bench,
    );
  }

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
                this.commit('study');
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
        h('p', { class: 'dim', text: `Hardest blow landed ${L.bestHit ?? 0} · hardest taken ${L.worstHit ?? 0}` }),
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
