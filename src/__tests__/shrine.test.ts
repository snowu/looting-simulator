import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { BLESSINGS, CURSES, World } from '../world/world';
import { FLOOR, Prop, ShrineKind, generateFloor, shrineKindFor } from '../systems/dungeon';

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
  it('restores you outright', () => {
    const { w } = atShrine('font');
    w.player.hp = 5;
    w.player.stamina = 1;
    w.interact();
    expect(w.player.hp).toBe(w.derived.maxHp);
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
  it('takes the coin and gives a blessing', () => {
    const { w } = atShrine('coffer');
    const cost = w.offeringCost();
    w.run.gold = cost + 10;
    w.interact();
    expect(w.run.gold).toBe(10);
    expect(Object.keys(BLESSINGS)).toContain(w.run.blessing!);
  });

  it('stays open if you cannot pay', () => {
    const { w, shrine } = atShrine('coffer');
    w.run.gold = 0;
    w.interact();
    expect(shrine.used).toBe(false);
    expect(w.run.blessing).toBeNull();
    expect(w.run.gold).toBe(0);
    // Come back with the coin and it still works.
    w.run.gold = w.offeringCost();
    w.interact();
    expect(w.run.gold).toBe(0);
    expect(w.run.blessing).toBeTruthy();
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
    expect(w.derived.stats.speed).toBe(speed - 12);
  });

  it('cannot drop your health below one', () => {
    const { w } = atShrine('font');
    w.player.hp = 1;
    w.run.curse = 'frailty';
    w.refreshDerived();
    expect(w.derived.maxHp).toBeGreaterThan(0);
    expect(w.player.hp).toBeGreaterThan(0);
  });
});
