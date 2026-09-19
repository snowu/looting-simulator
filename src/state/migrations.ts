import { GameState } from './game-state';
import { Floor, shrineKindFor } from '../systems/dungeon';
import { addItem, Container, createContainer } from './inventory';
import { BASE_BACKPACK } from '../systems/meta';
import { newId } from '../core/id';
import { STARTER_RECIPES } from '../data/recipes';
import { MATERIALS } from '../data/materials';
import { itemBase } from '../data/items';
import { itemValue, makeMaterial } from '../systems/items';
import { draught } from '../systems/infusion';
import { flaskMax } from '../systems/healing';
import { findSigil } from '../data/spells';

/**
 * Additive save migrations.
 *
 * `SAVE_VERSION` in game-state.ts is the *format family*: changing it throws
 * every existing save away, so it must only move for a genuinely unreadable
 * change. Everything else — a new field on an item, a new array on a floor, a
 * new meta upgrade — is additive, and lands here instead as a new revision.
 *
 * `MIGRATIONS[i]` upgrades a save at revision `i` to revision `i + 1`. Saves
 * written before revisions existed have no `revision` field and count as 0, so
 * they run through every step. Each step must be safe to apply to a partially
 * built state and must never throw: a player mid-run is relying on it.
 */

/** Bump this (and push a migration) whenever a field is added to the save. */
export const SAVE_REVISION = 29;

type AnyState = GameState & Record<string, unknown>;

const MIGRATIONS: ((s: AnyState) => void)[] = [
  // 0 → 1: backfill the containers and collections that later code indexes into
  // without checking. Saves from before revisions existed predate this guard.
  (s) => {
    s.meta ??= {};
    s.knownRecipes ??= [];
    s.contracts ??= [];
    s.lifetime ??= { runs: 0, deaths: 0, extractions: 0, bestDepth: 0, goldEarned: 0, kills: 0 };
    s.lastRun ??= null;
    s.run ??= null;
    if (s.run) {
      s.run.keys ??= [];
      s.run.floors ??= [];
      for (const f of s.run.floors) if (f) normalizeFloor(f);
    }
  },
  // 1 → 2: floors grew traps. A floor generated before they existed simply has
  // none — regenerating it would move the walls under a player mid-run.
  (s) => {
    for (const f of s.run?.floors ?? []) if (f) f.traps ??= [];
  },
  // 2 → 3: a town-side loadout to pack before a delve, and the open town
  // portal a Scroll of Recall leaves behind. Older runs have neither.
  (s) => {
    s.loadout ??= createContainer(BASE_BACKPACK);
    s.loadout.items ??= [];
    if (s.run) s.run.portal ??= null;
  },
  // 3 → 4: monsters carry the opening a parry leaves in their guard. Nothing
  // mid-fight in an old save was parried, so they all start closed.
  (s) => {
    for (const f of s.run?.floors ?? []) for (const e of f?.enemies ?? []) e.vuln ??= 0;
  },
  // 4 → 5: the last run remembers whether it turned the day. Before this every
  // run did, so an older summary is a day that turned.
  (s) => {
    if (s.lastRun) s.lastRun.dayTurned ??= true;
  },
  // 5 → 6: existing chests stay honest. Only newly generated floors roll
  // mimics, so loading a save cannot change what the player already saw.
  (s) => {
    for (const f of s.run?.floors ?? []) for (const p of f?.props ?? []) p.mimic ??= false;
  },
  // 6 → 7: shrines gained a flavour and runs gained curses. An existing shrine
  // takes the flavour a freshly generated one would, so old and new floors
  // agree, and nothing in progress is retroactively cursed.
  (s) => {
    if (s.run) s.run.curse ??= null;
    for (const f of s.run?.floors ?? []) {
      if (!f) continue;
      for (const p of f.props ?? []) if (p.kind === 'shrine') p.shrine ??= shrineKindFor(f.seed, p.id);
    }
  },
  // 7 → 8: a playthrough gains an identity of its own, so sync can match it
  // across devices instead of trusting which slot it landed in. An existing
  // save is the same game it always was and simply gets an id assigned.
  (s) => {
    s.saveId ??= newId();
  },
  // 8 → 9: blueprints become repeatable recipe mastery. Every recipe that was
  // already known starts at rank 1, as do the recipes every smith starts with.
  (s) => {
    const known = Array.isArray(s.knownRecipes) ? s.knownRecipes.filter((id): id is string => typeof id === 'string') : [];
    const ranks: Record<string, number> = {};
    for (const id of [...STARTER_RECIPES, ...known]) ranks[id] = 1;
    s.recipeRanks = ranks;
    delete s.knownRecipes;
  },
  // 9 → 10: market state is persisted, so a newly added material needs a
  // commodity row before town can render it. It starts unavailable and enters
  // ordinary restocking once the player reaches its progression depth.
  backfillCommodities,
  // 10 → 11: blueprints stack by recipe. Re-adding persisted containers folds
  // existing duplicate rows together using the same rules as future pickups.
  (s) => {
    restack(s.stash);
    restack(s.loadout);
    restack(s.run?.backpack);
  },
  // 11 → 12: the bestiary codex. Purely additive — an existing save simply
  // starts with an empty codex and fills it from the next kill onward.
  (s) => {
    s.bestiary ??= {};
  },
  // 12 → 13: the record of which bespoke legendaries have dropped. An existing
  // playthrough has found none of them, which is the honest answer — they did
  // not exist to find, and it means the next King owes you a new one.
  (s) => {
    s.lifetime ??= { runs: 0, deaths: 0, extractions: 0, bestDepth: 0, goldEarned: 0, kills: 0 };
    s.lifetime.uniquesSeen ??= [];
  },
  // 13 → 14: delve-long draughts. A run already in progress has drunk none,
  // which is the truth — there was nothing to drink.
  (s) => {
    if (s.run) s.run.tonics ??= [];
  },
  // 14 → 15: the codex splits "held" from "identified". Anything already in the
  // found list was recorded under the old rule and was already legible in the
  // codex, so it carries across as named rather than being taken away.
  (s) => {
    s.lifetime ??= { runs: 0, deaths: 0, extractions: 0, bestDepth: 0, goldEarned: 0, kills: 0 };
    s.lifetime.uniquesKnown ??= [...(s.lifetime.uniquesSeen ?? [])];
  },
  // 15 → 16: a player-given name for the title-screen slots. An older save
  // never had one, so it stays unnamed and keeps showing "Slot N".
  (s) => {
    if (typeof s.name !== 'string') s.name = '';
  },
  // 16 → 17: a town-side difficulty setting plus the snapshot each run carries.
  // Everything before this was the current game, which is now called Hard, so
  // an older save — in town or mid-delve — lands on Hard and plays on exactly
  // as before.
  (s) => {
    if (s.difficulty !== 'normal' && s.difficulty !== 'hard') s.difficulty = 'hard';
    if (s.run && s.run.difficulty !== 'normal' && s.run.difficulty !== 'hard') {
      s.run.difficulty = s.difficulty;
    }
  },
  // 17 → 18: recoverable thrown stock and sigils. Missing means the player has
  // not discovered or equipped either system yet; existing floor state stays put.
  (s) => {
    s.spells ??= [];
    s.spells = [...new Set(s.spells.filter((id) => typeof id === 'string' && findSigil(id)))];
    s.attuned ??= null;
    if (s.attuned !== null && (!findSigil(s.attuned) || !s.spells.includes(s.attuned))) s.attuned = null;
    if (s.run) {
      s.run.thrown ??= { held: {}, retrieveCd: 0 };
      s.run.thrown.held ??= {};
      for (const [base, held] of Object.entries(s.run.thrown.held)) {
        s.run.thrown.held[base] = Number.isFinite(held) ? Math.max(0, Math.trunc(held)) : 0;
      }
      s.run.thrown.retrieveCd = Number.isFinite(s.run.thrown.retrieveCd) ? Math.max(0, s.run.thrown.retrieveCd) : 0;
      s.run.sigil ??= null;
      if (s.run.sigil) {
        if (!findSigil(s.run.sigil.id)) s.run.sigil = null;
        else s.run.sigil.cd = Number.isFinite(s.run.sigil.cd) ? Math.max(0, s.run.sigil.cd) : 0;
      }
      for (const f of s.run.floors ?? []) if (f) normalizeFloor(f);
    }
  },
  (s) => { s.recipeSalvage ??= {}; },
  // 19 → 20: crafted gear may carry secondary2Id. Absence means no extra
  // material, so existing items require no mutation. Stamp the new revision
  // so older clients cannot upload saves that ignore the extra slot's stats.
  () => {},
  // 20 → 21: the delve quick bar gains a player-chosen order. Older saves used
  // backpack order, so an empty list preserves exactly what they already saw.
  (s) => {
    if (s.run) {
      const q = (s.run as { quickOrder?: unknown }).quickOrder;
      if (!Array.isArray(q)) (s.run as { quickOrder?: string[] }).quickOrder = [];
      else (s.run as { quickOrder?: string[] }).quickOrder = q.filter((r): r is string => typeof r === 'string');
    }
  },
  // 21 → 22: healing is a permanent flask plus floor food. Legacy healing
  // consumables are bought back at full value and Supply Crate is refunded.
  (s) => {
    const legacy = new Set(['healing_draught', 'greater_healing', 'stamina_tonic']);
    let refund = 0;
    for (const box of [s.stash, s.loadout, s.run?.backpack]) {
      if (!box?.items) continue;
      box.items = box.items.filter((it) => {
        if (it.kind !== 'consumable' || !legacy.has(it.ref)) return true;
        refund += itemValue(it) * it.qty;
        return false;
      });
    }
    s.gold = Math.max(0, Number(s.gold) || 0) + refund;
    const crate = Math.max(0, Math.trunc(s.meta?.supply_crate ?? 0));
    const costs = [5, 11, 18];
    s.renown = Math.max(0, Number(s.renown) || 0) + costs.slice(0, crate).reduce((a, b) => a + b, 0);
    if (s.meta) delete s.meta.supply_crate;
    const best = Math.max(0, Number(s.lifetime?.bestDepth) || 0);
    const king = Boolean(s.lastRun?.bossKilled);
    const earned = king ? 3 : best >= 5 ? 2 : best >= 3 ? 1 : 0;
    s.flask ??= { shards: earned, potency: 0, infusion: null };
    s.flask.shards = Math.max(earned, Math.min(3, Math.trunc(s.flask.shards || 0)));
    s.flask.potency = Math.max(0, Math.min(4, Math.trunc(s.flask.potency || 0)));
    s.flask.infusion ??= null;
    if (s.run) {
      s.run.flask ??= { charges: flaskMax(s.flask.shards), dregs: 0 };
      for (const f of s.run.floors ?? []) if (f) f.morsels ??= [];
    }
  },
  // 22 → 23: Hardcore, a third difficulty with one life, and the headstone a
  // fallen hero leaves. Nothing older can be Hardcore or fallen, so this only
  // settles the shape: every existing save is alive. Bumping the revision also
  // stops an out-of-date build — which would read 'hardcore' as plain Hard —
  // from uploading a Hardcore save it cannot honestly play.
  (s) => {
    s.fallen ??= null;
  },
  // 23 → 24: flask infusions became draughts. The gems whose stat has no sip
  // to give (Jade, Crystal, Moonstone, Emerald, Wardstone) can no longer sit
  // in the flask; whoever had one in gets the gem back, or its value if the
  // stash is full.
  (s) => {
    const ref = s.flask?.infusion;
    if (!ref || draught(ref)) return;
    const mat = MATERIALS.find((m) => m.id === ref);
    s.flask.infusion = null;
    if (!mat) return;
    if (!s.stash || addItem(s.stash, makeMaterial(ref)) > 0) s.gold = Math.max(0, Number(s.gold) || 0) + mat.value;
  },
  // 24 → 25: build properties. Nothing learned yet; items simply have none.
  (s) => {
    s.properties ??= [];
  },
  // 25 → 26: Delve Oaths. Nothing sworn, no reward waiting.
  (s) => {
    s.pendingOath ??= null;
    s.oathReward ??= null;
  },
  // 26 → 27: the corpse run. No grave waiting.
  (s) => {
    s.grave ??= null;
  },
  // 27 → 28: Ashen Seals. None set.
  (s) => {
    s.pendingSeals ??= [];
  },
  // 28 → 29: oaths stack. The single sworn oath, a delve's single oath and a
  // waiting reward's single oath all become lists.
  (s) => {
    s.pendingOaths ??= s.pendingOath ? [s.pendingOath] : [];
    s.pendingOath = null;
    if (s.run && s.run.oath && !s.run.oaths) {
      s.run.oaths = [s.run.oath];
      delete s.run.oath;
    }
    if (s.oathReward && s.oathReward.oath && !s.oathReward.oaths) s.oathReward.oaths = [s.oathReward.oath];
  },
];

/**
 * Give every material in the data a commodity row. Idempotent by design: a row
 * that already exists is left exactly as the player traded it, and a new one
 * starts at book value, unavailable, entering ordinary restocking once the
 * player reaches the depth it drops at.
 */
function backfillCommodities(s: AnyState): void {
  if (!s.market) return;
  s.market.commodities ??= {};
  for (const material of MATERIALS) {
    s.market.commodities[material.id] ??= {
      price: material.value,
      supply: 0,
      stock: 0,
      history: [material.value],
    };
  }
}

/**
 * Move a belt of shafts out of the weapon slot.
 *
 * Thrown weapons shipped in `weapon` and now have a slot of their own, so a
 * character who went to bed holding javelins would wake up with them wedged in
 * a slot that no longer accepts them: `derivePlayer` would read no swing off
 * them and the paper doll would not draw them. They go to the belt if it is
 * free, and to the stash if it is not, which is where an item you cannot wear
 * belongs. Only saves written by the unreleased weapon branch can be in this
 * state, but the rule is cheap and it is not worth being wrong about.
 */
function rehomeThrown(s: AnyState): void {
  const eq = s.equipment;
  if (!eq) return;
  eq.thrown ??= null;
  const worn = eq.weapon;
  if (!worn || worn.kind !== 'equipment') return;
  let base;
  try {
    base = itemBase(worn.ref);
  } catch {
    return;
  }
  if (base.slot !== 'thrown') return;
  eq.weapon = null;
  if (!eq.thrown) eq.thrown = worn;
  else if (s.stash) addItem(s.stash, worn);
}

function restack(container: Container | undefined): void {
  if (!container || !Array.isArray(container.items)) return;
  const items = container.items;
  container.items = [];
  for (const item of items) addItem(container, item);
}

/** Every array a Floor is expected to have, so old floors don't crash lookups. */
function normalizeFloor(f: Floor): void {
  f.rooms ??= [];
  f.doors ??= [];
  f.secrets ??= [];
  f.stairs ??= [];
  f.torches ??= [];
  f.props ??= [];
  f.pickups ??= [];
  f.thrown ??= [];
  f.morsels ??= [];
  const thrown = new Map<string, NonNullable<Floor['thrown']>[number]>();
  for (const marker of f.thrown) {
    if (!marker || typeof marker.base !== 'string' || !Number.isFinite(marker.x) || !Number.isFinite(marker.y) || !Number.isFinite(marker.n)) continue;
    const x = Math.trunc(marker.x), y = Math.trunc(marker.y), n = Math.max(0, Math.trunc(marker.n));
    if (!n) continue;
    const key = `${marker.base}:${x}:${y}`;
    const prior = thrown.get(key);
    if (prior) prior.n += n;
    else thrown.set(key, { base: marker.base, x, y, n });
  }
  f.thrown = [...thrown.values()];
  f.enemies ??= [];
  f.keys ??= [];
  f.traps ??= [];
}

/**
 * Bring a parsed save up to the current revision, in place. Unknown-but-newer
 * revisions are left alone: a save written by a newer build than this one is
 * better read as-is than half-migrated backwards.
 */
export function migrateSave(state: GameState): GameState {
  const s = state as AnyState;
  let rev = typeof s.revision === 'number' ? s.revision : 0;
  while (rev < SAVE_REVISION && rev < MIGRATIONS.length) {
    try {
      MIGRATIONS[rev](s);
    } catch {
      // A migration that fails shouldn't cost the player their save; the
      // defensive reads elsewhere still have to hold.
    }
    rev++;
  }
  // Not revision steps: repair passes that run on every load, at every
  // revision, including ones newer than this build knows about.
  //
  // The Wardstone taught this. Adding a material to MATERIALS silently broke
  // every save written since revision 10 — the 9 → 10 step that backfills a
  // commodity row only runs for saves older than that, and the town screen
  // reads `commodities[id].price` for every material the instant it renders,
  // so the first trip to Bleakmere threw. A save the broken build had already
  // stamped could not be repaired by any later step either, because a fresh
  // one at that revision runs nothing at all.
  //
  // The lesson is that a *revision* step is the wrong shape for this: the
  // problem is not "this save is old", it is "the data table grew". So it is
  // unconditional and idempotent instead, and a material can be added from now
  // on without anyone having to remember this file exists.
  try {
    backfillCommodities(s);
    rehomeThrown(s);
  } catch {
    // Same contract as a migration step: never cost the player their save.
  }
  s.revision = Math.max(rev, typeof s.revision === 'number' ? s.revision : 0);
  return state;
}
