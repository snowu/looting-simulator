/**
 * What you carry and what you do with it: taking from a pickup, dropping,
 * using an item (draughts, scrolls, tomes, identify and repair targets,
 * food), and the quick slots. World keeps one-line delegates for each, so
 * the UI and input code still call world.use(uid) and the rest.
 */
import { dirOf } from '../core/dir';
import { enemyDef } from '../data/enemies';
import { consumable } from '../data/items';
import { addItem, canFit, findItem, removeItem, roomFor } from '../state/inventory';
import { loreName, unlockEntry } from '../systems/bestiary';
import { blocksMove, blocksSight, enemyAt, EnemyState } from '../systems/dungeon';
import { CHEW_SECONDS, flaskMax } from '../systems/healing';
import { draught } from '../systems/infusion';
import { identify, itemName } from '../systems/items';
import { Item } from '../types';
import * as Boss from './boss';
import * as Loot from './loot';
import * as Traps from './traps';
import * as Vitals from './vitals';
import type { World } from './world';
import { TONICS } from './world';

/**
 * Start chewing the morsel underfoot or faced. [F] is always deliberate, so
 * unlike the one-button tap it eats even with something hunting you; the
 * 1.2s chew and the dropped morsel on a hit are the price, not a refusal.
 */
export function eatMorsel(w: World): boolean {
  if (w.busy || w.moving || w.anim.attack !== 'idle' || w.anim.cast) return false;
  const morsel = w.morselNear();
  if (!morsel) return false;
  w.anim.chew = { id: morsel.id, left: CHEW_SECONDS, delivered: 0, total: Math.round(w.derived.maxHp * morsel.remaining) };
  w.held.clear();
  w.msg(`You eat the ${morsel.kind}.`, '#d8c098');
  return true;
}

/** Move items from a pickup into the backpack. Returns how many stacks moved. */
export function take(w: World, pickupId: string, uid?: string): number {
  const pk = w.floor.pickups.find((p) => p.id === pickupId);
  if (!pk) return 0;
  let moved = 0;
  if (pk.flaskShard && (w.state.flask?.shards ?? 0) < 3) {
    w.state.flask.shards++;
    w.run.flask.charges = Math.min(flaskMax(w.state.flask.shards, w.diff.flaskBonus), w.run.flask.charges + 1);
    pk.flaskShard = false;
    if (w.state.flask.shards >= 3) {
      for (const fl of w.run.floors ?? []) for (const other of fl?.pickups ?? []) other.flaskShard = false;
      Loot.prunePickups(w);
    }
    moved++;
    w.msg('The Flask Shard dissolves into the vessel. Its capacity grows.', '#9fe0cf');
  }
  for (const it of [...pk.items]) {
    if (uid && it.uid !== uid) continue;
    // Field notes are read where they lie. They never reach the pack, so a
    // bad run can't cost you the page, and a full pack can't block it.
    if (it.kind === 'lore') {
      const fresh = unlockEntry(w.state.bestiary, it.ref);
      pk.items = pk.items.filter((i) => i !== it);
      w.msg(fresh ? `${loreName(it.ref)} — added to the codex.` : 'You already know these notes.', '#c8b8ff');
      w.sfx('study');
      moved++;
      continue;
    }
    const before = it.qty;
    const left = addItem(w.run.backpack, it);
    if (left < before) {
      moved++;
      Loot.recordUnique(w, it);
    }
    if (left === 0) pk.items = pk.items.filter((i) => i !== it);
    else it.qty = left;
  }
  if (moved) {
    w.run.stats.itemsFound += moved;
    w.sfx('pickup');
  } else if (pk.items.length) {
    w.msg('Your pack is full.', '#ff9070');
  }
  Loot.prunePickups(w);
  return moved;
}

export function canTake(w: World, item: Item): boolean {
  return canFit(w.run.backpack, item) || roomFor(w.run.backpack, item) > 0;
}

export function drop(w: World, uid: string, pickupId?: string): void {
  const it = removeItem(w.run.backpack, uid);
  if (!it) return;
  if (pickupId) {
    // Dropping while a loot pile is open puts it straight back on that
    // pile, so a full pack can be swapped one for one without closing the
    // panel. The pile may sit in front of you rather than underfoot.
    const pk = w.floor.pickups.find((p) => p.id === pickupId);
    if (pk) {
      pk.items.push(it);
      w.sfx('ui');
      return;
    }
  }
  Loot.dropLoot(w, w.player.x, w.player.y, [it], 0);
  w.sfx('ui');
}

/** Equipment in the pack still waiting to be identified. */
export function unidentifiedItems(w: World): Item[] {
  return w.run.backpack.items.filter((i) => i.kind === 'equipment' && i.identified === false);
}

export function use(w: World, uid: string, targetUid?: string): void {
  if (w.run.outcome !== 'active') return;
  const it = findItem(w.run.backpack, uid);
  if (!it) return;
  if (it.kind === 'blueprint') {
    w.msg('Study it back in town at the forge.', '#9ab0d8');
    return;
  }
  if (it.kind !== 'consumable') return;
  const def = consumable(it.ref);
  const e = def.effect;
  switch (e.type) {
    case 'heal':
      if (w.player.hp >= w.derived.maxHp) {
        w.msg('You are already at full health.', '#888');
        return;
      }
      Vitals.heal(w, Math.round(w.derived.maxHp * e.fraction));
      w.sfx('drink');
      break;
    case 'stamina':
      w.player.stamina = w.derived.maxStamina;
      w.sfx('drink');
      break;
    case 'tonic': {
      const tonic = TONICS[e.tonicId];
      if (!tonic) return;
      // Fight Milk stopped being drunk when the flask took over healing. A
      // bottle the flask can take is a forge infusion now; drinking it would
      // bypass the potency trade the infusion charges for. Legacy delves that
      // already drank keep their run.tonics effect until that run ends.
      if (draught(it.ref)) {
        w.msg('Too precious to drink raw. The forge can infuse the flask with it.', '#e8b84a');
        return;
      }
      const tonics = (w.run.tonics ??= []);
      // Two of the same draught is two of the same draught. It is already in
      // you; drinking another would only cost you the bottle.
      if (tonics.includes(e.tonicId)) {
        w.msg(`You already reek of ${tonic.name}.`, '#888');
        return;
      }
      tonics.push(e.tonicId);
      w.refreshDerived();
      w.sfx('drink');
      w.msg(`${tonic.name}, for the rest of the delve. ${tonic.text}`, '#e8b84a');
      break;
    }
    case 'identify': {
      const unids = unidentifiedItems(w);
      if (!unids.length) {
        w.msg('Nothing in your pack needs identifying.', '#888');
        return;
      }
      // A caller may name which item the scroll is read over; without a
      // choice the UI asks, and headless callers (quick-slots, tests) fall
      // back to the first. The scroll is only spent when something is
      // actually identified.
      let target = targetUid ? unids.find((i) => i.uid === targetUid) : undefined;
      if (targetUid && !target) {
        w.msg('That doesn\'t need identifying.', '#888');
        return;
      }
      target ??= unids[0];
      identify(target!);
      Loot.recordUnique(w, target!);
      w.msg(`It is: ${itemName(target!)}.`, '#c8b8ff');
      w.sfx('magic');
      break;
    }
    case 'recall':
      if (w.anim.recall !== null) return;
      if (Boss.playerInThrone(w) && Boss.bossAlive(w)) {
        w.msg('The fog smothers the scroll. No way out but through him.', '#c0a0ff');
        w.sfx('locked');
        return;
      }
      w.anim.recall = e.seconds;
      w.msg(
        w.run.portal ? 'You read the scroll. The old portal will collapse...' : 'You read the scroll. Stand still...',
        '#9ac0ff',
      );
      w.sfx('magic');
      break;
    case 'flash': {
      // Blinding true light, and it burns whether it lands or not. Whiff it
      // into empty air and you have one fewer scroll — that is the lesson.
      let target: EnemyState | undefined;
      for (let d = 1; d <= 3; d++) {
        const t = w.frontTile(d);
        const foe = enemyAt(w.floor, t.x, t.y);
        if (foe) {
          const toward = dirOf(Math.sign(w.player.x - foe.x), Math.sign(w.player.y - foe.y));
          if (foe.alert > 0 && toward === foe.facing) target = foe;
          break;
        }
        if (blocksSight(w.floor, t.x, t.y)) break;
      }
      w.anim.recall = null; w.anim.sip = null; w.anim.chew = null;
      // True light, seen: a white-hot wash over the whole view, stronger
      // than any sigil landing. Reuses the sigil flash path in the
      // renderer, so headless callers and saves see nothing new.
      w.emit({ type: 'sigil', r: 1.0, g: 0.97, b: 0.88, strength: 0.85 });
      if (!target) {
        w.msg('Light bursts over nothing. There is nothing looking at you.', '#888');
        w.sfx('magic', w.player.x, w.player.y);
        break;
      }
      if (enemyDef(target.def).behavior === 'boss') {
        // No blind, no cancelled wind-up, no lost trail: a blind that ran
        // through the ordinary AI reset his wind-up and could drop his aggro.
        w.msg('The King does not blink.', '#c0a0ff');
        w.sfx('magic', target.x, target.y);
        break;
      }
      const save = target.ai === 'windup';
      target.blind = save ? 3 : 2;
      if (save) { target.ai = 'recover'; target.timer = target.blind; }
      target.guard = 'down'; target.guardT = target.blind;
      w.msg(save ? 'Caught it in the light!' : `${enemyDef(target.def).name} reels from the flash.`, '#fff2a0');
      w.sfx('magic', target.x, target.y);
      break;
    }
    case 'backstep': {
      const now = w.run.stats.time;
      const candidates = w.trail.filter((p) => now - p.time <= 2 && (p.x !== w.player.x || p.y !== w.player.y)).slice(-4);
      const dest = candidates.find((p) => !blocksMove(w.floor, p.x, p.y) && !enemyAt(w.floor, p.x, p.y));
      w.anim.recall = null; w.anim.sip = null; w.anim.chew = null;
      if (!dest) {
        w.msg('The scroll comes to nothing. You have been nowhere.', '#888');
        break;
      }
      w.placePlayer(dest.x, dest.y, dest.facing);
      Traps.reveal(w);
      w.sfx('recall'); w.emit({ type: 'shake', amount: 0.22 });
      w.msg('The scroll snaps you back along your path.', '#9ac0ff');
      break;
    }
  }
  it.qty -= 1;
  if (it.qty <= 0) removeItem(w.run.backpack, uid);
}

/**
 * Distinct consumable refs in the pack, in the player's chosen quick-bar
 * order. Saved order wins for refs still carried; anything new appends in
 * backpack order, and anything gone is ignored — so the bar never points at
 * something you no longer have.
 */
export function quickRefs(w: World): string[] {
  const present: string[] = [];
  for (const it of w.run.backpack.items) {
    if (it.kind !== 'consumable' || present.includes(it.ref)) continue;
    // An infusion ingredient (Fight Milk) rides in the pack, not as a drink.
    // It is spent at the forge bench, so it never takes a quick-bar slot.
    if (draught(it.ref)) continue;
    present.push(it.ref);
  }
  const saved = w.run.quickOrder ?? [];
  const ordered = saved.filter((r) => present.includes(r));
  for (const r of present) if (!ordered.includes(r)) ordered.push(r);
  return ordered;
}

/** Move a quick-bar entry from one position to another (drag reorder). */
export function moveQuick(w: World, from: number, to: number): void {
  const refs = quickRefs(w);
  if (from < 0 || from >= refs.length || to < 0 || to >= refs.length || from === to) return;
  const [moved] = refs.splice(from, 1);
  refs.splice(to, 0, moved);
  w.run.quickOrder = refs;
}

/** Quick-slot use: nth distinct consumable in the player's bar order. */
export function quickUse(w: World, slot: number): void {
  const refs = quickRefs(w);
  const ref = refs[slot];
  if (!ref) return;
  const it = w.run.backpack.items.find((i) => i.kind === 'consumable' && i.ref === ref);
  if (it) use(w, it.uid);
}
