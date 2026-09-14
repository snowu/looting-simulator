/*
 * Static balance tables. These do not play the game — they read the data files
 * and the combat maths directly, which makes them fast enough to run after every
 * single knob change, and exact rather than sampled.
 *
 * Three questions, which are the three the balance pass is actually about:
 *   composition — how much stuff is on a floor
 *   yield       — what that stuff pays out
 *   weapons     — every base on one ladder, so a new one can be placed
 *   matchups    — how long a fight lasts at each gear tier, both ways
 */
import { createRng } from '../src/core/rng';
import { generateFloor } from '../src/systems/dungeon';
import { ENEMIES, enemyDef } from '../src/data/enemies';
import { rollContainerLoot, rollEnemyLoot, itemValue, makeEquipment, ContainerTier } from '../src/systems/items';
import { ITEM_BASES } from '../src/data/items';
import { MATERIALS } from '../src/data/materials';
import { AffixRoll, Item, Rarity, RARITY_ORDER } from '../src/types';
import { derivePlayer, emptyEquipment, Equipment, thrownView } from '../src/systems/player';
import { playerHitsEnemy, enemyHitsPlayer } from '../src/systems/combat';
import { depthPower, attackPower, defensePower } from '../src/systems/dungeon';

const SAMPLES = 60;
const f2 = (n: number) => n.toFixed(2);
const f1 = (n: number) => n.toFixed(1);

export function composition(): string {
  const L = ['--- floor composition (avg over ' + SAMPLES + ' seeds) ---'];
  for (let depth = 1; depth <= 6; depth++) {
    let rooms = 0, enemies = 0, chest = 0, urn = 0, vault = 0, secret = 0, loose = 0, traps = 0;
    for (let r = 0; r < SAMPLES; r++) {
      const f = generateFloor(1000 + r, depth);
      rooms += f.rooms.length; enemies += f.enemies.length; traps += f.traps.length; loose += f.pickups.length;
      for (const p of f.props) {
        if (p.tier === 'chest') chest++;
        else if (p.tier === 'urn') urn++;
        else if (p.tier === 'vault') vault++;
        else if (p.tier === 'secret') secret++;
      }
    }
    L.push(`D${depth}: rooms=${f1(rooms / SAMPLES)} enemies=${f1(enemies / SAMPLES)} chest=${f2(chest / SAMPLES)} urn=${f2(urn / SAMPLES)} vault=${f2(vault / SAMPLES)} secret=${f2(secret / SAMPLES)} loose=${f2(loose / SAMPLES)} traps=${f1(traps / SAMPLES)}`);
  }
  return L.join('\n');
}

export function yields(find = 0): string {
  const L = [`--- loot yield per floor (find=${find}, avg over ${SAMPLES} seeds) ---`];
  for (let depth = 1; depth <= 6; depth++) {
    let gold = 0, items = 0, gear = 0, value = 0, bp = 0, cons = 0;
    const rar = [0, 0, 0, 0, 0];
    for (let r = 0; r < SAMPLES; r++) {
      const f = generateFloor(2000 + r, depth);
      const rng = createRng(9000 + r);
      const take = (l: { items: Item[]; gold: number }) => {
        gold += l.gold; items += l.items.length;
        for (const it of l.items) {
          value += itemValue(it) * it.qty;
          if (it.kind === 'equipment') { gear++; rar[RARITY_ORDER[it.rarity ?? Rarity.Common]]++; }
          if (it.kind === 'blueprint') bp++;
          if (it.kind === 'consumable') cons++;
        }
      };
      for (const p of f.props) if (p.tier !== 'none') take(rollContainerLoot(rng, depth, find, p.tier as ContainerTier));
      for (const e of f.enemies) take(rollEnemyLoot(rng, enemyDef(e.def), depth, find));
      for (const pk of f.pickups) { gold += pk.gold; items += pk.items.length; for (const it of pk.items) value += itemValue(it) * it.qty; }
    }
    L.push(`D${depth}: gold=${f1(gold / SAMPLES)} items=${f1(items / SAMPLES)} gear=${f2(gear / SAMPLES)} bp=${f2(bp / SAMPLES)} cons=${f2(cons / SAMPLES)} value=${f1(value / SAMPLES)} [C,U,R,E,L]=${rar.map((x) => f2(x / SAMPLES)).join(',')}`);
  }
  return L.join('\n');
}

const aff = (id: string, value: number): AffixRoll => ({ id, value });

export const LOADOUTS: [string, () => Equipment][] = [
  ['naked', () => emptyEquipment()],
  ['starter (timber club, ratskin jerkin)', () => {
    const e = emptyEquipment();
    e.weapon = makeEquipment({ baseId: 'club', materialId: 'timber', rarity: Rarity.Common, ilvl: 2 });
    e.body = makeEquipment({ baseId: 'jerkin', materialId: 'rat_hide', rarity: Rarity.Common, ilvl: 2 });
    return e;
  }],
  ['mid (iron Rare kit)', () => {
    const e = emptyEquipment();
    e.weapon = makeEquipment({ baseId: 'long_sword', materialId: 'iron', rarity: Rarity.Rare, ilvl: 8, affixes: [aff('sharp', 6)] });
    e.body = makeEquipment({ baseId: 'hauberk', materialId: 'iron', rarity: Rarity.Uncommon, ilvl: 8 });
    e.head = makeEquipment({ baseId: 'helm', materialId: 'iron', rarity: Rarity.Common, ilvl: 8 });
    e.offhand = makeEquipment({ baseId: 'kite_shield', materialId: 'iron', rarity: Rarity.Common, ilvl: 8 });
    return e;
  }],
  ['deep (moonsilver Epic kit)', () => {
    const e = emptyEquipment();
    e.weapon = makeEquipment({ baseId: 'war_axe', materialId: 'moonsilver', rarity: Rarity.Epic, ilvl: 14, affixes: [aff('sharp', 12)] });
    e.body = makeEquipment({ baseId: 'plate', materialId: 'moonsilver', rarity: Rarity.Rare, ilvl: 14 });
    e.head = makeEquipment({ baseId: 'great_helm', materialId: 'moonsilver', rarity: Rarity.Rare, ilvl: 14 });
    e.offhand = makeEquipment({ baseId: 'tower_shield', materialId: 'moonsilver', rarity: Rarity.Rare, ilvl: 14 });
    return e;
  }],
  // The same kit with the shield traded for both hands on the weapon. Every
  // other loadout here carries an offhand, so nothing in this file could see
  // what a two-hander actually costs: the weapon roster compares bases with no
  // armour at all, and `ttd` is where the empty offhand shows up.
  ['deep 2H (moonsilver maul, no shield)', () => {
    const e = emptyEquipment();
    e.weapon = makeEquipment({ baseId: 'great_maul', materialId: 'moonsilver', rarity: Rarity.Epic, ilvl: 14, affixes: [aff('sharp', 12)] });
    e.body = makeEquipment({ baseId: 'plate', materialId: 'moonsilver', rarity: Rarity.Rare, ilvl: 14 });
    e.head = makeEquipment({ baseId: 'great_helm', materialId: 'moonsilver', rarity: Rarity.Rare, ilvl: 14 });
    return e;
  }],
  ['best (star-iron Epic kit)', () => {
    const e = emptyEquipment();
    e.weapon = makeEquipment({ baseId: 'war_axe', materialId: 'star_iron', rarity: Rarity.Epic, ilvl: 16, affixes: [aff('sharp', 14)] });
    e.body = makeEquipment({ baseId: 'plate', materialId: 'star_iron', rarity: Rarity.Epic, ilvl: 16 });
    e.head = makeEquipment({ baseId: 'great_helm', materialId: 'star_iron', rarity: Rarity.Epic, ilvl: 16 });
    e.offhand = makeEquipment({ baseId: 'tower_shield', materialId: 'star_iron', rarity: Rarity.Epic, ilvl: 16 });
    e.hands = makeEquipment({ baseId: 'gauntlets', materialId: 'star_iron', rarity: Rarity.Rare, ilvl: 16 });
    e.ring1 = makeEquipment({ baseId: 'band', materialId: 'star_iron', rarity: Rarity.Rare, ilvl: 16 });
    e.ring2 = makeEquipment({ baseId: 'band', materialId: 'star_iron', rarity: Rarity.Rare, ilvl: 16 });
    e.amulet = makeEquipment({ baseId: 'pendant', materialId: 'star_iron', rarity: Rarity.Rare, ilvl: 16 });
    return e;
  }],
];

/**
 * The gear a player who is doing well actually has when they arrive on each
 * floor. This is the ladder the difficulty curve has to be read against: the
 * fixed loadouts above answer "what if you are over- or under-geared", and this
 * one answers "is the intended experience right", which is the real question.
 */
export const LADDER: { depth: number; name: string; make: () => Equipment }[] = [
  { depth: 1, name: 'timber club, ratskin jerkin', make: () => {
    const e = emptyEquipment();
    e.weapon = makeEquipment({ baseId: 'club', materialId: 'timber', rarity: Rarity.Common, ilvl: 2 });
    e.body = makeEquipment({ baseId: 'jerkin', materialId: 'rat_hide', rarity: Rarity.Common, ilvl: 2 });
    return e;
  } },
  { depth: 2, name: 'copper mace, leather, buckler', make: () => {
    const e = emptyEquipment();
    e.weapon = makeEquipment({ baseId: 'mace', materialId: 'copper', rarity: Rarity.Uncommon, ilvl: 4, affixes: [aff('sharp', 3)] });
    e.body = makeEquipment({ baseId: 'jerkin', materialId: 'leather', rarity: Rarity.Common, ilvl: 4 });
    e.head = makeEquipment({ baseId: 'cap', materialId: 'leather', rarity: Rarity.Common, ilvl: 4 });
    e.offhand = makeEquipment({ baseId: 'buckler', materialId: 'timber', rarity: Rarity.Common, ilvl: 4 });
    return e;
  } },
  { depth: 3, name: 'iron long sword, iron mail', make: () => {
    const e = emptyEquipment();
    e.weapon = makeEquipment({ baseId: 'long_sword', materialId: 'iron', rarity: Rarity.Uncommon, ilvl: 6, affixes: [aff('sharp', 4)] });
    e.body = makeEquipment({ baseId: 'hauberk', materialId: 'iron', rarity: Rarity.Common, ilvl: 6 });
    e.head = makeEquipment({ baseId: 'helm', materialId: 'iron', rarity: Rarity.Common, ilvl: 6 });
    e.offhand = makeEquipment({ baseId: 'kite_shield', materialId: 'iron', rarity: Rarity.Common, ilvl: 6 });
    return e;
  } },
  { depth: 4, name: 'iron war axe, Rare iron kit', make: () => {
    const e = emptyEquipment();
    e.weapon = makeEquipment({ baseId: 'war_axe', materialId: 'iron', rarity: Rarity.Rare, ilvl: 9, affixes: [aff('sharp', 6), aff('swiftness', 8)] });
    e.body = makeEquipment({ baseId: 'hauberk', materialId: 'iron', rarity: Rarity.Uncommon, ilvl: 9, affixes: [aff('sturdy', 4)] });
    e.head = makeEquipment({ baseId: 'helm', materialId: 'iron', rarity: Rarity.Uncommon, ilvl: 9 });
    e.offhand = makeEquipment({ baseId: 'kite_shield', materialId: 'iron', rarity: Rarity.Uncommon, ilvl: 9 });
    return e;
  } },
  { depth: 5, name: 'silver war axe, silver plate', make: () => {
    const e = emptyEquipment();
    e.weapon = makeEquipment({ baseId: 'war_axe', materialId: 'silver', rarity: Rarity.Rare, ilvl: 11, affixes: [aff('brutal', 9), aff('swiftness', 9)] });
    e.body = makeEquipment({ baseId: 'plate', materialId: 'silver', rarity: Rarity.Rare, ilvl: 11, affixes: [aff('sturdy', 6)] });
    e.head = makeEquipment({ baseId: 'great_helm', materialId: 'silver', rarity: Rarity.Uncommon, ilvl: 11 });
    e.offhand = makeEquipment({ baseId: 'tower_shield', materialId: 'silver', rarity: Rarity.Uncommon, ilvl: 11 });
    return e;
  } },
  { depth: 6, name: 'moonsilver war axe, moonsilver plate', make: () => {
    const e = emptyEquipment();
    e.weapon = makeEquipment({ baseId: 'war_axe', materialId: 'moonsilver', rarity: Rarity.Epic, ilvl: 14, affixes: [aff('brutal', 12), aff('swiftness', 10)] });
    e.body = makeEquipment({ baseId: 'plate', materialId: 'moonsilver', rarity: Rarity.Rare, ilvl: 14, affixes: [aff('sturdy', 8)] });
    e.head = makeEquipment({ baseId: 'great_helm', materialId: 'moonsilver', rarity: Rarity.Rare, ilvl: 14 });
    e.offhand = makeEquipment({ baseId: 'tower_shield', materialId: 'moonsilver', rarity: Rarity.Rare, ilvl: 14 });
    e.hands = makeEquipment({ baseId: 'gauntlets', materialId: 'moonsilver', rarity: Rarity.Uncommon, ilvl: 14 });
    return e;
  } },
];

/** Renown levels a player plausibly holds by the time they reach each depth. */
const LADDER_META: Record<number, Record<string, number>> = {
  1: {}, 2: { toughness: 1 }, 3: { toughness: 2, endurance: 1 },
  4: { toughness: 3, endurance: 1 }, 5: { toughness: 4, endurance: 2 }, 6: { toughness: 5, endurance: 3 },
};

/**
 * The headline table. For each floor, the enemies native to it, fought by a
 * player carrying what that floor is supposed to have given them.
 */
export function ladder(): string {
  const L = ['--- the ladder: each floor against the gear it is meant to be reached with ---'];
  const rng = createRng(11);
  const N = 800;
  for (const rung of LADDER) {
    const d = derivePlayer(rung.make(), LADDER_META[rung.depth] ?? {});
    const cycle = d.swing.windup + d.swing.recovery;
    L.push(`D${rung.depth} — ${rung.name}: hp=${d.maxHp} atk=${d.attack} def=${d.stats.defense} sta=${d.maxStamina} cycle=${f2(cycle)}s`);
    for (const def of ENEMIES) {
      if (def.minDepth > rung.depth || def.maxDepth < rung.depth) continue;
      const power = depthPower(def, rung.depth);
      const hp = Math.round(def.hp * power);
      let dmg = 0, edmg = 0;
      for (let i = 0; i < N; i++) dmg += playerHitsEnemy(rng, d, 1, def, defensePower(power)).damage;
      for (let i = 0; i < N; i++) edmg += enemyHitsPlayer(rng, def.attack * attackPower(power), def.damageType, d);
      const avg = dmg / N, eavg = edmg / N;
      const hits = Math.ceil(hp / Math.max(1, avg));
      const toDie = Math.ceil(d.maxHp / Math.max(1, eavg));
      L.push(`    ${def.id.padEnd(16)} hp=${String(hp).padStart(4)} you hit for ${String(f1(avg)).padStart(6)} -> ${String(hits).padStart(3)} hits (${String(f1(hits * cycle)).padStart(6)}s) | it hits for ${String(f1(eavg)).padStart(5)} -> ${String(toDie).padStart(3)} hits`);
    }
  }
  return L.join('\n');
}

/** Time to kill and time to die, for every enemy against every gear tier. */
export function matchups(): string {
  const L = ['--- matchups: ttk = seconds of unbroken swinging, ttd = seconds of unblocked hits ---'];
  const rng = createRng(7);
  const N = 600;
  for (const [name, mk] of LOADOUTS) {
    const d = derivePlayer(mk(), {});
    const cycle = d.swing.windup + d.swing.recovery;
    // Stamina is the real cap on sustained damage: you can only swing so long.
    const swingsPerBar = d.maxStamina / Math.max(1, d.swing.staminaCost);
    L.push(`${name}: hp=${d.maxHp} atk=${d.attack} def=${d.stats.defense} sta=${d.maxStamina} cycle=${f2(cycle)}s cost=${d.swing.staminaCost} swings/bar=${f1(swingsPerBar)}`);
    for (const def of ENEMIES) {
      const depth = Math.max(def.minDepth, 1);
      const power = depthPower(def, depth);
      const hp = Math.round(def.hp * power);
      let dmg = 0, edmg = 0;
      for (let i = 0; i < N; i++) dmg += playerHitsEnemy(rng, d, 1, def, defensePower(power)).damage;
      for (let i = 0; i < N; i++) edmg += enemyHitsPlayer(rng, def.attack * attackPower(power), def.damageType, d);
      const avg = dmg / N, eavg = edmg / N;
      const hits = Math.ceil(hp / Math.max(1, avg));
      const toDie = Math.ceil(d.maxHp / Math.max(1, eavg));
      L.push(`  ${def.id.padEnd(16)} d${depth} hp=${String(hp).padStart(4)} you=${String(f1(avg)).padStart(6)} x${String(hits).padStart(3)} ttk=${String(f1(hits * cycle)).padStart(6)}s | it=${String(f1(eavg)).padStart(5)} x${String(toDie).padStart(3)} ttd=${String(f1(toDie * (def.windup + def.recovery))).padStart(6)}s`);
    }
  }
  return L.join('\n');
}

/**
 * The caveat that belongs next to every hit-count in this file.
 *
 * These are computed, not played: full stamina on every swing, average rolls,
 * no dodging, no blocking, no parries, no telegraph read, and no second monster
 * joining in. They are player-optimistic in the player's favour on offence and
 * against them on defence, and they are a yardstick for comparing two builds —
 * never a prediction of how a real fight goes. The scripted runs below them are
 * where anything resembling a real session gets measured.
 */
const CAVEAT = [
  '--- NOTE: every number below is computed, not played ---',
  'Full stamina on every swing, average damage rolls, no dodging, no blocking, no',
  'parrying, no telegraph read, one monster at a time. Good for before/after',
  'comparison between two builds. Not a prediction of a real session.',
].join('\n');


/**
 * Every weapon base against every enemy, forged the same way, so the roster can
 * be read as one ladder.
 *
 * Each base is built at the best tier-3 material its own `primary` allows — the
 * point is to compare *bases*, so the material has to be held as constant as the
 * data permits — and swung by a player wearing nothing else. Damage is averaged
 * over the whole bestiary at each monster's home depth, which folds the damage
 * triangle in: a blunt weapon is measured against how undead the dungeon
 * actually is, not against a neutral dummy.
 *
 * `dps` is one unbroken cycle after another and ignores stamina. `bar` is the
 * damage one full stamina bar buys, which is the number that actually decides a
 * long fight, and the two disagree on purpose — that disagreement is the whole
 * point of having both blades and haft.
 *
 * Two-handers are marked `2H`: the comparison cannot see what they cost, which
 * is the offhand, so a two-hander leading on `dps` here is not evidence that it
 * is fine. The rule the roster is held to is that no two-hander beats the Long
 * Sword on `dps`.
 */
export function weapons(): string {
  const L = ['--- weapon roster: every base at tier 3, averaged over the whole bestiary ---'];
  const rng = createRng(23);
  const N = 400;
  const ILVL = 10;
  const rows: { line: string; dps: number; name: string }[] = [];
  for (const base of ITEM_BASES) {
    if (base.slot !== 'weapon' && base.slot !== 'thrown') continue;
    const mat = MATERIALS.filter((m) => base.primary.includes(m.category) && m.tier <= 3)
      .sort((a, b) => b.tier - a.tier || b.value - a.value)[0];
    if (!mat) continue;
    const eq = emptyEquipment();
    eq[base.slot === 'thrown' ? 'thrown' : 'weapon'] = makeEquipment({ baseId: base.id, materialId: mat.id, rarity: Rarity.Common, ilvl: ILVL });
    const d = derivePlayer(eq, {});
    let total = 0, n = 0;
    for (const def of ENEMIES) {
      const power = depthPower(def, Math.max(def.minDepth, 1));
      for (let i = 0; i < N; i++) total += playerHitsEnemy(rng, d, 1, def, defensePower(power)).damage;
      n += N;
    }
    // A belt has no swing of its own: only the throw below is worth printing.
    if (base.slot === 'thrown') {
      const t = base.thrown!;
      // Scored exactly the way the game scores it, off the same helper.
      const tv = thrownView(d);
      let thrownTotal = 0, tn = 0;
      for (const def of ENEMIES) {
        const power = depthPower(def, Math.max(def.minDepth, 1));
        for (let i = 0; i < N; i++) thrownTotal += playerHitsEnemy(rng, tv, t.power, def, defensePower(power)).damage;
        tn += N;
      }
      const tAvg = thrownTotal / tn;
      const tCycle = t.windup + t.recovery;
      const stock = Math.floor(t.stock + t.stockPerTier * (mat.tier - 1));
      rows.push({
        name: base.name, dps: tAvg / tCycle,
        line: `    ${base.name.padEnd(17)} ${mat.name.padEnd(14)} atk=${String(d.thrownAttack).padStart(3)} x${f2(t.power)} cycle=${f2(tCycle)}s cost=${String(t.staminaCost).padStart(2)} | hit ${String(f1(tAvg)).padStart(5)} dps ${String(f1(tAvg / tCycle)).padStart(5)} stock ${String(stock).padStart(2)} (${f1(stock * tAvg)} before you are dry) range ${t.range} [belt]`,
      });
      continue;
    }
    const avg = total / n;
    const cycle = d.swing.windup + d.swing.recovery;
    const dps = avg / cycle;
    const bar = (d.maxStamina / Math.max(1, d.swing.staminaCost)) * avg;
    const tags = [
      d.twoHanded ? '2H' : '',
      d.swing.cleave ? `cleave ${Math.round(d.swing.cleave * 100)}%` : '',
      d.swing.stagger ? `stagger ${f2(d.swing.stagger)}s` : '',
      d.swing.reach > 1 ? `reach ${d.swing.reach}` : '',
      (d.swing.chips ?? 1) > 1 ? `${d.swing.chips} chips` : '',
    ].filter(Boolean).join(' ');
    rows.push({
      name: base.name, dps,
      line: `    ${base.name.padEnd(17)} ${mat.name.padEnd(14)} atk=${String(d.attack).padStart(3)} cycle=${f2(cycle)}s cost=${String(d.swing.staminaCost).padStart(2)} | hit ${String(f1(avg)).padStart(5)} dps ${String(f1(dps)).padStart(5)} bar ${String(f1(bar)).padStart(6)} ${tags}`,
    });

  }

  rows.sort((a, b) => b.dps - a.dps);
  L.push(...rows.map((r) => r.line));
  const longSword = rows.find((r) => r.name === 'Long Sword');
  const overLongSword = rows.filter((r) => longSword && r.dps > longSword.dps).map((r) => r.name);
  L.push('');
  L.push(`  ranked by dps. above the Long Sword: ${overLongSword.length ? overLongSword.join(', ') : 'nothing'}`);
  return L.join('\n');
}

export function allTables(): string {
  return [CAVEAT, '', weapons(), '', ladder(), '', composition(), '', yields(), '', matchups()].join('\n');
}
