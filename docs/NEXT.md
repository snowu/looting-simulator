# Designed, Not Built

Two pieces of work that are decided but deliberately parked until the recent run
of systems has been played properly. Written down so picking them up later does
not mean re-deciding everything from scratch.

Paused on **2026-09-12**, after traps, parries, town portals, the pack loadout,
mimics, the Lantern Wick, shrine flavours and durability all landed in quick
succession. None of that has been felt out in a real session yet, which is
exactly why the balance pass below has to come after playtesting rather than
instead of it.

## Standing constraints

Both pieces inherit the same rules the rest of the project runs on:

- **Never invalidate a save.** Additive fields only, migrated forward in
  `src/state/migrations.ts` with `SAVE_REVISION` bumped. `SAVE_VERSION` does not
  move. See the schema section of [MECHANICS.md](MECHANICS.md).
- **Reproducible from the seed.** Anything rolled during generation uses its own
  hashed stream (`chestIsMimic`, `shrineKindFor` are the pattern) so adding a
  roll never reshuffles floors that already exist.
- **Punishing is fine; unfair is not.** The player must be able to see what got
  them and do better next time. No hidden dice where a readable tell would do.
- **MECHANICS.md is the single reference.** Any number introduced here belongs
  in a table there once it is real.

---

# 1. Bespoke legendaries — **BUILT 2026-09-12**

Nine relics landed, with the naming and trade conventions drawn from WoW,
Risk of Rain 2, Discworld, It's Always Sunny and Community. The section below is
kept as written for the reasoning; **MECHANICS.md is now the reference for what
actually shipped.** What changed against the plan as written:

- **Fight Milk is a draught, not an amulet.** The one Legendary you drink,
  delve-long, in its own `run.tonics` list so it never costs a shrine blessing.
- **The cursed armour is Eulogy Plate**, and its cost is halved healing from
  every source rather than a run curse — no new save field, and it bites hardest
  exactly when you are relying on potions.
- **Crafting them: no.** Found-only, as the open question leaned.
- **They wear normally**, except An Entirely Ordinary Sword, which is outside the
  durability system by design.
- Two bugs the tests caught and the design did not: a relic could roll an affix
  that refunded its own downside, and the King's guarantee lapsed at a depth
  below every relic's `minDepth`. Both fixed.

Still open: the drop rates and the effect magnitudes are all untested against
real play. They belong to the balance pass below.

## The problem

A Legendary today is a Rare with two extra affixes and a generated name.
`legendName()` in `src/systems/items.ts` mixes `LEGEND_A × LEGEND_B` — 14 × 14 =
196 combinations like *Duskfang* or *Gravemourn* — and pastes it in front of the
ordinary name, giving *"Duskfang, Star Iron Long Sword"*. The stats underneath
are the same roll every other item gets.

So the rarest drop in the game, including the one the Ashen King is guaranteed to
leave, is mechanically indistinguishable from good luck on a Rare. Nothing about
it is memorable and nothing about it changes how you play. The bottom floor
should produce items people describe to each other.

## Decisions already made

**Hand-authored, not generated.** A small set — 8 to 12 to start — each a fixed
base, a fixed material and one bespoke effect. Fewer, better, named.

**They replace the random roll, they do not stack on top of it.** When a roll
comes up Legendary, it becomes one of the authored uniques instead of a 4-affix
item. A unique is allowed a couple of ordinary affixes on top for texture, but
the effect is the point.

**The boss always drops one you have not seen.** Killing the Ashen King is the
one guaranteed Legendary in the game; it should be progression, not a lottery
ticket you have already won. This needs a lifetime record of which uniques have
dropped — a new field on `GameState.lifetime`, and therefore a migration.

**Effects hook systems that already exist.** The point is bespoke behaviour, not
a new engine. Everything below is reachable from code already written:

| Hook | Where it lives |
|---|---|
| Parry window, stun length, vulnerability multiplier | `PARRY_*` in `src/world/world.ts` |
| Projectile reflection | `reflect()` / `reflectedHit()` |
| Durability wear rate, or immunity to it | `wearItem()` in `src/systems/items.ts` |
| Trap spotting distance | `lookAhead` in `src/world/world.ts` |
| Carried light radius | `lightRadius()` in `src/systems/meta.ts` |
| Blessings and curses | `BLESSINGS` / `CURSES` |
| Life leech, crit, the four elemental stats, loot find | the ordinary stat block |
| Stamina regeneration | `STAMINA_REGEN` |

**Seed candidates** (names are placeholders, effects are the actual proposal):

- *A blade that never dulls* — immune to durability loss. Quiet, permanent, and
  it interacts with the one system that now taxes every other weapon.
- *A shield that reflects melee too* — a successful parry sends melee damage back
  at the attacker, not just projectiles.
- *A lamp-bearing offhand* — noticeably wider carried light, at the cost of being
  a poor shield. Trades the Lantern Wick's slow purchase for a real decision.
- *A weapon that feeds on parries* — each parry adds a stacking damage bonus that
  resets when you take an unblocked hit.
- *Armour that curses you* — best-in-slot defence with a permanent run curse
  attached. A real decision rather than a strict upgrade.
- *A blade that shows the floor* — spots traps two tiles further and marks them
  on the map from further off.

At least one should be a **trade**, not a pure gain. An item with a downside is
the one people argue about.

## Where it lands

- `src/data/uniques.ts` — new. `UniqueDef { id, name, baseId, materialId, flavour,
  stats, effect }`, in the style of the other data files.
- `src/types.ts` — `Item.uniqueId?: string`. **Absent means not unique**, which is
  the same trick `dur` uses, so no migration is needed for the item itself.
- `src/systems/items.ts` — `rollEquipment` diverts a Legendary roll into a unique;
  `itemName`, `itemStats` and `itemValue` all learn about `uniqueId`.
- `src/world/world.ts` / `src/systems/player.ts` — the effect tags are read where
  the relevant system already does its work.
- `src/state/migrations.ts` — one step for the lifetime "uniques seen" record.

## Open questions

- **Can they be crafted?** Leaning no — found-only is what makes them stories.
  But the forge is a core system and cutting it out of the best tier is a cost.
- **Do they wear?** Default yes, at half rate, with the never-dulls one as the
  deliberate exception. Needs to be felt.
- **What happens when all uniques have dropped?** The boss falls back to a random
  Legendary. Fine, but it means the set wants to be big enough to last.
- **Unidentified reveal.** Uniques should arrive unidentified like any Rare+ drop,
  so the name lands as a moment at the appraiser. Worth checking this does not
  make them feel worse to find in the dungeon.

## How we would know it worked

Someone finishes a run and can name the item they found without looking.

---

# 2. Balance pass

## The problem

Five systems landed in a few hours and every one of them moved a curve. Nothing
has been tuned against real play, and tuning any of it before playing is guessing
with extra steps.

What changed, and what it plausibly did:

| Change | Likely effect |
|---|---|
| Traps (`2 + 1.5 × depth` per floor, spikes `9 + 5 × depth`) | More attrition per floor, worst on deep floors where you are already thin |
| Parries (deny the hit, stun 1s, ×2 damage) | A skilled player takes far less damage and kills faster — the difficulty spread between players just widened a lot |
| Town portals | Removes the "walk all the way back" cost of a deep run, and banks carried gold early |
| Pack loadout | Potions actually get used now, so effective health per delve is up |
| Mimics (12% of chests) | Extra fights attached to rewards, weighted toward the greedy |
| Lantern Wick | A renown sink competing with Toughness |
| Shrine flavours and curses | Healing is less reliable; a bad idol can sour a whole run |
| Durability | A gold sink that did not exist, and a soft cap on how long a delve can run |
| Renown and day rules | Depth-1 turn-backs pay nothing and do not turn the day |

## Do this first: a headless harness

There isn't one. `npm test` is 176 vitest specs covering invariants and
behaviour, not simulation, and there is no `scripts/` directory. Balance work
without numbers is vibes, so the first task is a runner that plays N seeded runs
with a scripted policy and reports distributions:

- Deaths by depth, and what killed you (`run.killedBy` already records this).
- Damage taken by source: monsters, traps, shrines.
- Gold in vs gold out — loot banked against repairs, potions and offerings.
- Durability at extraction: how often does a weapon break mid-run?
- Renown per hour of play, and time to each meta upgrade.
- Parry rate, and the same run simulated with parries disabled — the gap between
  those two is the skill spread, and it is the number most worth knowing.

It belongs in `scripts/playtest.ts`, driven by the existing `World` class the way
the tests already drive it. It does **not** need to be a good player; it needs to
be a *consistent* one, so changes are comparable.

## Specific numbers to interrogate

Current values, with the suspicion attached:

- `ENEMY_DAMAGE_MULT = 1.15` (`src/systems/combat.ts`) — the global difficulty
  knob, untouched since before parries existed. Probably now too low for players
  who parry and too high for those who do not.
- Weapon durability `110 × (0.8 + 0.2 × tier)` against 150–350 landed blows in a
  six-floor delve. Deliberately tight. Verify it is *tight* and not *punitive*.
- `repairCost = value × 0.3 × missing` — is the gold sink big enough to matter
  against market profits, or is it a rounding error by depth 4?
- Legendary weight `(0.15 + 0.3 × depth) × f` — now that relics exist this is the
  knob that decides how often anyone sees one outside a King kill.
- Fight Milk at `0.8%`/`3%` × depthFactor, and whether +70% regen for −20 max
  stamina is a real decision or an obvious yes.
- Trap density `2 + 1.5 × depth`, and spike damage at depth 6 (39 before armour).
- Idol odds 60/40 and the four curse magnitudes.
- Renown `2 + 2 × depth` against upgrade costs totalling well over 100.

## Guardrails

- **Change one knob at a time and re-run the harness.** The systems interact; a
  durability tweak moves the gold curve, which moves the upgrade curve.
- **Tune the global multiplier last.** It is the blunt instrument and it hides
  whether a specific system is wrong.
- **Do not balance away the skill ceiling.** Parries making a good player much
  stronger is the intended outcome, not a bug to flatten. If the game needs to be
  easier, make it easier for the player who is not parrying.
- **Keep the seed contract.** Rebalancing data values is fine; changing how
  generation consumes RNG reshuffles every existing floor.

## How we would know it worked

A first run ends in death around depth 2–3 and the player knows why. A
twentieth run reaches depth 6. Neither of those happens by accident.
