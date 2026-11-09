/**
 * Conduit spells and rites: casting, charges and their regrowth, hitscan
 * bolts, hexes and polymorph, and the four drawn rites (Meteor, Glacial
 * Tomb, Judgement, Penguining). World.update calls updateConduit once a
 * tick; castSpell and endRiteDraw on World are the entry points.
 */
import { DIRS, DX, DY } from '../core/dir';
import { manhattan } from '../core/math';
import { BURN_SECONDS, BURN_SHARE, CHILL_SECONDS, conduitSpell, ConduitSpellDef, findConduitSpell, HEX_SECONDS, WEAVE_SECONDS, WEAVE_SHARE } from '../data/conduit-spells';
import { enemyDef } from '../data/enemies';
import { rite, RiteDef } from '../data/rites';
import { sigil } from '../data/spells';
import { recordDamageDealt } from '../systems/bestiary';
import { playerHitsEnemy } from '../systems/combat';
import { blocksMove, blocksSight, defensePower, enemyAt, EnemyState, inRoom } from '../systems/dungeon';
import { metaLevel } from '../systems/meta';
import { PlayerDerived, spellView } from '../systems/player';
import { RiteGrade } from '../systems/rite-draw';
import { EnemyDef } from '../types';
import * as Hazards from './hazards';
import * as Boss from './boss';
import type { World } from './world';
import { PARRY_VULN_MULT, Projectile, SpellFx } from './world';
import * as Combat from './combat';
import * as EnemyAi from './enemy-ai';

/** How long each mark lasts, in seconds. */
export const SPELL_FX_SECONDS: Record<SpellFx['kind'], number> = { smite: 0.55, poof: 0.7, spores: 0.9, blast: 0.6, meteor: 1.4, frost: 0.8 };

export const METEOR_FALL_SECONDS = 0.45;

export const METEOR_POWER_PER_CHARGE = 1.5;

/** Judgement's holy fire on the living, per charge: below Meteor, since the undead are its point. */
export const JUDGEMENT_POWER_PER_CHARGE = 1;

/** Seconds Glacial Tomb holds what it catches; a sloppy trace holds half as long. */
export const GLACIAL_TOMB_SECONDS = 5;

/** Seconds it holds what is only in sight, outside your room: the room is the tomb. */
export const GLACIAL_TOMB_SIGHT_SECONDS = 2.5;

/**
 * Judgement ends the undead outright only below this base health. The Hollow
 * Knight and the Barrow Champion stand under it, as do elites and lieutenants,
 * and take its holy fire at the undead's double instead.
 */
export const JUDGEMENT_SPARE_HP = 100;

/** How far Glacial Tomb reaches beyond your room, down a clear line of sight. */
export const RITE_SIGHT = 8;

/** A botched Glacial Tomb holds you this long. */
export const RITE_BOTCH_FREEZE = 2;

/** Whether a clean Judgement ends this undead outright, or only burns it. */
export function judgementEnds(e: EnemyState): boolean {
  const def = enemyDef(e.def);
  return !!def.undead && def.behavior !== 'boss' && !e.elite && !e.lieutenant && def.hp < JUDGEMENT_SPARE_HP;
}

/**
 * The charge pool lives on the run, not the item: it is filled the first
 * time a conduit is worn on a delve and never again, so taking a wand off
 * and putting it back on refills nothing. A smaller conduit just caps it.
 */
export function ensureConduit(w: World): void {
  const c = w.derived.conduit;
  if (!c) return;
  w.run.conduit ??= { charges: c.charges, regrow: 0, sel: 0 };
  w.run.conduit.charges = Math.min(w.run.conduit.charges, c.charges);
}

/** Health a cast short by `short` charges costs: 0 when not short, -1 when nothing will pay it. */
export function bloodPrice(w: World, short: number): number {
  if (short <= 0) return 0;
  const rate = w.derived.traits.bloodCast;
  return rate > 0 ? Math.max(1, Math.round(short * rate * w.derived.maxHp)) : -1;
}

/** The monsters a rite falls on: your room, or what is close when the stone has no walls. */
export function riteTargets(w: World): EnemyState[] {
  // A King mid Shadow Step is nowhere to be struck.
  const live = w.floor.enemies.filter((e) => e.ai !== 'dead' && e.lurk !== 'shadow');
  const room = w.floor.rooms.find((r) => inRoom(r, w.player.x, w.player.y));
  if (room) return live.filter((e) => inRoom(room, e.x, e.y));
  return live.filter((e) => manhattan(e.x, e.y, w.player.x, w.player.y) <= 4 && w.los(w.player.x, w.player.y, e.x, e.y));
}

/** Glacial Tomb's reach: the room, and anything else you can see down a corridor. */
export function riteSightTargets(w: World): EnemyState[] {
  const room = riteTargets(w);
  const seen = w.floor.enemies.filter((e) => e.ai !== 'dead' && !room.includes(e)
    && manhattan(e.x, e.y, w.player.x, w.player.y) <= RITE_SIGHT && w.los(w.player.x, w.player.y, e.x, e.y));
  return [...room, ...seen];
}

/** Where a rite that found nothing still shows itself: two tiles ahead, else one, else here. */
export function riteEmptyTile(w: World): { x: number; y: number } {
  let tile = w.frontTile(2);
  if (blocksMove(w.floor, tile.x, tile.y) || Boss.crossesBossBoundary(w, w.player.x, w.player.y, tile.x, tile.y)) tile = w.frontTile();
  if (blocksMove(w.floor, tile.x, tile.y) || Boss.crossesBossBoundary(w, w.player.x, w.player.y, tile.x, tile.y)) tile = w.player;
  return tile;
}

/** Each spent charge contributes to the skyfall; damage lands with the impact. */
export function castMeteor(w: World, def: RiteDef, grade: RiteGrade, charges: number): void {
  const meteor = { ...conduitSpell('ember_bolt'), power: METEOR_POWER_PER_CHARGE * charges * (grade === 'weak' ? 0.5 : 1) };
  const view = spellView(w.derived, meteor);
  const targets = riteTargets(w).filter(e => !Boss.protectedByFog(w, e));
  for (const e of targets) {
    const enemy = Combat.view(w, e);
    const hit = playerHitsEnemy(w.rng, view, 1, enemy, defensePower(e.power) * w.diff.enemyDefense);
    w.spellFx.push({ id: w.projN++, kind: 'meteor', x: e.x, y: e.y, t: 0,
      weak: grade === 'weak', meteor: { target: e, damage: hit.damage, crit: hit.crit } });
  }
  if (!targets.length) {
    // Empty-room tests still show the skyfall; no creature means no damage.
    const tile = riteEmptyTile(w);
    w.spellFx.push({ id: w.projN++, kind: 'meteor', x: tile.x, y: tile.y, t: 0, weak: grade === 'weak' });
    w.msg(`${def.name} falls on empty stone.`, '#888');
  }
  weaveFrom(w, meteor);
  w.sfx('magic');
  w.emit({ type: 'float', x: w.player.x, y: w.player.y, text: grade === 'weak' ? 'Meteor, thinly!' : 'Meteor!', color: def.color });
  w.msg(grade === 'weak' ? 'The trace wavers: a thin meteor answers.' : `The sky answers: ${charges} charges fall as fire.`, def.color);
}

/**
 * Glacial Tomb: everything in sight is held in ice. The frost reaches each
 * tile as a Rime Lance's would — water freezes, fire goes out — and the
 * King, who breaks free of ice at once, is only slowed.
 */
export function castGlacialTomb(w: World, def: RiteDef, grade: RiteGrade): void {
  const scale = grade === 'weak' ? 0.5 : 1;
  const room = riteTargets(w);
  const targets = riteSightTargets(w).filter(e => !Boss.protectedByFog(w, e));
  let held = 0;
  for (const e of targets) {
    const seconds = (room.includes(e) ? GLACIAL_TOMB_SECONDS : GLACIAL_TOMB_SIGHT_SECONDS) * scale;
    addSpellFx(w, 'frost', e.x, e.y);
    Hazards.elementReaches(w, e.x, e.y, 'frost');
    if (e.ai === 'dead') continue;
    if (enemyDef(e.def).behavior === 'boss') {
      e.chillT = Math.max(e.chillT ?? 0, CHILL_SECONDS);
      w.emit({ type: 'float', x: e.x, y: e.y, text: 'chilled', color: def.color });
      w.msg('The ice cannot hold the King, but it slows him.', def.color);
      continue;
    }
    // A penguin is harmless already: the ice leaves it waddling.
    if ((e.hexT ?? 0) > 0) continue;
    Hazards.freeze(w, e, seconds, true);
    e.alert = Math.max(e.alert, 8);
    held++;
  }
  if (!targets.length) {
    const tile = riteEmptyTile(w);
    addSpellFx(w, 'frost', tile.x, tile.y);
    Hazards.elementReaches(w, tile.x, tile.y, 'frost');
    w.msg(`${def.name} closes on empty air.`, '#888');
  } else if (held) {
    w.msg(grade === 'weak'
      ? `The trace wavers: thin ice holds ${held === 1 ? 'it' : `all ${held}`} for a moment.`
      : `Ice closes over ${held === 1 ? 'it' : `all ${held} of them`}. Nothing moves.`, def.color);
  }
  weaveFrom(w, conduitSpell('rime_lance'));
  w.sfx('block');
  w.emit({ type: 'float', x: w.player.x, y: w.player.y, text: grade === 'weak' ? 'Thin ice!' : 'Glacial Tomb!', color: def.color });
}

/**
 * Judgement: a pillar of light on everything in the room. A clean trace
 * ends the ordinary undead outright, and what it ends stays down; the great
 * ones (see `judgementEnds`) and a sloppy trace's undead are struck twice as
 * hard as the living instead. The living take holy fire, which no raised
 * shield turns. The King is struck, never ended.
 */
export function castJudgement(w: World, def: RiteDef, grade: RiteGrade, charges: number): void {
  const light = { ...conduitSpell('smite'), power: JUDGEMENT_POWER_PER_CHARGE * charges * (grade === 'weak' ? 0.5 : 1) };
  const view = spellView(w.derived, light);
  const targets = riteTargets(w).filter(e => !Boss.protectedByFog(w, e));
  let ended = 0, stood = 0;
  for (const e of targets) {
    const stat = enemyDef(e.def);
    addSpellFx(w, 'smite', e.x, e.y);
    if ((e.eating ?? 0) > 0) e.eating = undefined;
    e.alert = 8;
    e.lastSeenX = w.player.x;
    e.lastSeenY = w.player.y;
    if (grade === 'full' && judgementEnds(e)) {
      const dealt = Math.max(1, e.hp);
      w.hurt(e, dealt, 'Judged', def.color);
      recordDamageDealt(w.state.bestiary, Combat.view(w, e).id, dealt);
      EnemyAi.markRemains(w, e, 'sanctified');
      Combat.killEnemy(w, e);
      ended++;
      continue;
    }
    const hit = playerHitsEnemy(w.rng, view, 1, Combat.view(w, e), defensePower(e.power) * w.diff.enemyDefense);
    if (stat.undead) hit.damage *= 2;
    w.hurt(e, hit.damage, hit.crit ? `${hit.damage}!` : `${hit.damage}`, hit.crit ? '#ffe040' : def.color);
    recordDamageDealt(w.state.bestiary, Combat.view(w, e).id, hit.damage);
    if (e.hp <= 0) {
      EnemyAi.markRemains(w, e, 'sanctified');
      Combat.killEnemy(w, e);
      if (stat.undead) ended++;
    } else if (stat.undead && grade === 'full' && stat.behavior !== 'boss') stood++;
  }
  if (!targets.length) {
    const tile = riteEmptyTile(w);
    addSpellFx(w, 'smite', tile.x, tile.y);
    w.msg(`${def.name} finds no one to judge.`, '#888');
  } else if (ended) {
    w.msg(`The light ends ${ended === 1 ? 'the dead thing' : `${ended} dead things`}. They will stay down.`, def.color);
    if (stood) w.msg(stood === 1 ? 'One stands under it, burning.' : `${stood} stand under it, burning.`, def.color);
  } else if (stood) {
    w.msg(stood === 1 ? 'The dead thing stands under the light, burning.' : `${stood} dead things stand under the light, burning.`, def.color);
  } else {
    w.msg(grade === 'weak' ? 'The trace wavers: the light comes down thin.' : 'Light comes down on the room.', def.color);
  }
  weaveFrom(w, light);
  w.sfx('magic');
  w.emit({ type: 'float', x: w.player.x, y: w.player.y, text: grade === 'weak' ? 'Judgement, thinly!' : 'Judgement!', color: def.color });
}

/**
 * The Great Penguining: Hex, on the whole room at once. Those who refuse a
 * hex refuse this; a sloppy trace wears off in half the time.
 */
export function castPenguining(w: World, def: RiteDef, grade: RiteGrade): void {
  const seconds = grade === 'weak' ? HEX_SECONDS / 2 : HEX_SECONDS;
  const targets = riteTargets(w).filter(e => !Boss.protectedByFog(w, e));
  let birds = 0;
  for (const e of targets) {
    if (polymorph(w, e, seconds, def.color, true) !== 'refused') birds++;
  }
  if (!targets.length) {
    const tile = riteEmptyTile(w);
    addSpellFx(w, 'poof', tile.x, tile.y, true);
    w.msg(`${def.name} finds no one to make a penguin of.`, '#888');
  } else if (birds) {
    w.msg(birds === 1 ? 'It is a penguin.' : `${birds} monsters are penguins. The room waddles.`, def.color);
  }
  weaveFrom(w, conduitSpell('hex'));
  w.sfx('magic');
  w.emit({ type: 'float', x: w.player.x, y: w.player.y, text: grade === 'weak' ? 'Penguins, briefly!' : 'Penguins!', color: def.color });
}

export function landMeteor(w: World, fx: SpellFx): void {
  const pending = fx.meteor;
  delete fx.meteor;
  // Nothing lands across the living throne boundary, not even the fire on
  // the tile: the one guard for target and tile alike.
  if (pending && Boss.protectedByFog(w, pending.target)) return;
  // Impacts use the same elemental reaction path as bolts and burning feet.
  Hazards.elementReaches(w, fx.x, fx.y, 'fire');
  if (!pending || pending.target.ai === 'dead') return;
  const { target: e, damage, crit } = pending;
  w.hurt(e, damage, crit ? `${damage}!` : `${damage}`, crit ? '#ffe040' : '#ff9a50');
  e.alert = 8;
  e.lastSeenX = w.player.x;
  e.lastSeenY = w.player.y;
  recordDamageDealt(w.state.bestiary, Combat.view(w, e).id, damage);
  if (damage > 0) e.burn = { t: BURN_SECONDS, left: (e.burn?.left ?? 0) + Math.max(1, Math.round(damage * BURN_SHARE)), acc: e.burn?.acc ?? 0 };
  if (e.hp <= 0) Combat.killEnemy(w, e);
  else Hazards.slip(w, e);
}

/**
 * A botched trace turns on you, in the element of the mark it came
 * closest to: fire falls on your own tile, frost holds you fast, the light
 * judges you, and shadow drinks what the conduit had left.
 */
export function botchedRite(w: World, def: RiteDef = rite('meteor')): void {
  const full = 20 + w.run.depth * 2;
  const dmg = def.element === 'fire' || def.element === 'holy' ? full : Math.round(full / 2);
  w.sfx('hurt');
  w.emit({ type: 'shake', amount: 0.6 });
  w.emit({ type: 'float', x: w.player.x, y: w.player.y, text: `-${dmg}`, color: '#ff6a50' });
  w.player.hp = Math.max(1, w.player.hp - dmg);
  if (def.element === 'frost') {
    w.anim.stunT = Math.max(w.anim.stunT, RITE_BOTCH_FREEZE);
    addSpellFx(w, 'frost', w.player.x, w.player.y);
    w.msg('The ice closes over you instead.', def.color);
  } else if (def.element === 'shadow') {
    const pool = w.run.conduit;
    if (pool) {
      pool.charges = 0;
      pool.regrow = 0;
    }
    addSpellFx(w, 'poof', w.player.x, w.player.y);
    w.msg('The shadow drinks your conduit dry.', def.color);
  } else if (def.element === 'holy') {
    addSpellFx(w, 'smite', w.player.x, w.player.y);
    w.msg('The light comes down on you. You are found wanting.', def.color);
  }
}

export function launchSpell(w: World, id: string): void {
  const spell = findConduitSpell(id);
  const snapshot = w.anim.attackSnapshot;
  if (!spell || !snapshot) return;
  if (spell.hitscan) {
    castHitscan(w, spell, snapshot);
    return;
  }
  w.projectiles.push({
    id: w.projN++, x: w.player.x + 0.5, y: w.player.y + 0.5,
    dx: DX[w.player.facing], dy: DY[w.player.facing], speed: spell.speed,
    damage: w.anim.attackPower, type: spell.element, sprite: spell.sprite, light: spell.light,
    tileX: w.player.x, tileY: w.player.y, source: 'your spell',
    thrownRange: spell.range, traveled: 0, player: snapshot, weaponUid: w.anim.attackWeaponUid ?? undefined,
    spell: spell.id,
  });
  w.sfx('shoot');
}

/**
 * Smite and Hex: no bolt. The spell lands the moment the cast releases, on
 * the first monster down your line within its range. A wall or the King's
 * threshold stops the line as it stops a bolt. With nothing there, the mark
 * flickers out at the end of the line so a miss is still something you saw.
 */
export function castHitscan(w: World, spell: ConduitSpellDef, snapshot: PlayerDerived): void {
  let prev = { x: w.player.x, y: w.player.y };
  for (let d = 1; d <= spell.range; d++) {
    const t = w.frontTile(d);
    if (blocksSight(w.floor, t.x, t.y) || Boss.crossesBossBoundary(w, prev.x, prev.y, t.x, t.y)) break;
    const foe = enemyAt(w.floor, t.x, t.y);
    if (foe) {
      spellLands(w, spell, foe, snapshot, w.anim.attackPower);
      return;
    }
    prev = t;
  }
  if (prev.x !== w.player.x || prev.y !== w.player.y) addSpellFx(w, spell.id === 'hex' ? 'poof' : 'smite', prev.x, prev.y, true);
  w.msg(`${spell.name} finds nothing to strike.`, '#888');
  w.sfx('break', prev.x, prev.y);
}

export function addSpellFx(w: World, kind: SpellFx['kind'], x: number, y: number, miss = false): void {
  w.spellFx.push({ id: w.projN++, kind, x, y, t: 0, ...(miss ? { miss } : {}) });
}

/** A battle bolt arriving. */
export function spellHit(w: World, pr: Projectile, e: EnemyState): void {
  const spell = findConduitSpell(pr.spell);
  if (spell) spellLands(w, spell, e, pr.player ?? w.derived, pr.damage);
}

/** A battle spell landing: the hit, its rider, and the weave it leaves on your blade. */
export function spellLands(w: World, spell: ConduitSpellDef, e: EnemyState, player: PlayerDerived, power: number): void {
  if (Boss.protectedByFog(w, e)) return;
  const def = Combat.view(w, e);
  if ((e.eating ?? 0) > 0) e.eating = undefined;
  if (spell.id === 'hex') {
    if (hexLands(w, spell, e)) weaveFrom(w, spell);
    return;
  }
  // A raised shield takes a spell the way it takes a shaft: on the guard.
  // Smite comes down from above, where no shield is held.
  const reaction = spell.id === 'smite' ? null : Combat.guardReaction(w, e, def);
  if (reaction) {
    Combat.shieldChip(w, e, def, 1, power, player);
    return;
  }
  if (spell.id === 'smite') addSpellFx(w, 'smite', e.x, e.y);
  const hit = playerHitsEnemy(w.rng, player, power, def, defensePower(e.power) * w.diff.enemyDefense);
  const exposed = !!e.vuln && e.vuln > 0;
  if (exposed) hit.damage = Math.round(hit.damage * PARRY_VULN_MULT);
  w.hurt(e, hit.damage, hit.crit || exposed ? `${hit.damage}!` : `${hit.damage}`, hit.crit ? '#ffe040' : hit.effective === 'resist' ? '#9a9aa8' : spell.color);
  e.alert = 8;
  e.lastSeenX = w.player.x;
  e.lastSeenY = w.player.y;
  recordDamageDealt(w.state.bestiary, def.id, hit.damage);
  w.sfx(hit.crit ? 'crit' : 'hit', e.x, e.y);
  if (player.stats.leech > 0) w.heal(Math.max(1, Math.round(hit.damage * player.stats.leech / 100)), 'leech');
  if (spell.id === 'ember_bolt' && hit.damage > 0) {
    const total = Math.max(1, Math.round(hit.damage * BURN_SHARE));
    e.burn = { t: BURN_SECONDS, left: (e.burn?.left ?? 0) + total, acc: e.burn?.acc ?? 0 };
  }
  if (spell.id === 'rime_lance' && def.behavior !== 'boss') e.chillT = CHILL_SECONDS;
  weaveFrom(w, spell);
  if (e.hp <= 0) {
    // Holy light from above: what Smite kills stays down.
    if (spell.id === 'smite') EnemyAi.markRemains(w, e, 'sanctified');
    if (w.derived.traits.requiem) refundCharges(w, spell.charges);
    Combat.killEnemy(w, e);
  } else Hazards.slip(w, e);
}

/** Put charges back in the worn conduit's pool, never past full. */
export function refundCharges(w: World, n: number): void {
  const pool = w.run.conduit, c = w.derived.conduit;
  if (pool && c) pool.charges = Math.min(c.charges, pool.charges + n);
}

/** Weave: a landed spell's element now rides on your next blow. */
export function weaveFrom(w: World, spell: ConduitSpellDef): void {
  w.anim.weave = { t: WEAVE_SECONDS, element: spell.element, amount: Math.round(w.derived.conduitPower * WEAVE_SHARE) };
}

/**
 * Hex: the monster is a penguin for `HEX_SECONDS`. Whatever it was in the
 * middle of stops — a wind-up, a flurry, a chant over a corpse, a mimic's
 * grip on you — and it waddles until the spell runs out (`updateHexed`).
 * Damage does not break it. The King and the floor lieutenants refuse it,
 * and a refusal gives the charges back: you could not have known until it
 * landed, and the stamina is price enough.
 */
export function hexLands(w: World, spell: ConduitSpellDef, e: EnemyState): boolean {
  if (polymorph(w, e, HEX_SECONDS, spell.color) !== 'refused') return true;
  refundCharges(w, spell.charges);
  return false;
}

/** The penguin itself, for Hex and the Great Penguining alike. `quiet` leaves the telling to the rite. */
export function polymorph(w: World, e: EnemyState, seconds: number, color: string, quiet = false): 'refused' | 'fresh' | 'again' {
  const def = enemyDef(e.def);
  const refused = def.behavior === 'boss' || !!e.lieutenant;
  addSpellFx(w, 'poof', e.x, e.y, refused);
  if (refused) {
    w.msg(def.behavior === 'boss' ? 'The King will not be made a fool of. The hex slides off him.' : `The ${def.name} shrugs the hex off.`, '#c8a0ff');
    w.sfx('break', e.x, e.y);
    return 'refused';
  }
  const fresh = !(e.hexT && e.hexT > 0);
  e.hexT = Math.max(e.hexT ?? 0, seconds);
  if (e.ai === 'windup' || e.ai === 'recover' || e.ai === 'flee') e.ai = 'wander';
  delete e.move;
  delete e.feintT;
  delete e.feinted;
  delete e.comboLeft;
  delete e.comboT;
  delete e.channel;
  if ((e.frozenT ?? 0) > 0) delete e.frozenT;
  if ((e.grabT ?? 0) > 0) {
    delete e.grabT;
    w.msg('It lets go. Penguins cannot hold on to anything.', '#c8a0ff');
  }
  e.guard = 'down';
  e.alert = Math.max(e.alert, 6);
  if (!quiet) {
    if (fresh) w.msg(`The ${def.name} is a penguin.`, color);
    else w.msg(`The penguin stays a penguin a while longer.`, color);
  }
  w.sfx('magic', e.x, e.y);
  return fresh ? 'fresh' : 'again';
}

/** The hex runs out: a puff of smoke, and it is itself, awake and close. */
export function unhex(w: World, e: EnemyState): void {
  delete e.hexT;
  addSpellFx(w, 'poof', e.x, e.y);
  w.msg(`The ${enemyDef(e.def).name} is itself again.`, '#c8a0ff');
  w.sfx('magic', e.x, e.y);
  e.ai = manhattan(e.x, e.y, w.player.x, w.player.y) <= 6 ? 'chase' : 'idle';
  e.alert = Math.max(e.alert, 6);
  e.attackCd = Math.max(e.attackCd, 0.8);
}

/**
 * A penguin's turn: no attack, no guard, no chant, no theft, no flight.
 * It waddles about a step at a time, near enough at random, and when the
 * hex runs out it is itself again, wide awake and close to you.
 */
export function updateHexed(w: World, e: EnemyState, dt: number): void {
  e.guard = 'down';
  e.ai = 'wander';
  if (w.rng.chance(dt / 0.8)) {
    const steps = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number]).filter(([x, y]) => EnemyAi.canStep(w, e, x, y));
    if (steps.length) {
      const [x, y] = w.rng.pick(steps);
      EnemyAi.stepEnemy(w, e, x, y);
    }
  }
}

/** A charge grows back while the conduit is worn, and kills hurry it along. */
export function updateConduit(w: World, dt: number): void {
  const a = w.anim;
  if (w.spellFx.length) {
    let landed = false;
    for (const fx of w.spellFx) {
      const before = fx.t;
      fx.t += dt;
      if (fx.kind !== 'meteor') continue;
      if (fx.meteor && fx.meteor.target.ai !== 'dead') { fx.x = fx.meteor.target.x; fx.y = fx.meteor.target.y; }
      if (before < METEOR_FALL_SECONDS && fx.t >= METEOR_FALL_SECONDS) {
        landMeteor(w, fx);
        landed = true;
      }
    }
    if (landed) {
      w.sfx('meteor');
      w.emit({ type: 'shake', amount: 0.8 });
      w.emit({ type: 'sigil', r: 1, g: 0.3, b: 0.06, strength: 0.35 });
    }
    w.spellFx = w.spellFx.filter((fx) => fx.t < SPELL_FX_SECONDS[fx.kind]);
  }
  if (a.weave) {
    a.weave.t -= dt;
    if (a.weave.t <= 0) a.weave = null;
  }
  const c = w.derived.conduit;
  const pool = w.run.conduit;
  if (!c || !pool) return;
  growConduit(w, c.charges, c.regrow, dt);
}

export function growConduit(w: World, max: number, per: number, seconds: number): void {
  const pool = w.run.conduit;
  if (!pool) return;
  if (pool.charges >= max) {
    pool.regrow = 0;
    return;
  }
  pool.regrow += seconds;
  while (pool.regrow >= per && pool.charges < max) {
    pool.regrow -= per;
    pool.charges++;
  }
  if (pool.charges >= max) pool.regrow = 0;
}

/** Kills shave the regrow, under the same fifth-of-a-cycle cap as a sigil. */
export function refundConduit(w: World, def: EnemyDef): void {
  const c = w.derived.conduit;
  if (!c) return;
  const base = 1 + 4 * Math.min(1, def.hp / 140);
  const multiplier = 1 + 0.25 * metaLevel(w.state.meta, 'attunement') + w.derived.stats.focus / 100;
  growConduit(w, c.charges, c.regrow, Math.min(base * multiplier, c.regrow * 0.2));
}

/** Everything that a deliberate action of your own cancels. */
export function breakChannels(w: World): void {
  const a = w.anim;
  if (a.recall !== null) {
    a.recall = null;
    w.msg('The recall fizzles.', '#888');
  }
  if (a.retrieving) {
    a.retrieving = null;
    w.msg('You stop calling them back.', '#888');
  }
}
