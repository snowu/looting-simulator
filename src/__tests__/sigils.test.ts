import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { SIGILS } from '../data/spells';
import { SAVE_VERSION, newGame } from '../state/game-state';
import { parseSave } from '../state/save-format';
import { SAVE_REVISION } from '../state/migrations';
import { addItem } from '../state/inventory';
import { attuneSigil, inscribeSigil, makeSigil, unknownSigils } from '../systems/spells';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { createEnemy, FLOOR } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { durability } from '../systems/items';

function worldWith(id: string): World {
  const state = newGame(createRng(83));
  state.spells = [id];
  state.attuned = id;
  startRun(state, 83);
  const w = new World(state);
  w.floor.enemies = [];
  w.floor.traps = [];
  const x = 10, y = 10;
  Object.assign(w.player, { x, y, facing: 0 });
  for (let yy = y - 7; yy <= y + 7; yy++) for (let xx = x - 7; xx <= x + 7; xx++) w.floor.tiles[yy * w.floor.width + xx] = FLOOR;
  w.floor.doors = w.floor.doors.filter((d) => Math.abs(d.x - x) + Math.abs(d.y - y) > 8);
  w.floor.stairs = w.floor.stairs.filter((s) => Math.abs(s.x - x) + Math.abs(s.y - y) > 8);
  return w;
}

describe('sigil state', () => {
  it('defines exactly the five utility sigils and suppresses known/carried duplicates', () => {
    expect(SIGILS.map((s) => s.id)).toEqual(['wardcry', 'snuff', 'sounding', 'threshold', 'temper']);
    expect(unknownSigils(['snuff'], ['wardcry'])).toEqual(['sounding', 'threshold', 'temper']);
  });

  it('inscribes, attunes, snapshots a ready run charge, and preserves cooldown on portal swaps', () => {
    const state = newGame(createRng(81));
    const stone = makeSigil('wardcry');
    addItem(state.stash, stone);
    expect(inscribeSigil(state, state.stash, stone.uid)).toBe(true);
    expect(attuneSigil(state, 'wardcry')).toBe(true);
    startRun(state, 81);
    expect(state.run!.sigil).toEqual({ id: 'wardcry', cd: 0 });
    state.spells.push('snuff');
    state.run!.sigil!.cd = 37;
    expect(attuneSigil(state, 'snuff')).toBe(false);
    state.run!.portal = { depth: 1, x: 1, y: 1 };
    expect(attuneSigil(state, 'snuff')).toBe(true);
    expect(state.run!.sigil).toEqual({ id: 'snuff', cd: 37 });
  });

  it('migrates additively without changing the save family', () => {
    const state = newGame(createRng(82)) as any;
    state.revision = 17;
    delete state.spells;
    delete state.attuned;
    startRun(state, 82);
    delete state.run.thrown;
    delete state.run.sigil;
    delete state.run.floors[0].thrown;
    const loaded = parseSave(JSON.stringify(state))!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.revision).toBe(SAVE_REVISION);
    expect(loaded.spells).toEqual([]);
    expect(loaded.attuned).toBeNull();
    expect(loaded.run!.thrown).toEqual({ held: {}, retrieveCd: 0 });
    expect(loaded.run!.sigil).toBeNull();
    expect(loaded.run!.floors[0]!.thrown).toEqual([]);
  });

  it('resolves all five utilities and applies cooldown economy', () => {
    const wardcry = worldWith('wardcry');
    const front = wardcry.frontTile();
    const enemy = createEnemy(enemyDef('skeleton'), front.x, front.y, 2, 'target', 1);
    enemy.ai = 'windup';
    enemy.timer = 2;
    wardcry.floor.enemies.push(enemy);
    (wardcry as any).resolveSigil('wardcry');
    expect(enemy.ai).toBe('recover');
    expect(Math.abs(enemy.x - front.x) + Math.abs(enemy.y - front.y)).toBe(1);
    expect(wardcry.run.sigil!.cd).toBe(70);
    (wardcry as any).refundSigil(enemyDef('hollow_knight'));
    expect(wardcry.run.sigil!.cd).toBeLessThan(70);

    const snuff = worldWith('snuff');
    const hunter = createEnemy(enemyDef('skeleton'), 10, 14, 0, 'hunter', 1);
    hunter.ai = 'chase'; hunter.alert = 6;
    snuff.floor.enemies.push(hunter);
    (snuff as any).resolveSigil('snuff');
    expect(hunter.ai).toBe('idle');
    expect(snuff.anim).toMatchObject({ snuffT: 8, unseenT: 3 });
    expect(snuff.playerLightRadius).toBe(2.5);

    const sounding = worldWith('sounding');
    sounding.floor.explored.fill(0);
    sounding.floor.traps.push({ id: 'hidden', kind: 'spikes', x: 11, y: 10, armed: true, found: false, dir: 0 });
    (sounding as any).resolveSigil('sounding');
    expect(sounding.floor.explored[10 * sounding.floor.width + 11]).toBe(1);
    expect(sounding.floor.traps[0].found).toBe(true);

    const threshold = worldWith('threshold');
    (threshold as any).resolveSigil('threshold');
    expect(threshold.anim.ward).toMatchObject({ x: 10, y: 10, t: 8 });

    const temper = worldWith('temper');
    const worn = temper.state.equipment.weapon!;
    worn.dur = 1;
    const max = durability(worn).max;
    (temper as any).resolveSigil('temper');
    expect(worn.dur).toBe(1 + Math.round(max * 0.25));
  });

  /**
   * The whole chain, through the key rather than by calling resolveSigil.
   * Every effect test above reaches straight into the private, so all five
   * could have worked while the path a player actually takes was broken.
   */
  it('carries a key press through the cast to the effect, the cooldown and the feedback', () => {
    const w = worldWith('sounding');
    w.floor.explored.fill(0);
    const events: string[] = [];
    expect(w.castSigil()).toBe(true);
    expect(w.anim.cast).toMatchObject({ id: 'sounding' });
    // Mid-cast the sigil is what you are holding, which is the only tell there
    // is that anything is happening.
    expect(w.weaponArt().id).toMatch(/^vm_sigil/);
    w.drainEvents();
    for (let t = 0; t < 1.2; t += 1 / 60) w.update(1 / 60);
    for (const ev of w.drainEvents()) events.push(ev.type);
    expect(w.anim.cast).toBeNull();
    expect(w.run.sigil!.cd).toBeGreaterThan(44);
    expect(w.run.sigil!.cd).toBeLessThanOrEqual(45);
    expect(w.floor.explored[10 * w.floor.width + 11]).toBe(1);
    // And it is visible when it lands: a wash of colour, a shake, a float and
    // a line in the log. Without these a sigil was a key that spent stamina.
    expect(events).toContain('sigil');
    expect(events).toContain('shake');
    expect(events).toContain('float');
    expect(w.weaponArt().id).not.toMatch(/^vm_sigil/);
  });

  it('says why it will not cast, instead of doing nothing', () => {
    const none = worldWith('wardcry');
    none.run.sigil = null;
    none.drainEvents();
    expect(none.castSigil()).toBe(false);
    expect(none.drainEvents().some((e) => e.type === 'msg' && /No sigil attuned/.test(e.text))).toBe(true);

    const cold = worldWith('wardcry');
    cold.run.sigil!.cd = 30;
    cold.drainEvents();
    expect(cold.castSigil()).toBe(false);
    expect(cold.drainEvents().some((e) => e.type === 'msg' && /still cold/.test(e.text))).toBe(true);

    const spent = worldWith('wardcry');
    spent.player.stamina = 1;
    spent.drainEvents();
    expect(spent.castSigil()).toBe(false);
    expect(spent.drainEvents().some((e) => e.type === 'msg' && /breath/.test(e.text))).toBe(true);
  });

  it('slows cooldown near an alert enemy and interruption keeps the charge', () => {
    const w = worldWith('wardcry');
    w.run.sigil!.cd = 20;
    const hunter = createEnemy(enemyDef('skeleton'), 10, 14, 0, 'hunter', 1);
    hunter.alert = 6;
    w.floor.enemies.push(hunter);
    w.update(0.05);
    expect(w.run.sigil!.cd).toBeCloseTo(19.975);
    w.run.sigil!.cd = 0;
    expect(w.castSigil()).toBe(true);
    const stamina = w.player.stamina;
    (w as any).damagePlayer(20, 'blunt', 10, 11, 'test');
    expect(w.anim.cast).toBeNull();
    expect(w.run.sigil!.cd).toBe(0);
    expect(w.player.stamina).toBe(stamina);
  });
});
