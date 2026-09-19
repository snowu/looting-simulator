# Designed, Not Built

Work that is decided but not yet built. Sections 1 and 2 were parked until the
systems before them had been played properly; section 3 is the replayability
plan agreed on 2026-09-19. Written down so picking them up later does not mean
re-deciding everything from scratch.

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

# 2. Balance pass — **DONE 2026-09-13**

The harness below was built first, as this section asked, and lives at
`scripts/playtest.ts` and `scripts/tables.ts` behind `npm run playtest`. The
pass itself is written up in **`patch_notes.md`** at the repo root, and every
number that moved is in [MECHANICS.md](MECHANICS.md). The reasoning, including
the two things that were tried and walked back, is in `overnight_feature.txt`.

The section below is kept as written, because the suspicions in it were mostly
right and the ones that were wrong are worth having on the record.

**What the harness found that this section did not predict:** the problem was
never any single knob. The player's damage grew about tenfold from depth 1 to
depth 6 and their toughness about fourfold, while monsters grew 1.2x, because
`depthPower` keyed off how far a monster was past its *own* minimum depth
rather than off the floor number the player's gear tracks. Every specific
number listed below was a symptom of that.

**What it confirmed:** `ENEMY_DAMAGE_MULT` was indeed the wrong place to look
(it is untouched), durability is tight rather than punitive (nothing broke in
any scripted run), and the parry is worth exactly what it was meant to be worth
— with the same seeds, turning it off drops a fresh character from 1.88 floors
to 1.54.

**Still open after this pass:** renown and upgrade costs are untouched, because
the scripted profiles earn less renown per delve after the difficulty change.
The harness does not play twenty connected runs with purchases and crafting, so
time to the final loadout remains unverified. Trap density is untouched; its
share of damage depends on the route taken. Relic drop rates and effect
magnitudes still need real playtesting.

---

## The original section

## 2. Balance pass (as written on 2026-09-12)

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

**The first-run target is measurable.** Across 24 scripted runs, a fresh
character reaches depth 2 in 67% of runs and dies in 58% of runs; before
the pass it strolled to 2.46 floors on average and 63% of runs came home alive.

And the bottom floor is reachable *by someone who prepares for it*. A bot in
endgame gear that clears floors and loots everything runs dry around depth 5.
The same bot given a pack of Greater Healing, told to walk past the urns and go
down, reaches depth 6 in **100%** of runs and dies in 33% of them — to
the Barrow Champion, Hollow Knight, Flame Wraith, Frost Wisp and Ghoul. It drinks
about 19 potions doing it. That is the prepared profile in `npm run playtest`, and
it is the canary: if it stops reaching depth 6, the floor term in `depthPower`
has gone too far. This proves reachability with a supplied endgame loadout; it
does not prove that normal play acquires that loadout by the twentieth run.

Killing him is separate from reaching him. In a 24-seed boss-seeking check,
12 Greater Healings yielded no King kills; with 60, a 16-seed stress test killed
him eight times and extracted three. That extreme supply shows the bot can win,
but it is not a realistic repeatable loadout. The two Hollow Knight guards
kill it more often than the King does.

What a real session still has to judge is *feel* — whether the telegraphs give
you enough to answer with, whether the Ashen King's three-hit kill reads as
tense or as cheap, and whether depth 6's attrition is a supply problem worth
solving or a chore. The bot is a poor judge of all three: it never steps out of
a telegraph, so its damage taken is an upper bound rather than an estimate.

---

# 3. Run identity — **DESIGNED 2026-09-19**

Agreed on 2026-09-19, merging two independent reviews (a Claude review and
`codex_next_steps.md`) and three additions from the user: **ambushers that drop
or burrow, destructible walls, and necromancers**.

## Progress — pick up here

Work happens on stacked branches, one PR each, in a separate worktree
(`../looting-simulator-ri`) so it never disturbs whatever is checked out in the
main one. Each PR's branch starts from the previous one. **Update this table in
the same commit as the work it describes**, so any session can resume from it.

| # | Branch | Scope | Status |
|---|---|---|---|
| 1 | `feat/ri-1-elites` | Step 1: elite traits, thieving Cutpurse | [#18](https://github.com/snowu/looting-simulator/pull/18) open — needs a real delve on desktop and phone |
| 2 | `feat/ri-2-ambushers` | Step 2: ceiling droppers, burrowing Mole and Stalker | built, PR open — needs a real delve on desktop and phone |
| 3 | `feat/ri-3-walls` | Step 2: cracked walls, ore seams, sealed niches | not started |
| 4 | `feat/ri-4-gravecaller` | Step 2: the Gravecaller, shattered and sanctified remains | not started |
| 5+ | — | Steps 3–7: Oaths, route fork and biome laws, lieutenants and corpse run, build properties, Seals | not started |

Log (newest last), one line per landed piece with what is and is not done:

- 2026-09-19 — design agreed; tracker created.
- 2026-09-19 — **PR 1 built.** Five elite traits (Hasted, Ironhide, Frenzied,
  Vengeful, Thieving) in `src/data/elites.ts`, rolled from depth 3 at 5% → 11%
  on the `elite:` stream after generation; read through `enemyView` mods; glow,
  pulse and target-bar name as the tell; loot ×2.5 gold / ×3 gear / ×1.5
  materials on the same draws. The Cutpurse (`thief: true`) steals on an
  unblocked blow and flees; kill it to recover, 20s out of sight and it escapes.
  No save migration (all fields optional). Not done: the codex doesn't list
  traits yet, Oaths can't raise the elite chance yet (`eliteFor` takes a
  `bonus` for that), and the headless bot doesn't chase thieves deliberately.
  Checked in the dev lab (elite picker added to the F3 console); not yet played
  through a real delve or on a phone. Harness: careful iron kit deaths
  29% → 46%, other profiles within noise; watch this in play.
- 2026-09-19 — **PR 2 built** (stacked on PR 1). `EnemyState.lurk`
  ('ceiling' | 'buried'): lurkers are invisible to `enemyAt`, `threatNear`,
  `occupied`, the map and light until they come out. Ceiling Crawler (new
  weight-0 def, Cave Spider art) placed over corridors on the `ambush:` stream,
  1 at D2–3 and 2 at D4–5; spotted like traps and by Sounding; drops 0.6s after
  you come within 1 tile. Half of Tunnel Stalkers on Burrows/Mines start
  buried. The Delver Mole (`burrows: true`) dives once below 35% and tunnels to
  your back for 2–4s. Nothing strikes on arrival (0.5s beat); a visible lurker
  struck where it hides comes out stunned for 1.5s with double damage. New
  `mound` art, synced to `public/art`. Not done: thrown shafts and reflected
  bolts don't knock droppers down (only a melee swing does), Crawlers reuse the
  Cave Spider sprite, the Frost Vault icicle variant of the dropper doesn't
  exist yet, and no real delve or phone check.

## The problem

Balance and progression are good, Hard especially. The game still goes stale.
It has plenty of content; what it lacks is **runs that differ from each other**.

- **27 monsters, four behaviours.** Every `EnemyDef.behavior` is `melee`,
  `ranged`, `skittish` or `boss`, plus an optional `shield`. Elemental variants
  change numbers and weaknesses, not verbs. Nearly every fight is "read the red
  flash, then step, block or parry". The memorable enemies are the ones with a
  verb of their own: the shield rhythm and the Delver Mole's claw guard.
- **One run shape.** Six floors down, rooms joined by corridors, the same five
  special room roles, then the King. Biomes change the look and the residents,
  but never a decision.
- **Progression runs out.** 9 relics, 5 sigils, a 371-renown tree and one boss.
  Once those are done, the only thing left to chase is gold.
- **Gear rarely changes how you play.** Affixes are stats. The 9 relics are the
  only rule-changing loot, and they are the best part of the loot game.
- **Town and dungeon don't affect each other.** Market events move prices, not
  the dungeon. Contracts ask for things the dungeon already hands out.

Every run asks one question: *how far can I safely descend before extracting?*
Different biomes and weapons change how that journey feels without giving the
run a different purpose.

## North star

> Every delve should force the player to form a plan, then give them enough
> unexpected opportunities to reconsider it.

A good run can be told as a story: "I took the Ember road because I had frost,
the Gravecaller kept raising the skeletons I'd just killed until I broke through
the cracked wall behind it, and I nearly failed Unbroken when my shield went."

## Decisions already made

- **Six floors stay.** A longer delve means more walking, not more decisions.
  Depth is not where depth comes from.
- **No generic New Game+.** Inflating health and damage gives the same decisions
  in slower fights.
- **New monster behaviours, not new stat blocks.** A new enemy has to bring a
  verb the player answers differently. Another reskin is not worth its art.
- **Three systems, three jobs. Keep them from overlapping:**

  | System | Answers | Lifetime | Example |
  |---|---|---|---|
  | **Delve Oath** | *How* you delve this time | one delve | Unbroken: double wear, reach depth 4 without a break |
  | **Contract** | *What* you bring back or find | several days | Recover the ledger from the depth-4 vault |
  | **Ashen Seal** | *How hard* you want it | chosen per delve, unlocked after the first King kill | Elites inherit a second trait |

  An Oath that reads like a contract ("extract with 250 gold") is written wrong.
- **Rewards are horizontal.** Oath rewards and Seal unlocks hand out build
  properties, sidegrades and new options, never a Rare with more Attack. Hard's
  balance should not have to keep chasing the player.
- **Punishing is fine; unfair is not** (standing constraint). This matters most
  for ambushers. See their section.

## The pieces, in build order

### Step 1 — Foundation: elite traits and a thieving Cutpurse

The Hunter and Butcher Oaths and the "second trait" Seal all rely on elites, and
**no elite system exists**. The Bog Seraph is a hand-made champion, not a
promotion. So this comes first.

- **Elite traits:** a small set of modifiers applied to an ordinary monster at
  spawn: *Hasted* (shorter wind-up and step), *Ironhide* (defense, slower),
  *Vengeful* (a death burst on its tile, after a tell), *Thieving* (see below),
  *Warded* (resists the element it is weak to), *Frenzied* (faster below half
  health). Each needs a visual tell (a tint or aura on the sprite) and a codex
  line. Rolled on a hashed stream `elite:<seed>:<depth>:<i>`. An elite roughly
  doubles its gold and gear chance.
- **The Cutpurse steals.** A Goblin Cutpurse that lands a hit takes one random
  non-equipped item from the pack, then goes `skittish` at once and runs for the
  nearest corridor. Kill it to get the item back as a drop. If it gets out of
  sight for 20s, the item is gone. This is the most "looting simulator" verb
  available, and the Cutpurse already has the right name and flee behaviour.
  *Thieving* as an elite trait carries it to other monsters.

### Step 2 — New monster verbs

These are the user's three additions. Each gets its own enemy or two, and each
feeds a later system: ambushers and walls give biome laws something to work
with, and the necromancer is the Ossuary lieutenant.

#### Ambushers: from above, from below

**The fairness rule, which is not negotiable: an ambusher never deals damage in
the same beat it appears.** It lands or surfaces on a tile *adjacent* to you,
then starts an ordinary wind-up with the ordinary red flash. The ambush costs you
**position**: you are now flanked, or it is behind you. It never costs you free
health.

- **Ceiling droppers** (a Cave Spider variant, *Ceiling Crawler*, depths 2–5, and
  a Frost Vault form among the icicles). Placed as hidden ceiling props next to
  corridors and room entrances, reusing the `ceiling` prop shape from
  `src/systems/ceiling-decor.ts` (height, offset, sprite). **Spotting uses the
  trap rule**: the same forward tiles checked on every step and turn, with
  Lantern Wick and Charlie Work extending the reach. A spotted dropper shows as a
  dark shape with a faint glint. An unspotted one gives a last-moment tell: dust
  falling and a skitter sound one step before it drops. Sounding reveals droppers
  in range. A dropper that is spotted and struck from below (thrown shaft,
  reflected bolt) falls stunned. Rolled on `ambush:<seed>:<depth>`.
- **Burrowers.** Earth biomes only (Vermin Burrows, Deep Mines).
  - The **Delver Mole** stops fleeing on foot. At the `skittish` threshold it
    dives, travels as a **visible dirt-mound decal** that moves one tile per step
    interval with a low rumble, and surfaces adjacent to you (preferring your
    back) after 2–4s. You can read the mound's path, and striking the mound with
    a blunt or pick blow forces it up early and stunned.
  - The **Tunnel Stalker** ("a quick bite, then it vanishes into the dark") is
    the natural second burrower: it lies buried in corridors as a mound and
    surfaces when you step adjacent.
- Neither kind is allowed within 7 tiles of the arrival point, the same rule as
  ordinary spawns.

#### Destructible walls

A new tile kind, **cracked wall**, drawn with a visibly fractured texture per
biome. It breaks after N blows scaled by weapon: a pick or maul fastest, blunt
next, blades barely (and blades wear faster doing it). Breaking reuses the path
secret walls already take (`world.ts`, `f.tiles[...] = FLOOR`). Floors are saved
whole in `run.floors`, so a broken wall stays broken across reloads with no new
field.

What cracked walls are for:
- **Shortcuts.** Placed on the extra loop edges the generator already considers.
  Breaking one opens a route, never closes one, so the reachability check is
  unaffected.
- **Ore veins.** Some cracked walls are seams (a metal glint, biome-appropriate
  tier), and mining one yields ore. This finally gives the Mining Pick a job
  beyond being a pierce weapon.
- **Sealed caches.** A 1-tile niche with a container, like a small secret room
  you can see.
- **Noise.** Every blow alerts monsters within ~6 tiles. Breaking through costs
  you the floor's attention, which is what makes it a choice, and it ties
  directly into the Vermin Burrows law and the Oath of Silence.
- **Monsters break them too.** A Barrow Champion's missed swing into a cracked
  wall breaks it. So does a blunt elite. A wall is shelter until it isn't.

The **Deep Mines law** (step 4) builds on this: timber-braced cracked walls can
be collapsed onto a monster on the next tile for heavy blunt damage, at the cost
of blocking that tile with rubble.

#### Necromancers

The King already raises his Hollow Knights (`raiseTheGuard`, `risen`, and
`killEnemy` returning early on `e.risen` so a corpse pays once). This generalises
it.

- **The Gravecaller**, depths 2–5, Ossuary and Sunken Catacombs. Weak in melee
  and below `STAGGER_HP`. It keeps its distance like an archer and, rather than
  shooting, **channels over a nearby corpse** for ~2s: a visible glow rises from
  the body and a chant plays. When the channel completes, the corpse stands at
  50% health, `risen`, attacking after one beat.
- **Counterplay, three ways, all readable:**
  1. **Interrupt the channel.** It staggers like anything under `STAGGER_HP`, and
     a thrown shaft or a reflected bolt reaches it at range.
  2. **Shatter the remains.** A killing blow with blunt damage, or overkill
     beyond some fraction of max health, leaves *shattered* bones that cannot
     rise. This makes the mace line's undead weakness matter twice.
  3. **Sanctify.** Holy damage on the killing blow, or Threshold's consecrated
     tile, leaves remains that cannot rise.
- Raised monsters use the existing `risen` flag: no second renown, no second
  sigil refund, no second loot roll.
- The Gravecaller is also the template for the **Ossuary lieutenant** (step 5),
  which makes this a floor-wide law until it dies.

### Step 3 — Delve Oaths

At the town gate, before descending, three generated Oaths are offered. Taking
one is optional. Each has a **rule change**, an **objective**, **pressure** on
the safe routine, and a **distinct reward**. The first three reuse existing
systems:

| Oath | Rule | Objective | Reward |
|---|---|---|---|
| **Blood Price** | Begin cursed with Frailty | Extract ≥250 gold found in the dungeon | a build property (step 6) or a chosen catalyst |
| **Unbroken** | Equipment wear ×2 | Reach depth 4 with no equipped item breaking | a crafting specialisation or recipe rank |
| **Hunter** | Monsters see +2 tiles | Kill three marked elites placed across the delve, then extract | a build property |

Later candidates from codex: Butcher, Miser (gold as bulky purses, no Recall),
Silence (short monster sight, but noise carries floor-wide), Pilgrim (stronger
blessings paired with harsher curses).

Needs: an offer UI at the gate, `run.oath` snapshotted like `run.difficulty`,
objective tracking with a HUD line, marked-elite presentation, completion and
failure feedback, and a reward choice in town. Failing an Oath costs the reward,
never the run.

### Step 4 — Route choice and biome laws

- **One fork at depth 3.** Depth 2's floor has two sealed descents, each naming
  its road: biome, main danger, likely reward family. Taking one seals the other.
  `generateFloor` picks the biome via `biomeForDepth(depth, seed)`. The route
  adds an override, stored on the run so later floors follow it.
- **Rumours pick the roads.** Market events tilt which biomes the fork offers:
  Rat Plague favours the Burrows, Iron Shortage the Mines, Harsh Winter the Frost
  Vault. The day's rumour becomes information you can prepare around (bring frost
  for the Ember road), which is the town–dungeon coupling the game is missing.
- **One law per biome, and each law must give the player something to exploit.**
  Passive damage over time is just a tax. First three:
  - **Ossuary:** undead remains rise unless shattered or sanctified. Always true
    on this biome's floors; the Gravecaller speeds it up.
  - **Deep Mines:** braced cracked walls can be collapsed onto monsters, and ore
    seams run through the walls.
  - **Vermin Burrows:** noise carries, and burrowers hunt by it. Wall-breaking,
    Wardcry and sprung alarm wards pull roaming packs. A broken root cache can
    bait them away.

### Step 5 — Floor lieutenants and the corpse run

- **Lieutenants:** one named monster per eligible floor whose presence changes
  the floor until it dies. You notice the rule, find clues to its source, decide
  whether to hunt it, and feel the floor change the moment it falls. Its reward
  relates to the rule it imposed. First two: the **Ossuary Gravecaller**
  (floor-wide rising) and the **Goblin Quartermaster** (strengthens
  shieldbearers, improves guarded caches). Later: a treasure beast that collects
  unattended floor loot and carries it off, and a frost herald that ices opened
  doors shut.
- **The corpse run.** When you die, your lost pack waits on the same depth next
  delve, guarded by a hollowed version of you (your equipped weapon's art and
  damage type, at that depth's scaling). Reach it and win to take the pack back.
  Die again first and it is gone for good. One additive save field, no seed
  impact beyond a hashed placement stream. It pairs naturally with Soul Pouch
  rather than replacing it.

### Step 6 — Build properties and crafting specialisation

About six properties to start, which change a combat verb rather than a total:

- **Riposte:** after a parry, the next blade or dagger strike costs no stamina.
- **Retrieval:** called-back shafts damage monsters they pass through.
- **Last Flask:** morsels and life leech heal more while the flask is empty.
- **Execution:** killing a staggered monster refunds extra sigil cooldown,
  within the existing 20% cap.
- **Bulwark:** absorbing a large blow empowers the next blunt strike.
- **Kindling:** fire damage against a wounded monster spreads to an adjacent one.

They go on relics, Oath rewards and **Rank 5 crafting specialisation**: one
irreversible choice per crafted item (Tempered for plain stats, Barbed for an
offensive property, Hollow for a sigil property, Consecrated for a holy or
shrine property). This gives Rank 5 a purpose beyond bigger numbers.

### Step 7 — Ashen Seals

After the first King kill, the gate offers stackable Seals, each a known
complication with a stated reward or score multiplier. `src/data/difficulty.ts`
already holds every Hard knob in one `DifficultyDef`, so a Seal is a named
modifier applied over the run's snapshot. Candidates: elites inherit a second
trait, two lieutenants per floor, the fonts are dry, two flask charges,
Lightless, shrines always pair a blessing with a curse, the King inherits a
surviving lieutenant's ability. Hardcore sits at the top of this ladder.

## Where it lands

| Piece | Files |
|---|---|
| Elite traits, new verbs | `src/types.ts` (`EnemyBehavior`, trait field), `src/data/enemies.ts`, `src/world/world.ts` (AI, `raiseTheGuard` generalised), `src/art/enemies-*.ts` |
| Ceiling droppers | `src/systems/ceiling-decor.ts` pattern, trap spotting in `world.ts` |
| Cracked walls, ore seams | `src/systems/dungeon.ts` (new tile, placement on loop edges), `src/render/level-mesh.ts`, `src/art/textures.ts`, secret-wall path in `world.ts` |
| Oaths, Seals | new `src/data/oaths.ts`, `src/systems/run.ts`, `src/data/difficulty.ts`, `src/ui/town.ts` |
| Route choice | `src/data/biomes.ts` (`biomeForDepth` override), `src/systems/dungeon.ts`, `src/systems/market.ts` (rumour → road weights) |
| Corpse run | `src/state/game-state.ts`, `src/state/migrations.ts`, `src/systems/run.ts` |
| Build properties | `src/data/affixes.ts` or a sibling `properties.ts`, `src/systems/crafting.ts`, `src/systems/relics.ts` hook pattern |

Every save change is additive and goes through `migrations.ts` with
`SAVE_REVISION` bumped (it is 24 today). Every new roll gets its own hashed
stream so existing floors do not reshuffle. Every new number goes into
MECHANICS.md when it becomes real.

## Settled 2026-09-19

- **Elites appear on their own, whatever the Oath or Seal.** There is a base
  chance on the deeper floors that an ordinary monster spawns as an elite, so
  step 1 pays off without anything else built. Oaths and Seals only add to it.
- **Cracked walls take the same number of blows from every weapon**, for now.
  Weapon class does not change the count. Revisit once walls have been played.

## Open questions

- Does a ceiling dropper that is spotted and left alone ever drop? Leaning
  towards: it drops if you pass underneath, since spotting it is the warning.
- The corpse run on Hardcore: a death ends the playthrough, so the feature does
  nothing there. That is fine, but it should say so rather than seem broken.
- Can the headless bot play any of this? Oaths and Seals yes; ambushes and
  channels need bot awareness before `npm run playtest` numbers mean anything.

## How we would know it worked

Players here are the user and one alpha tester, so rates and funnels do not
apply. The signals that do:

- Runs get described by their Oath, road or lieutenant ("my Unbroken run", "the
  Gravecaller floor") rather than by depth reached.
- Preparation changes: sigil choice, weapon and packed consumables follow the
  day's rumour and the chosen Oath, instead of the same kit every time.
- The Mining Pick and the mace line get picked for what they *do* (walls,
  shattering), not only for their damage type.
- A per-save record of Oaths taken, completed and failed, plus the harness for
  the numbers (does Unbroken's double wear actually threaten depth 4?).
