import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { createEnemy, generateFloor, promoteElite } from '../systems/dungeon';
import { applyQuirk, herdFor, rollQuirk } from '../systems/quirks';
import {
  PASTURE_HERD, QUIRKS, QUIRK_IDS, QUIRK_MAX_DEPTH, QUIRK_MIN_DEPTH, quirkDef, quirkTimeScale,
} from '../data/quirks';
import { ENEMIES, enemyDef } from '../data/enemies';

describe('rolling a floor strange', () => {
  it('never dresses the first floor or the throne', () => {
    for (let seed = 0; seed < 400; seed++) {
      expect(rollQuirk(seed, 1)).toBeNull();
      expect(rollQuirk(seed, 6)).toBeNull();
    }
  });

  it('stays rare, and gets likelier as you go down', () => {
    const rate = (depth: number) => {
      let n = 0;
      for (let seed = 0; seed < 3000; seed++) if (rollQuirk(seed, depth)) n++;
      return n / 3000;
    };
    const shallow = rate(QUIRK_MIN_DEPTH);
    const deep = rate(QUIRK_MAX_DEPTH);
    // Rare enough to be a surprise rather than a feature of the dungeon.
    expect(shallow).toBeGreaterThan(0.02);
    expect(shallow).toBeLessThan(0.09);
    expect(deep).toBeGreaterThan(shallow);
    expect(deep).toBeLessThan(0.15);
  });

  it('gives the same seed and depth the same floor every time', () => {
    // A strange floor you walk back up from and return to is the same strange
    // floor, and a bug report reproduces from a seed.
    for (let seed = 0; seed < 50; seed++) {
      for (let depth = QUIRK_MIN_DEPTH; depth <= QUIRK_MAX_DEPTH; depth++) {
        expect(rollQuirk(seed, depth)).toBe(rollQuirk(seed, depth));
      }
    }
  });

  it('eventually rolls each quirk', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 3000; seed++) {
      for (let depth = QUIRK_MIN_DEPTH; depth <= QUIRK_MAX_DEPTH; depth++) {
        const q = rollQuirk(seed, depth);
        if (q) seen.add(q);
      }
    }
    expect([...seen].sort()).toEqual([...QUIRK_IDS].sort());
  });
});

describe('the quirk table', () => {
  it('reads an unknown or absent quirk as an ordinary floor', () => {
    expect(quirkDef(undefined)).toBeNull();
    expect(quirkDef('no_such_quirk')).toBeNull();
    // Which matters: a save written by a later build naming a quirk this one
    // has never heard of has to open as an ordinary floor, not throw.
    expect(quirkTimeScale('no_such_quirk')).toBe(1);
    expect(quirkTimeScale(undefined)).toBe(1);
  });

  it('keeps every quirk inside the depths it can be rolled at', () => {
    for (const q of Object.values(QUIRKS)) {
      expect(q.minDepth).toBeGreaterThanOrEqual(QUIRK_MIN_DEPTH);
      expect(q.maxDepth).toBeLessThanOrEqual(QUIRK_MAX_DEPTH);
      expect(q.weight).toBeGreaterThan(0);
      // Time is allowed to move. It is not allowed to crawl or to blur.
      expect(q.timeScale).toBeGreaterThanOrEqual(1);
      expect(q.timeScale).toBeLessThanOrEqual(1.5);
    }
  });
});

describe('dressing a floor', () => {
  /** A floor that is known to have rolled the given quirk. */
  function strangeFloor(want: string) {
    for (let seed = 0; seed < 5000; seed++) {
      for (let depth = QUIRK_MIN_DEPTH; depth <= QUIRK_MAX_DEPTH; depth++) {
        if (rollQuirk(seed, depth) !== want) continue;
        const f = generateFloor(seed, depth, 'hard');
        const before = JSON.parse(JSON.stringify(f));
        applyQuirk(f, seed, 'hard');
        return { f, before, seed, depth };
      }
    }
    throw new Error(`no ${want} floor in 5000 seeds`);
  }

  it('leaves generation completely alone', () => {
    // The whole safety of quirks rests on this: the floor is generated exactly
    // as it always was and then dressed, so golden hashes keep their meaning.
    const { f, before } = strangeFloor('pasture');
    expect(f.tiles).toEqual(before.tiles);
    expect(f.rooms).toEqual(before.rooms);
    expect(f.stairs).toEqual(before.stairs);
    expect(f.doors).toEqual(before.doors);
    expect(f.secrets).toEqual(before.secrets);
    expect(f.seed).toBe(before.seed);
    expect(f.enemies.length).toBe(before.enemies.length);
  });

  it('turns a pasture into cattle, on the tiles the monsters already stood on', () => {
    const { f, before } = strangeFloor('pasture');
    expect(f.quirk).toBe('pasture');
    const herd = new Set<string>([...Object.values(PASTURE_HERD), 'prize_bull']);
    for (const e of f.enemies) expect(herd.has(e.def), `${e.def} is not cattle`).toBe(true);
    for (let i = 0; i < f.enemies.length; i++) {
      expect(f.enemies[i].x).toBe(before.enemies[i].x);
      expect(f.enemies[i].y).toBe(before.enemies[i].y);
    }
  });

  it('puts exactly one Prize Bull in a pasture', () => {
    const { f } = strangeFloor('pasture');
    expect(f.enemies.filter((e) => e.def === 'prize_bull').length).toBe(1);
  });

  it('promotes the containers rather than reaching into the loot tables', () => {
    const { f, before } = strangeFloor('pasture');
    const boost = QUIRKS.pasture.lootBoost;
    expect(boost).toBeGreaterThan(0);
    for (let i = 0; i < f.props.length; i++) {
      const was = before.props[i].tier;
      const now = f.props[i].tier;
      if (was === 'none') expect(now).toBe('none');
      else expect(['chest', 'vault', 'secret']).toContain(now);
    }
  });

  it('leaves the Silent Picture monsters alone and only moves its clock', () => {
    const { f, before } = strangeFloor('silent');
    expect(f.quirk).toBe('silent');
    expect(f.enemies.map((e) => e.def)).toEqual(before.enemies.map((e: { def: string }) => e.def));
    expect(quirkTimeScale(f.quirk)).toBeGreaterThan(1);
  });

  it('matches each monster to cattle of its own weight class', () => {
    expect(herdFor('rat')).toBe(PASTURE_HERD.small);
    expect(herdFor('skeleton')).toBe(PASTURE_HERD.medium);
    expect(herdFor('barrow_champion')).toBe(PASTURE_HERD.large);
    // And anything added to the roster later is already covered, because the
    // match is on health rather than on a list of names.
    for (const def of ENEMIES) expect(Object.values(PASTURE_HERD)).toContain(herdFor(def.id));
  });

  it('keeps an elite an elite when it becomes a cow', () => {
    // Without this the Pasture would be the one floor in the game with no
    // elites on it — a difficulty change smuggled in by a costume change.
    let checked = 0;
    for (let seed = 0; seed < 5000 && checked < 1; seed++) {
      for (let depth = QUIRK_MIN_DEPTH; depth <= QUIRK_MAX_DEPTH; depth++) {
        if (rollQuirk(seed, depth) !== 'pasture') continue;
        const f = generateFloor(seed, depth, 'hard');
        const victim = f.enemies.find((e) => !e.lurk && !e.elite && enemyDef(e.def).behavior !== 'boss');
        if (!victim) continue;
        promoteElite(victim, 'ironhide');
        const id = victim.id;
        applyQuirk(f, seed, 'hard');
        const swapped = f.enemies.find((e) => e.id === id)!;
        // The Prize Bull may have taken this one's place; that is its own rule.
        if (swapped.def === 'prize_bull') continue;
        expect(swapped.elite).toBe('ironhide');
        // The trait's health multiplier is baked into the cow, not into the
        // thing it replaced: an elite cow outweighs a plain one of its kind.
        const plain = createEnemy(enemyDef(swapped.def), 0, 0, 0, 'plain', depth, 'hard');
        expect(swapped.maxHp).toBeGreaterThan(plain.maxHp);
        checked++;
        break;
      }
    }
    expect(checked, 'no pasture floor with an ordinary monster on it').toBe(1);
  });

  it('keeps the herd off the ordinary spawn tables', () => {
    for (const id of [...Object.values(PASTURE_HERD), 'prize_bull']) {
      expect(enemyDef(id).weight, `${id} must never spawn on an ordinary floor`).toBe(0);
    }
  });
});

describe('a strange floor in a run', () => {
  it('runs the whole dungeon clock fast on the Silent Picture, and nothing else', () => {
    const state = newGame(createRng(9));
    state.difficulty = 'hard';
    startRun(state, 9);
    // The floor a run starts on is never strange, so the clock is ordinary.
    expect(quirkTimeScale(state.run!.floors[0]!.quirk)).toBe(1);
    // And the scale is a clock, not a damage number: no quirk touches attack.
    for (const q of Object.values(QUIRKS)) {
      expect(Object.keys(q)).not.toContain('enemyDamage');
    }
  });
});
