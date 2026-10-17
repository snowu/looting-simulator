/*
 * The entry point for `npm run playtest:career`.
 *
 * Every other bench starts a character, plays one delve and throws the save
 * away, so nothing that happens in town has ever been measured: the market,
 * repairs, identification, contracts and the renown tree were balanced by
 * reasoning alone. This one keeps the save. A fresh Hard character plays
 * delve after delve, and between them a scripted townsperson does the dull,
 * sensible thing:
 *
 *   1. turns in finished contracts and takes new ones, up to the limit
 *   2. identifies gear when that pays: when the sale gains more than the fee,
 *      or when it might beat what is worn
 *   3. wears anything worth more than what is in that slot (same kit shape:
 *      one-handed weapon, offhand, armour; no two-handers, belts or conduits)
 *   4. sells every other piece of gear and every material the contracts do
 *      not want, at the market's price on the day
 *   5. repairs what it wears, worst first, while it can pay
 *   6. tempers the flask when it can, then buys any merchant piece that is
 *      worth more than what it wears in that slot
 *   7. trains the cheapest renown upgrade it can afford, until it cannot
 *
 * It aims one floor past its best and turns back when hurt, as the careful
 * bot always does. It never crafts, never buys consumables and never swears
 * an oath, so read gold as a floor on what a person banks and the delve
 * counts as a ceiling on how long the tree takes.
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { playDelve, Policy, DEFAULT_POLICY, RunReport } from './playtest';
import { createRng } from '../src/core/rng';
import { newGame, GameState } from '../src/state/game-state';
import { META_UPGRADES, haggleLevel, metaLevel, nextCost } from '../src/systems/meta';
import { endRun } from '../src/systems/run';
import { itemBuyPrice, itemSellPrice, sellCommodity } from '../src/systems/market';
import { FLASK_UPGRADE_COSTS } from '../src/systems/healing';
import { identify, identifyCost, isTwoHanded, itemValue, repairCost, repairItem } from '../src/systems/items';
import { equipFrom, wornFor } from '../src/systems/equip';
import { addItem, removeItem, removeOf, countOf } from '../src/state/inventory';
import { gearCandidates, isComplete, MAX_ACCEPTED } from '../src/systems/contracts';
import { itemBase } from '../src/data/items';
import { Item } from '../src/types';

const OUT = process.env.PLAYTEST_OUT ?? 'playtest-career.txt';
const CAREERS = Number(process.env.PLAYTEST_RUNS ?? 8);
const DELVES = Number(process.env.CAREER_DELVES ?? 40);
const SEED = 41000;
const TREE = META_UPGRADES.reduce((sum, u) => sum + u.costs.reduce((a, b) => a + b, 0), 0);

/** The careful bot from balance.bench.ts. */
const CAREFUL: Partial<Policy> = { parrySkill: 0.55, drinkAt: 0.6, fleeAt: 0.45 };

interface Ledger {
  sold: number;
  repairs: number;
  identify: number;
  bought: number;
  contracts: number;
  contractRenown: number;
  trained: number;
}

interface DelveRow {
  report: RunReport;
  ledger: Ledger;
  gold: number;
  renownEarned: number;
  treeSpent: number;
  kitValue: number;
}

const KIT = ['weapon', 'offhand', 'head', 'body', 'hands', 'ring1', 'ring2', 'amulet'] as const;

/** Gear the townsperson would wear: the kit it already has the shape of. */
function wearable(it: Item): boolean {
  if (it.kind !== 'equipment' || isTwoHanded(it)) return false;
  const base = itemBase(it.ref);
  return base.slot !== 'thrown' && !base.conduit;
}

function town(s: GameState): Ledger {
  const l: Ledger = { sold: 0, repairs: 0, identify: 0, bought: 0, contracts: 0, contractRenown: 0, trained: 0 };
  const hag = haggleLevel(s.meta);

  // 1. Contracts: hand in what is done, then take what is posted.
  for (const c of [...s.contracts]) {
    if (!c.accepted || !isComplete(c, s.stash)) continue;
    if (c.kind === 'deliver') removeOf(s.stash, 'material', c.materialId!, c.qty!);
    if (c.kind === 'gear') removeItem(s.stash, gearCandidates(c, s.stash)[0].uid);
    s.gold += c.reward.gold;
    s.renown += c.reward.renown;
    l.contracts += c.reward.gold;
    l.contractRenown += c.reward.renown;
    s.contracts = s.contracts.filter((x) => x !== c);
  }
  for (const c of s.contracts) if (!c.accepted && s.contracts.filter((x) => x.accepted).length < MAX_ACCEPTED) c.accepted = true;

  // 2. Identify when it pays, or when the piece might be an upgrade.
  for (const it of s.stash.items) {
    if (it.kind !== 'equipment' || it.identified !== false) continue;
    const fee = identifyCost(it, metaLevel(s.meta, 'appraiser'));
    if (fee > s.gold) continue;
    const blind = itemSellPrice(s.market, it, hag);
    const worn = wornFor(it, s.equipment);
    const known = { ...it, identified: true };
    const gain = itemSellPrice(s.market, known, hag) - blind;
    if (gain > fee || (wearable(it) && itemValue(known) > (worn ? itemValue(worn) : 0))) {
      s.gold -= fee;
      l.identify += fee;
      identify(it);
    }
  }

  // 3. Wear the best of each slot.
  for (const it of [...s.stash.items]) {
    if (!wearable(it) || it.identified === false) continue;
    const worn = wornFor(it, s.equipment);
    if (worn && itemValue(worn) >= itemValue(it)) continue;
    equipFrom(s.equipment, s.stash, it.uid);
  }

  // 4. Sell the rest: gear, and materials no accepted delivery wants.
  for (const it of [...s.stash.items]) {
    if (it.kind === 'equipment') {
      if (s.contracts.some((c) => c.accepted && c.kind === 'gear' && gearCandidates(c, s.stash).some((g) => g.uid === it.uid))) continue;
      const price = itemSellPrice(s.market, it, hag) * it.qty;
      removeItem(s.stash, it.uid);
      s.gold += price;
      l.sold += price;
    }
  }
  const mats = [...new Set(s.stash.items.filter((it) => it.kind === 'material').map((it) => it.ref))];
  for (const id of mats) {
    const owed = s.contracts.filter((c) => c.accepted && c.kind === 'deliver' && c.materialId === id).reduce((n, c) => n + (c.qty ?? 0), 0);
    const qty = countOf(s.stash, 'material', id) - owed;
    if (qty <= 0 || !removeOf(s.stash, 'material', id, qty)) continue;
    const g = sellCommodity(s.market, id, qty, hag);
    s.gold += g;
    l.sold += g;
  }

  // 5. Mend what is worn, worst first.
  const worn = KIT.map((k) => s.equipment[k]).filter((it): it is Item => !!it && repairCost(it) > 0)
    .sort((a, b) => repairCost(b) - repairCost(a));
  for (const it of worn) {
    const cost = repairCost(it);
    if (cost > s.gold) continue;
    s.gold -= cost;
    l.repairs += cost;
    repairItem(it);
  }

  // 6. Spend: the flask first, then the merchant's gear that beats the kit.
  const potency = s.flask?.potency ?? 0;
  if (potency < FLASK_UPGRADE_COSTS.length && s.gold >= FLASK_UPGRADE_COSTS[potency]) {
    s.gold -= FLASK_UPGRADE_COSTS[potency];
    l.bought += FLASK_UPGRADE_COSTS[potency];
    s.flask.potency = potency + 1;
  }
  for (const it of [...s.market.wares]) {
    if (!wearable(it) || it.identified === false) continue;
    const worn = wornFor(it, s.equipment);
    const price = itemBuyPrice(s.market, it, hag);
    if (price > s.gold || (worn && itemValue(worn) >= itemValue(it))) continue;
    s.gold -= price;
    l.bought += price;
    s.market.wares = s.market.wares.filter((w) => w !== it);
    addItem(s.stash, it);
    equipFrom(s.equipment, s.stash, it.uid);
  }

  // 7. Train the cheapest upgrade going, until nothing is affordable.
  for (;;) {
    const next = META_UPGRADES.map((u) => ({ u, cost: nextCost(u, s.meta) }))
      .filter((x): x is { u: typeof x.u; cost: number } => x.cost !== null && x.cost <= s.renown)
      .sort((a, b) => a.cost - b.cost)[0];
    if (!next) break;
    s.renown -= next.cost;
    s.meta[next.u.id] = metaLevel(s.meta, next.u.id) + 1;
    l.trained += next.cost;
  }
  return l;
}

function career(seed: number): DelveRow[] {
  const s = newGame(createRng(seed));
  s.difficulty = 'hard';
  s.saveId = `career-${seed}`;
  const rows: DelveRow[] = [];
  let renownEarned = 0, treeSpent = 0;
  for (let d = 0; d < DELVES; d++) {
    const best = Math.max(1, s.lifetime.bestDepth);
    const policy: Policy = { ...DEFAULT_POLICY, ...CAREFUL, targetDepth: Math.min(6, best + 1) };
    const before = s.renown;
    const report = playDelve(s, seed + d * 104729, policy);
    // A timeout is the bot stuck, not the player beaten; settle it as a death
    // so the save can go on, and let the report say how many there were.
    if (s.run) endRun(s, 'dead');
    const ledger = town(s);
    renownEarned += s.renown + ledger.trained - before;
    treeSpent += ledger.trained;
    const kitValue = KIT.reduce((n, k) => n + (s.equipment[k] ? itemValue(s.equipment[k]!) : 0), 0);
    rows.push({ report, ledger, gold: s.gold, renownEarned, treeSpent, kitValue });
  }
  return rows;
}

it('career report', () => {
  const careers: DelveRow[][] = [];
  for (let i = 0; i < CAREERS; i++) careers.push(career(SEED + i * 7919));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const pct = (n: number, of: number) => `${Math.round((n / Math.max(1, of)) * 100)}%`;
  const L: string[] = [];
  L.push(`=== career: ${CAREERS} fresh Hard characters, ${DELVES} delves each, careful bot, one floor past its best ===`);
  L.push('Town between delves: contracts, identify when it pays, wear the best, sell the rest, repair, temper the flask, buy better gear, train the cheapest upgrade.');
  L.push('Never crafts, never buys consumables, never swears an oath. Gold is a floor on what a person banks; delves are a ceiling on how long things take.');
  L.push('');
  L.push('delves  died  deepest  banked/delve  sold/delve  repairs  identify   bought  contracts  renown/delve  gold held  tree bought  kit value');
  const STEP = 5;
  for (let from = 0; from < DELVES; from += STEP) {
    const rows = careers.flatMap((c) => c.slice(from, from + STEP));
    const last = careers.map((c) => c[Math.min(c.length - 1, from + STEP - 1)]);
    const per = (f: (r: DelveRow) => number) => avg(rows.map(f)).toFixed(0).padStart(6);
    const renown = avg(rows.map((r) => r.report.renown + r.ledger.contractRenown));
    L.push([
      `${String(from + 1).padStart(2)}–${String(Math.min(DELVES, from + STEP)).padEnd(2)}`,
      pct(rows.filter((r) => r.report.outcome !== 'extracted').length, rows.length).padStart(6),
      avg(rows.map((r) => r.report.deepest)).toFixed(2).padStart(8),
      per((r) => r.report.gold).padStart(13),
      per((r) => r.ledger.sold).padStart(11),
      per((r) => r.ledger.repairs).padStart(8),
      per((r) => r.ledger.identify).padStart(9),
      per((r) => r.ledger.bought).padStart(8),
      per((r) => r.ledger.contracts).padStart(10),
      renown.toFixed(1).padStart(13),
      avg(last.map((r) => r.gold)).toFixed(0).padStart(10),
      `${avg(last.map((r) => r.treeSpent)).toFixed(0)}/${TREE}`.padStart(12),
      avg(last.map((r) => r.kitValue)).toFixed(0).padStart(10),
    ].join(' '));
  }
  L.push('');
  const whole = careers.map((c) => c.findIndex((r) => r.treeSpent >= TREE));
  L.push(`whole tree (${TREE} renown) bought: ${whole.filter((i) => i >= 0).length}/${CAREERS} careers` +
    (whole.some((i) => i >= 0) ? `, after ${whole.filter((i) => i >= 0).map((i) => i + 1).join(', ')} delves` : '') +
    `; renown earned by the end: ${avg(careers.map((c) => c[c.length - 1].renownEarned)).toFixed(0)} on average`);
  const kings = careers.map((c) => c.findIndex((r) => r.report.bossKilled));
  L.push(`first King kill: ${kings.filter((i) => i >= 0).length}/${CAREERS} careers` + (kings.some((i) => i >= 0) ? `, on delve ${kings.filter((i) => i >= 0).map((i) => i + 1).join(', ')}` : ''));
  const all = careers.flat();
  const timeouts = all.filter((r) => r.report.outcome === 'timeout').length;
  if (timeouts) L.push(`!! ${timeouts} of ${all.length} delves timed out (the bot stuck) and were settled as deaths.`);
  writeFileSync(OUT, L.join('\n') + '\n');
});
