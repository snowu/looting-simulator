import { Rng } from '../core/rng';
import { Item, Rarity, RARITY_ORDER, RecipeRanks } from '../types';
import { MATERIALS, material } from '../data/materials';
import { CONSUMABLES } from '../data/items';
import { tonicUnique } from '../data/uniques';
import { ItemCategory, durability, itemCategory, itemValue, isIdentified, materialAvailableAtDepth, rarityAvailableAtDepth, rollBlueprint, rollEquipment } from './items';

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** target: `mat:<id>`, `cat:<materialCategory>`, or `item:<ItemCategory>`. */
export interface MarketEffect {
  target: string;
  mult: number;
}

export interface MarketEventDef {
  id: string;
  name: string;
  description: string;
  effects: MarketEffect[];
  days: [number, number];
  weight: number;
}

export const MARKET_EVENTS: MarketEventDef[] = [
  { id: 'iron_shortage', name: 'Iron Shortage', description: 'The northern mines flooded. Metal is dear.', effects: [{ target: 'cat:metal', mult: 1.5 }], days: [3, 5], weight: 3 },
  { id: 'silver_glut', name: 'Silver Glut', description: 'A caravan of silver arrived from the coast.', effects: [{ target: 'mat:silver', mult: 0.55 }, { target: 'mat:silver_chalice', mult: 0.7 }], days: [3, 4], weight: 2 },
  { id: 'collectors_fair', name: "Collectors' Fair", description: 'Rich fools are in town, buying anything old.', effects: [{ target: 'cat:valuable', mult: 1.8 }], days: [2, 3], weight: 3 },
  { id: 'war_drums', name: 'War Drums', description: 'The Duke is raising an army.', effects: [{ target: 'item:weapon', mult: 1.45 }, { target: 'item:armor', mult: 1.3 }, { target: 'mat:iron', mult: 1.25 }, { target: 'mat:leather', mult: 1.3 }], days: [3, 5], weight: 3 },
  { id: 'harsh_winter', name: 'Harsh Winter', description: 'Furs and cloth fly off the stalls.', effects: [{ target: 'cat:hide', mult: 1.5 }, { target: 'cat:cloth', mult: 1.5 }], days: [3, 5], weight: 2 },
  { id: 'royal_wedding', name: 'Royal Wedding', description: 'Jewellers are desperate for stones and gold.', effects: [{ target: 'cat:gem', mult: 1.6 }, { target: 'mat:gold', mult: 1.5 }, { target: 'item:jewelry', mult: 1.5 }], days: [2, 4], weight: 2 },
  { id: 'temple_crusade', name: 'Temple Crusade', description: 'The temple pays well for silver and relics.', effects: [{ target: 'mat:silver', mult: 1.7 }, { target: 'mat:silver_chalice', mult: 1.6 }, { target: 'mat:bone_idol', mult: 0.5 }], days: [3, 4], weight: 2 },
  { id: 'adventurers_returned', name: 'Adventurers Returned', description: 'A rival company came back rich. Everyone is selling.', effects: [{ target: 'item:weapon', mult: 0.7 }, { target: 'item:armor', mult: 0.7 }, { target: 'item:jewelry', mult: 0.75 }, { target: 'cat:valuable', mult: 0.8 }], days: [2, 3], weight: 2 },
  { id: 'rat_plague', name: 'Rat Plague', description: 'Nobody wants anything that smells of rats.', effects: [{ target: 'mat:rat_hide', mult: 0.4 }, { target: 'mat:bone', mult: 0.6 }], days: [2, 4], weight: 1 },
  { id: 'dragon_sighting', name: 'Dragon Sighting', description: 'Something enormous flew over the hills.', effects: [{ target: 'mat:dragon_scale', mult: 2 }, { target: 'mat:wyrm_leather', mult: 1.5 }, { target: 'mat:flame_shard', mult: 1.4 }], days: [3, 5], weight: 1 },
  { id: 'arcane_study', name: 'Arcane Study', description: 'The academy wants tomes and crystal.', effects: [{ target: 'mat:ancient_tome', mult: 1.8 }, { target: 'mat:crystal', mult: 1.6 }, { target: 'mat:moonstone', mult: 1.4 }], days: [3, 4], weight: 2 },
  { id: 'forge_fire', name: 'The Great Forge Burns', description: 'The city forge burned. Every smith needs timber.', effects: [{ target: 'cat:wood', mult: 1.7 }], days: [2, 4], weight: 2 },
];

export function marketEvent(id: string): MarketEventDef {
  const e = MARKET_EVENTS.find((ev) => ev.id === id);
  if (!e) throw new Error(`unknown market event ${id}`);
  return e;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface CommodityState {
  price: number;
  /** Units the player has dumped recently; depresses price, decays daily. */
  supply: number;
  stock: number;
  history: number[];
}

export interface ActiveEvent {
  id: string;
  daysLeft: number;
}

export interface MarketState {
  day: number;
  commodities: Record<string, CommodityState>;
  sentiment: Record<ItemCategory, number>;
  sentimentHistory: Record<ItemCategory, number[]>;
  events: ActiveEvent[];
  /** Event that will start tomorrow (visible with Market Insider L2). */
  upcoming: string | null;
  /** Items the merchant sells today. */
  wares: Item[];
  news: string[];
}

const HISTORY_DAYS = 30;
const STOCK_TARGET: Record<Rarity, number> = {
  [Rarity.Common]: 40,
  [Rarity.Uncommon]: 14,
  [Rarity.Rare]: 5,
  [Rarity.Epic]: 2,
  [Rarity.Legendary]: 0,
};

export function createMarket(rng: Rng, ranks: RecipeRanks = {}): MarketState {
  const commodities: Record<string, CommodityState> = {};
  for (const m of MATERIALS) {
    const p = Math.max(1, Math.round(m.value * rng.float(0.85, 1.15)));
    commodities[m.id] = { price: p, supply: 0, stock: materialAvailableAtDepth(m, 1) ? STOCK_TARGET[m.rarity] : 0, history: [p] };
  }
  const market: MarketState = {
    day: 1,
    commodities,
    sentiment: { weapon: 1, armor: 1, jewelry: 1 },
    sentimentHistory: { weapon: [1], armor: [1], jewelry: [1] },
    events: [],
    upcoming: null,
    wares: [],
    news: ['The market square is busy this morning.'],
  };
  restockWares(market, rng, 1, ranks);
  return market;
}

export function eventMultiplier(m: MarketState, target: { materialId?: string; category?: ItemCategory }): number {
  let mult = 1;
  const cat = target.materialId ? material(target.materialId).category : null;
  for (const ev of m.events) {
    for (const eff of marketEvent(ev.id).effects) {
      if (target.materialId && (eff.target === `mat:${target.materialId}` || eff.target === `cat:${cat}`)) mult *= eff.mult;
      if (target.category && eff.target === `item:${target.category}`) mult *= eff.mult;
    }
  }
  return mult;
}

function gauss(rng: Rng): number {
  // Box–Muller.
  const u = Math.max(1e-9, rng.next());
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Advance one day: prices mean-revert toward their (event-adjusted,
 * supply-depressed) fair value with noise; events tick; stock restocks.
 */
export function advanceDay(m: MarketState, rng: Rng, bestDepth = 1, ranks: RecipeRanks = {}): void {
  m.day += 1;
  m.news = [];

  // Events: tick down, start the forecast one, maybe forecast another.
  for (const ev of m.events) ev.daysLeft -= 1;
  const ended = m.events.filter((ev) => ev.daysLeft <= 0);
  for (const ev of ended) m.news.push(`${marketEvent(ev.id).name} is over.`);
  m.events = m.events.filter((ev) => ev.daysLeft > 0);
  if (m.upcoming) {
    const def = marketEvent(m.upcoming);
    m.events.push({ id: def.id, daysLeft: rng.int(def.days[0], def.days[1]) });
    m.news.push(`${def.name}: ${def.description}`);
    m.upcoming = null;
  }
  if (m.events.length < 2 && rng.chance(0.4)) {
    const pool = MARKET_EVENTS.filter((e) => !m.events.some((a) => a.id === e.id));
    if (pool.length) m.upcoming = rng.weighted(pool.map((e) => [e.id, e.weight] as const));
  }

  for (const mat of MATERIALS) {
    const c = m.commodities[mat.id];
    c.supply *= 0.55;
    const fair = (mat.value * eventMultiplier(m, { materialId: mat.id })) / (1 + c.supply * 0.05);
    const vol = 0.06 + RARITY_ORDER[mat.rarity] * 0.015;
    let next = c.price + 0.38 * (fair - c.price) + c.price * vol * gauss(rng);
    next = Math.max(mat.value * 0.25, Math.min(mat.value * 4, next));
    c.price = Math.max(1, Math.round(next));
    c.history.push(c.price);
    if (c.history.length > HISTORY_DAYS) c.history.shift();
    const target = materialAvailableAtDepth(mat, bestDepth) ? STOCK_TARGET[mat.rarity] : 0;
    if (c.stock < target) c.stock = Math.min(target, c.stock + Math.ceil(target * rng.float(0.3, 0.7)));
  }

  for (const cat of ['weapon', 'armor', 'jewelry'] as ItemCategory[]) {
    const fair = eventMultiplier(m, { category: cat });
    let s = m.sentiment[cat];
    s += 0.4 * (fair - s) + 0.05 * gauss(rng);
    m.sentiment[cat] = Math.max(0.5, Math.min(2.2, Math.round(s * 100) / 100));
    m.sentimentHistory[cat].push(m.sentiment[cat]);
    if (m.sentimentHistory[cat].length > HISTORY_DAYS) m.sentimentHistory[cat].shift();
  }

  restockWares(m, rng, bestDepth, ranks);
  if (m.news.length === 0) m.news.push(rng.pick(QUIET_NEWS));
}

const QUIET_NEWS = [
  'A quiet day in the square.',
  'Merchants grumble about the weather.',
  'The fishmonger and the smith are feuding again.',
  'Pilgrims pass through, buying little.',
  'Rumours of a new tunnel under the old crypt.',
];

function restockWares(m: MarketState, rng: Rng, bestDepth: number, ranks: RecipeRanks): void {
  const wares: Item[] = [];
  const depth = Math.max(1, Math.min(6, bestDepth));
  for (let i = 0; i < 6; i++) {
    const bands: [Rarity, number][] = [
      [Rarity.Common, 60],
      [Rarity.Uncommon, 30],
      [Rarity.Rare, 9],
      [Rarity.Epic, 1],
    ];
    const r = rng.weighted<Rarity>(bands.filter(([rarity]) => rarityAvailableAtDepth(rarity, depth)));
    wares.push(rollEquipment(rng, depth, 0, { rarity: r, identifyBelow: Rarity.Legendary }));
  }
  const blueprints = new Set<string>();
  for (let i = 0; i < 2; i++) wares.push(rollBlueprint(rng, depth, ranks, blueprints));
  m.wares = wares;
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

/** Price impact of trading one unit: thinner markets for rarer goods. */
function impact(id: string): number {
  return 0.012 * (1 + RARITY_ORDER[material(id).rarity]);
}

export function commodityBuyPrice(m: MarketState, id: string, haggle: number): number {
  return Math.max(1, Math.ceil(m.commodities[id].price * (1.15 - 0.04 * haggle)));
}

export function commoditySellPrice(m: MarketState, id: string, haggle: number): number {
  return Math.max(1, Math.floor(m.commodities[id].price * (0.8 + 0.04 * haggle)));
}

/** Sell `qty` units with slippage; returns total gold. */
export function sellCommodity(m: MarketState, id: string, qty: number, haggle: number): number {
  let gold = 0;
  const c = m.commodities[id];
  for (let i = 0; i < qty; i++) {
    gold += commoditySellPrice(m, id, haggle);
    c.price = Math.max(1, c.price * (1 - impact(id)));
    c.supply += 1;
    c.stock += 1;
  }
  c.price = Math.max(1, Math.round(c.price));
  return gold;
}

/** Preview the gold from selling `qty` units, without mutating. */
export function quoteSell(m: MarketState, id: string, qty: number, haggle: number): number {
  const saved = { ...m.commodities[id] };
  const gold = sellCommodity(m, id, qty, haggle);
  m.commodities[id] = saved;
  return gold;
}

/** Buy up to `qty` units; returns units bought and cost, or null if unaffordable/no stock. */
export function buyCommodity(m: MarketState, id: string, qty: number, haggle: number, gold: number): { qty: number; cost: number } | null {
  const c = m.commodities[id];
  let cost = 0;
  let n = 0;
  while (n < qty && c.stock > 0) {
    const p = commodityBuyPrice(m, id, haggle);
    if (cost + p > gold) break;
    cost += p;
    n++;
    c.stock -= 1;
    c.price = c.price * (1 + impact(id));
  }
  c.price = Math.max(1, Math.round(c.price));
  return n > 0 ? { qty: n, cost } : null;
}

export function itemSellPrice(m: MarketState, item: Item, haggle: number): number {
  if (item.kind === 'material') return commoditySellPrice(m, item.ref, haggle);
  const cat = itemCategory(item);
  const sentiment = cat ? m.sentiment[cat] : 1;
  const idMult = isIdentified(item) ? 1 : 0.45;
  const ratio = item.kind === 'equipment' ? 0.5 : 0.6;
  // A buyer can see the state of it. Repair cost still uses the sound value, so
  // mending something is never cheaper than letting it rot.
  const d = durability(item);
  const wearMult = d.wears ? 0.45 + 0.55 * d.frac : 1;
  return Math.max(1, Math.floor(itemValue(item) * sentiment * idMult * wearMult * (ratio + 0.04 * haggle)));
}

export function itemBuyPrice(m: MarketState, item: Item, haggle: number): number {
  const cat = itemCategory(item);
  const sentiment = cat ? m.sentiment[cat] : 1;
  return Math.max(1, Math.ceil(itemValue(item) * sentiment * (1.35 - 0.04 * haggle)));
}

/**
 * Consumables the merchant always has.
 *
 * Tonics are excluded, because a tonic is a relic you drink: found-only is the
 * whole point of it, and a shop that sells Fight Milk for 504 gold turns the
 * rarest consumable in the game into a purchase. Derived from `tonicUnique`
 * rather than an id check, so the next tonic added is excluded for free.
 */
export const SHOP_CONSUMABLES = CONSUMABLES.filter((c) => !tonicUnique(c.id)).map((c) => c.id);

export function trendPercent(history: number[], days = 5): number {
  if (history.length < 2) return 0;
  const from = history[Math.max(0, history.length - 1 - days)];
  const to = history[history.length - 1];
  return from > 0 ? Math.round(((to - from) / from) * 100) : 0;
}
