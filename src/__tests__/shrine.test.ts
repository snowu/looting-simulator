import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { BLESSINGS, CURSES, World } from '../world/world';
import { FLOOR, Floor, Prop, ShrineKind, generateFloor, shrineKindFor, shrinePityFor } from '../systems/dungeon';
import { durability } from '../systems/items';

/** The player facing a shrine of the given flavour, one tile away. */
function atShrine(kind: ShrineKind, seed = 1): { w: World; shrine: Prop } {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.traps = [];
  f.props = f.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) =>
    f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
  for (let y = 2; y < f.height - 3; y++) for (let x = 2; x < f.width - 3; x++) {
    for (const d of DIRS) {
      if (!free(x, y) || !free(x + DX[d], y + DY[d])) continue;
      Object.assign(w.player, { x, y, facing: d });
      Object.assign(w.anim, { fromX: x, fromY: y, moveT: 1, turnT: 1 });
      const shrine: Prop = {
        id: 'sh', kind: 'shrine', x: x + DX[d], y: y + DY[d], used: false, tier: 'none', blocking: true, mimic: false, shrine: kind,
      };
      f.props.push(shrine);
      return { w, shrine };
    }
  }
  throw new Error('no arena');
}

describe('shrine flavours', () => {
  it('says which one it is before you touch it', () => {
    expect(atShrine('font').w.interactionHint()).toBe('Drink at the font');
    expect(atShrine('idol').w.interactionHint()).toBe('Pray at the hollow idol');
    expect(atShrine('coffer').w.interactionHint()).toMatch(/^Offer \d+ gold at the stone$/);
  });

  it('is the same flavour every time for a given floor', () => {
    const a = generateFloor(31, 2).props.filter((p) => p.kind === 'shrine');
    const b = generateFloor(31, 2).props.filter((p) => p.kind === 'shrine');
    expect(a.map((p) => p.shrine)).toEqual(b.map((p) => p.shrine));
    for (const p of a) expect(p.shrine).toBe(shrineKindFor(generateFloor(31, 2).seed, p.id));
  });

  it('gives every generated shrine a flavour', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const depth of [1, 3, 6]) {
        for (const p of generateFloor(seed, depth).props) {
          if (p.kind === 'shrine') expect(['font', 'idol', 'coffer']).toContain(p.shrine);
        }
      }
    }
  });
});

describe('the font', () => {
  it('mends most of you, and all of your breath', () => {
    const { w } = atShrine('font');
    w.player.hp = 5;
    w.player.stamina = 1;
    w.interact();
    // A font is a large mend, not a save point: it gives back a big share of
    // the bar and every point of stamina, and it does not undo the delve.
    expect(w.player.hp).toBeGreaterThan(5 + w.derived.maxHp * 0.4);
    expect(w.player.hp).toBeLessThan(w.derived.maxHp);
    expect(w.player.stamina).toBe(w.derived.maxStamina);
  });

  it('washes off a curse', () => {
    const { w } = atShrine('font');
    w.run.curse = 'frailty';
    w.refreshDerived();
    w.interact();
    expect(w.run.curse).toBeNull();
  });

  it('never curses you', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { w } = atShrine('font', seed);
      w.interact();
      expect(w.run.curse).toBeNull();
    }
  });
});

describe('the hollow idol', () => {
  it('gives or takes, and does both across many runs', () => {
    let blessed = 0;
    let cursed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { w } = atShrine('idol', seed);
      w.interact();
      if (w.run.blessing) blessed++;
      if (w.run.curse) cursed++;
      // Never both from a single prayer.
      expect(w.run.blessing && w.run.curse).toBeFalsy();
    }
    expect(blessed).toBeGreaterThan(0);
    expect(cursed).toBeGreaterThan(0);
  });

  it('lands a real curse from the table', () => {
    let found: string | null = null;
    for (let seed = 1; seed <= 60 && !found; seed++) {
      const { w } = atShrine('idol', seed);
      w.interact();
      found = w.run.curse;
    }
    expect(found).toBeTruthy();
    expect(Object.keys(CURSES)).toContain(found!);
  });
});

describe('the offering stone', () => {
  it('takes the coin every time, blessing or silence', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { w } = atShrine('coffer', seed);
      const cost = w.offeringCost();
      w.run.gold = cost + 10;
      w.player.hp = 5;
      w.interact();
      // The coin is always taken; what varies is whether the stone answers.
      expect(w.run.gold).toBe(10);
      if (w.run.blessing) expect(Object.keys(BLESSINGS)).toContain(w.run.blessing!);
      else expect(w.player.hp).toBe(5); // silence: no mend either
    }
  });

  it('sometimes answers, sometimes stays silent', () => {
    let blessed = 0;
    let silent = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { w } = atShrine('coffer', seed);
      w.run.gold = w.offeringCost() + 10;
      w.player.hp = 5;
      w.interact();
      if (w.run.blessing) blessed++;
      else {
        silent++;
        expect(w.player.hp).toBe(5);
      }
    }
    expect(blessed).toBeGreaterThan(0);
    expect(silent).toBeGreaterThan(0);
  });

  it('prices each offering 75% above the last: 55, 96, 168 on depth 1', () => {
    const { w } = atShrine('coffer');
    expect(w.offeringCost(0)).toBe(55);
    expect(w.offeringCost(1)).toBe(96);
    expect(w.offeringCost(2)).toBe(168);
  });

  it('takes up to three offerings, then goes quiet', () => {
    const { w, shrine } = atShrine('coffer');
    const costs = [w.offeringCost(0), w.offeringCost(1), w.offeringCost(2)];
    w.run.gold = costs[0] + costs[1] + costs[2] + 50;
    const purse = w.run.gold;
    w.player.hp = 5;
    w.interact();
    expect(w.run.gold).toBe(purse - costs[0]);
    expect(shrine.offerings).toBe(1);
    expect(shrine.used).toBe(false);
    expect(w.interactionHint()).toMatch(new RegExp(`^Offer ${costs[1]} gold at the stone \\(2 of 3 left\\)$`));
    w.interact();
    expect(w.run.gold).toBe(purse - costs[0] - costs[1]);
    expect(shrine.offerings).toBe(2);
    expect(shrine.used).toBe(false);
    w.interact();
    expect(w.run.gold).toBe(purse - costs[0] - costs[1] - costs[2]);
    expect(shrine.offerings).toBe(3);
    expect(shrine.used).toBe(true);
    // A fourth prayer does nothing and costs nothing.
    w.interact();
    expect(w.run.gold).toBe(purse - costs[0] - costs[1] - costs[2]);
    expect(shrine.offerings).toBe(3);
  });

  it('stays open if you cannot pay', () => {
    const { w, shrine } = atShrine('coffer');
    w.run.gold = 0;
    w.interact();
    expect(shrine.used).toBe(false);
    expect(shrine.offerings ?? 0).toBe(0);
    expect(w.run.blessing).toBeNull();
    expect(w.run.gold).toBe(0);
    // Come back with the coin and it still works.
    w.run.gold = w.offeringCost();
    w.player.hp = 5;
    w.interact();
    expect(w.run.gold).toBe(0);
    expect(shrine.offerings).toBe(1);
  });

  it('asks for more the deeper you are', () => {
    const { w } = atShrine('coffer');
    const shallow = w.offeringCost();
    w.run.depth = 5;
    expect(w.offeringCost()).toBeGreaterThan(shallow);
  });
});

describe('curses', () => {
  it('frailty cuts your maximum health', () => {
    const { w } = atShrine('font');
    const full = w.derived.maxHp;
    w.run.curse = 'frailty';
    w.refreshDerived();
    expect(w.derived.maxHp).toBeLessThan(full);
  });

  it('dulled edge cuts your damage', () => {
    const { w } = atShrine('font');
    const atk = w.derived.attack;
    w.run.curse = 'dulled';
    w.refreshDerived();
    expect(w.derived.attack).toBeLessThan(atk);
  });

  it('leaden limbs slows you', () => {
    const { w } = atShrine('font');
    const speed = w.derived.stats.speed;
    w.run.curse = 'leaden';
    w.refreshDerived();
    expect(w.derived.stats.speed).toBe(speed - 15);
  });

  it('cannot drop your health below one', () => {
    const { w } = atShrine('font');
    w.player.hp = 1;
    w.run.curse = 'frailty';
    w.refreshDerived();
    expect(w.derived.maxHp).toBeGreaterThan(0);
    expect(w.player.hp).toBeGreaterThan(0);
  });

  it('brittle makes every wear event worse', () => {
    const { w } = atShrine('font');
    const weapon = w.state.equipment.weapon!;

    w.run.curse = null;
    const clean = durability(weapon).cur;
    (w as unknown as { wear: (s: string, n?: number) => void }).wear('weapon', 1);
    const afterClean = durability(weapon).cur;
    weapon.dur = clean;
    w.run.curse = 'brittle';
    (w as unknown as { wear: (s: string, n?: number) => void }).wear('weapon', 1);
    const afterBrittle = durability(weapon).cur;
    expect(clean - afterBrittle).toBe((clean - afterClean) + 1);
  });

  it('hunted costs three tiles of sight now', () => {
    const { w } = atShrine('font');
    w.run.curse = 'hunted';
    expect((w as unknown as { sightPenalty: number }).sightPenalty).toBeGreaterThanOrEqual(3);
  });
});

describe('new blessings', () => {
  it('vitality raises the ceiling by a fifth', () => {
    const { w } = atShrine('font');
    const full = w.derived.maxHp;
    w.run.blessing = 'vitality';
    w.refreshDerived();
    expect(w.derived.maxHp).toBe(Math.round(full * 1.2));
  });

  it('fortune and ward scale with depth', () => {
    const { w } = atShrine('font');
    w.run.blessing = 'fortune';
    w.run.depth = 6;
    w.refreshDerived();
    expect(w.derived.find).toBeGreaterThanOrEqual(60);
    w.run.blessing = 'ward';
    w.refreshDerived();
    expect(w.derived.stats.defense).toBeGreaterThanOrEqual(9);
  });
});

describe('shrine pity', () => {
  const noShrine = (seed: number, depth: number): Floor => {
    const f = generateFloor(seed, depth);
    for (const r of f.rooms) if (r.role === 'shrine') r.role = 'normal';
    return f;
  };

  it('forces a shrine on depth 3 when 1–2 are dry', () => {
    const floors: (Floor | null)[] = [noShrine(1, 1), noShrine(1, 2)];
    expect(shrinePityFor(floors, 3)).toBe(true);
  });

  it('does not force on depth 3 when the block already has one', () => {
    const floors: (Floor | null)[] = [generateFloor(7, 1), noShrine(7, 2)];
    // Seed 7 depth 1 may or may not have a shrine; force the question both ways.
    floors[0] = generateFloor(7, 1);
    const has = floors[0]!.rooms.some((r) => r.role === 'shrine');
    expect(shrinePityFor(floors, 3)).toBe(!has && !floors[1]!.rooms.some((r) => r.role === 'shrine'));
  });

  it('forces depth 5 when depth 4 missed, and depth 6 until the block holds 2', () => {
    const floors: (Floor | null)[] = [null, null, null, noShrine(2, 4)];
    expect(shrinePityFor(floors, 5)).toBe(true);
    const withOne: (Floor | null)[] = [null, null, null, generateFloor(3, 4), noShrine(3, 5)];
    const count = [withOne[3], withOne[4]].filter((f) => f!.rooms.some((r) => r.role === 'shrine')).length;
    expect(shrinePityFor(withOne, 6)).toBe(count < 2);
  });

  it('a forced floor actually places a shrine when a normal room exists', () => {
    for (let seed = 0; seed < 30; seed++) {
      const f = generateFloor(seed, 3, 'hard', true);
      expect(f.rooms.some((r) => r.role === 'shrine')).toBe(true);
    }
  });
});
