/**
 * The Ashen King and his throne room: phases, the Shadow Step and pitch,
 * the fog that guards him, and the doors that seal the fight. World.update
 * calls checkBossSeal and updatePitch once a tick; the monster loop asks
 * kingTurn and checkBossPhase about him.
 */
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { BOSS_ID, kingPhase, phaseForHp } from '../data/enemies';
import { blocksMove, doorAt, enemyAt, EnemyState, inRoom, isBossDoor, Room } from '../systems/dungeon';
import { burningAt, surfaceAt, surfaceKindAt } from '../systems/surfaces';
import * as Hazards from './hazards';
import type { World } from './world';
import * as Spells from './spells';

/**
 * How long the King reels when a phase breaks. Long enough to read the turn and
 * take a free swing at it, short enough that it is a moment rather than a
 * cutscene.
 */
export const BOSS_PHASE_BEAT = 1.2;

/**
 * The Dark's Shadow Step: how long the King is gone, and how often he goes.
 * Gone means gone (a `lurk`): nothing strikes him and nothing is struck. A
 * violet puff marks where he will come back for the whole of it, and he
 * re-forms in the ambusher's recovery, so a step costs you your facing and
 * never a free blow.
 */
export const SHADOW_STEP_SECONDS = 0.8;
export const SHADOW_STEP_EVERY = 6;

/** The Last Stand's burning pitch: how often, and how long it lies before it catches. */
export const PITCH_EVERY = 7;

export const PITCH_FUSE = 1.2;

/** He stoops to fling it, and the beat after is yours. */
export const PITCH_STOOP = 0.6;

/** Neighbouring tiles the pitch reaches besides your own. Two of the four always stay clean. */
export const PITCH_SPREAD = 2;

/**
 * Has the King crossed into a new phase?
 *
 * Checked every tick rather than on the swing that did it, because enemy
 * health falls in five different places — a sprung trap, a chip off a guard,
 * a landed blow and two parry reflections — and a threshold crossed by any of
 * the other four would otherwise go unannounced. The phase he is *in* comes
 * from his health; `e.phase` only remembers how far the fight has been
 * announced, so each turn lands exactly once.
 */
export function checkBossPhase(w: World, e: EnemyState): void {
  if (e.ai === 'dead' || e.hp <= 0) return;
  const now = phaseForHp(e.hp / Math.max(1, e.maxHp));
  const announced = e.phase ?? 1;
  if (now <= announced) return;
  // Step through every phase that was crossed, not just the one he landed in.
  // A crit inside a parry window can take two thirds of the bar off in a
  // single blow, and jumping straight to the last phase would mean the room
  // never goes dark and the guard never gets up — the middle of the fight
  // would simply not happen on the runs that hit hardest.
  for (let p = announced + 1; p <= now; p++) enterBossPhase(w, e, p, p === now);
}

export function enterBossPhase(w: World, e: EnemyState, phase: number, announce: boolean): void {
  e.phase = phase;
  const profile = kingPhase(phase);

  // He reels. The beat is the reward for breaking a phase: he cannot act while
  // the room changes around you, which is the same grace the mimic gets when
  // it unfolds and is what keeps a transition from being a free hit on the
  // player. Deliberately NOT a `vuln` window — that belongs to the parry, and
  // handing it out for nothing would cheapen the one thing the last phase is
  // built to teach.
  e.ai = 'recover';
  e.timer = BOSS_PHASE_BEAT;
  e.attackCd = BOSS_PHASE_BEAT + 0.2;
  e.hurtT = 0.3;
  e.guard = 'down';
  e.guardT = BOSS_PHASE_BEAT;
  e.blocks = 0;

  if (phase === 2) {
    // Losing the light and three unseen bolts in the same instant is the one
    // combination here that would be genuinely unfair, so the room holds its
    // breath: whatever he already had in the air goes out with the torches.
    w.projectiles = w.projectiles.filter((pr) => pr.sourceId !== e.def);
    snuffThrone(w);
  }

  if (!announce) return;
  w.sfx('kingturn', e.x, e.y);
  w.emit({ type: 'shake', amount: 0.6 });
  if (profile.entry) w.msg(profile.entry, '#c080ff');
}

/**
 * The King's own turn, beyond the blow and the volley: the Dark's Shadow
 * Step and the Last Stand's burning pitch. Only from a free stance and off
 * cooldown; true when he spent the turn on one.
 */
export function kingTurn(w: World, e: EnemyState, dist: number): boolean {
  let cd = w.kingCd.get(e.id);
  if (!cd) w.kingCd.set(e.id, (cd = { step: 0, pitch: 0 }));
  if (e.attackCd > 0) return false;
  const phase = e.phase ?? 1;
  if (phase >= 3 && w.diff.kingEscalates && cd.pitch <= 0 && dist <= 3 && spillPitch(w, e)) {
    cd.pitch = PITCH_EVERY;
    return true;
  }
  // Backed away from him, he comes for you at once; toe to toe, he waits out
  // half a cooldown more, so the Dark is a fight and not a teleporter.
  const ready = dist >= 2 ? cd.step <= 0 : cd.step <= -SHADOW_STEP_EVERY / 2;
  if (phase >= 2 && ready && shadowStep(w, e)) {
    cd.step = SHADOW_STEP_EVERY;
    return true;
  }
  return false;
}

/**
 * He melts into the dark and re-forms beside you: never behind you, and on
 * a flank rather than in front whenever one is open, because the point is
 * to make you turn. The puff where he will stand lasts the whole step.
 */
export function shadowStep(w: World, e: EnemyState): boolean {
  const p = w.player;
  const room = throneRoom(w);
  const behind = turnAround(p.facing);
  const spots = DIRS.filter((d) => d !== behind)
    .map((d) => ({ x: p.x + DX[d], y: p.y + DY[d], d }))
    .filter((t) => !blocksMove(w.floor, t.x, t.y) && !enemyAt(w.floor, t.x, t.y)
      && !(t.x === e.x && t.y === e.y) && (!room || inRoom(room, t.x, t.y)));
  if (!spots.length) return false;
  const flanks = spots.filter((t) => t.d !== p.facing);
  const to = w.rng.pick(flanks.length ? flanks : spots);
  Spells.addSpellFx(w, 'poof', e.x, e.y);
  Spells.addSpellFx(w, 'poof', to.x, to.y);
  e.x = e.fromX = to.x;
  e.y = e.fromY = to.y;
  e.moveT = 1;
  e.lurk = 'shadow';
  e.lurkT = SHADOW_STEP_SECONDS;
  e.ai = 'recover';
  w.sfx('magic', to.x, to.y);
  w.msg('The King melts into the dark. Ash stirs beside you.', '#c080ff');
  return true;
}

/** The Shadow Step runs out: he stands where the ash stirred, in recovery, never striking as he comes. */
export function updateShadowStep(w: World, e: EnemyState, dt: number): void {
  e.lurkT = (e.lurkT ?? 0) - dt;
  if (e.lurkT <= 0) w.emerge(e, false);
}

/**
 * Burning pitch at your feet: your tile and up to two beside it, never
 * leaving fewer than two of the four clean. It lies as oil, drawn like any
 * oil, and catches after `PITCH_FUSE`. He stoops to fling it, which is an
 * opening: step out, or punish him and pay for it.
 */
export function spillPitch(w: World, e: EnemyState): boolean {
  const p = w.player;
  const f = w.floor;
  const room = throneRoom(w);
  const walkable = (x: number, y: number) => !blocksMove(f, x, y) && !enemyAt(f, x, y) && (!room || inRoom(room, x, y));
  const takes = (x: number, y: number) => walkable(x, y) && !doorAt(f, x, y) && (!surfaceAt(f, x, y) || surfaceKindAt(f, x, y) === 'water');
  if (!takes(p.x, p.y)) return false;
  const around = DIRS.map((d) => ({ x: p.x + DX[d], y: p.y + DY[d] }));
  // A way out is a tile you can step to that is not already oil or fire.
  const clean = (x: number, y: number) => walkable(x, y) && surfaceKindAt(f, x, y) !== 'oil' && !burningAt(f, x, y);
  const open = around.filter((t) => clean(t.x, t.y)).length;
  const spread = w.rng.shuffle(around.filter((t) => clean(t.x, t.y) && takes(t.x, t.y))).slice(0, Math.max(0, Math.min(PITCH_SPREAD, open - 2)));
  for (const t of [{ x: p.x, y: p.y }, ...spread]) {
    const s = surfaceAt(f, t.x, t.y);
    if (s) {
      s.kind = 'oil';
      delete s.t;
    } else (f.surfaces ??= []).push({ x: t.x, y: t.y, kind: 'oil' });
    w.pitchFuses.push({ x: t.x, y: t.y, t: PITCH_FUSE });
  }
  e.ai = 'recover';
  e.timer = PITCH_STOOP;
  e.attackCd = PITCH_STOOP + 0.2;
  w.sfx('splash', p.x, p.y);
  w.msg('The King flings burning pitch at your feet!', '#ff9a50');
  return true;
}

/** Pitch that has lain its fuse out catches, like any oil a flame reaches. */
export function updatePitch(w: World, dt: number): void {
  if (!w.pitchFuses.length) return;
  for (const fz of w.pitchFuses) fz.t -= dt;
  const lit = w.pitchFuses.filter((fz) => fz.t <= 0);
  w.pitchFuses = w.pitchFuses.filter((fz) => fz.t > 0);
  for (const fz of lit) if (surfaceKindAt(w.floor, fz.x, fz.y) === 'oil') Hazards.elementReaches(w, fz.x, fz.y, 'fire');
}

/** The tiles of the room the King is standing his last in. */
export function throneRoom(w: World): Room | undefined {
  return w.floor.rooms.find((r) => r.role === 'throne');
}

/** The living throne is a combat boundary even while its entrance is open. */
export function crossesBossBoundary(w: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const room = throneRoom(w);
  // Boundary first: it is two comparisons, and the King check scans every
  // enemy — this runs for each monster, every tick, on the throne floor.
  return !!room && inRoom(room, x0, y0) !== inRoom(room, x1, y1) && bossAlive(w);
}

export function protectedByFog(w: World, e: EnemyState): boolean {
  return crossesBossBoundary(w, w.player.x, w.player.y, e.x, e.y);
}

/** The King, if he still stands on this floor. */
export function bossAlive(w: World): boolean {
  return w.floor.enemies.some((e) => e.def === BOSS_ID && e.ai !== 'dead');
}

/** Fog-gate doors on this floor (usually exactly one, at the throne). */
export function bossDoors(w: World) {
  return w.floor.doors.filter((d) => isBossDoor(w.floor, d));
}

export function playerInThrone(w: World): boolean {
  const r = throneRoom(w);
  return !!r && inRoom(r, w.player.x, w.player.y);
}

/**
 * The fog wall. The moment you step into the throne room with the King
 * alive, every gate slams and seals — no ducking back out to bleed him
 * through the doorway, no bolts through the crack either, since a shut
 * door blocks sight both ways.
 */
export function checkBossSeal(w: World): void {
  if (!bossAlive(w) || !playerInThrone(w)) return;
  if (w.diff.throneRetreat) {
    // Normal: the fog gathers but does not close. Said once per delve.
    if (!w.fogWarned) {
      w.fogWarned = true;
      w.msg('The fog gathers at your back, but lets you pass. Step out to catch your breath.', '#c0a0ff');
    }
    return;
  }
  const open = bossDoors(w).filter((d) => !d.locked);
  if (!open.length) return;
  for (const g of open) {
    g.open = false;
    g.locked = true;
  }
  w.msg('The fog closes behind you. The King must fall.', '#c0a0ff');
  w.sfx('door');
  w.emit({ type: 'shake', amount: 0.4 });
}

/** His death thins the fog: the way out stands open. */
export function unsealBossDoors(w: World): void {
  const shut = bossDoors(w).filter((d) => d.locked || !d.open);
  if (!shut.length) return;
  for (const g of shut) {
    g.locked = false;
    g.open = true;
  }
  w.msg('The fog thins. The way out stands open.', '#c0a0ff');
  w.sfx('door');
}

/**
 * He puts the room out.
 *
 * Only the throne room's own sconces: the corridor you came down stays lit,
 * so the way back is still readable and the darkness is somewhere you chose
 * to stand. The renderer rebuilds its lights from `floor.torches` every frame,
 * so dropping them here is the whole effect, and it persists — they do not
 * come back.
 */
export function snuffThrone(w: World): void {
  const room = throneRoom(w);
  if (!room) return;
  const before = w.floor.torches.length;
  w.floor.torches = w.floor.torches.filter((t) => !inRoom(room, t.x, t.y));
  if (w.floor.torches.length !== before) w.sfx('snuff');
}
