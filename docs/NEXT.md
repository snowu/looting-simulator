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
| 1 | `feat/ri-1-elites` | Step 1: elite traits, thieving Cutpurse | [#18](https://github.com/snowu/looting-simulator/pull/18) merged |
| 2 | `feat/ri-2-ambushers` | Step 2: ceiling droppers, burrowing Mole and Stalker | [#19](https://github.com/snowu/looting-simulator/pull/19) merged |
| 3 | `feat/ri-3-walls` | Step 2: cracked walls, ore seams, sealed niches | [#20](https://github.com/snowu/looting-simulator/pull/20) merged |
| 4 | `feat/ri-4-gravecaller` | Step 2: the Gravecaller, shattered and sanctified remains | [#21](https://github.com/snowu/looting-simulator/pull/21) merged |
| 5 | `feat/ri-5-properties` | Step 6 pulled forward: six build properties and the forge's Inscribe bench | [#22](https://github.com/snowu/looting-simulator/pull/22) merged |
| 6 | `feat/ri-6-oaths` | Step 3: Delve Oaths, paying out properties | [#23](https://github.com/snowu/looting-simulator/pull/23) merged |
| 7 | `feat/ri-7-routes` | Step 4, part 1: the route fork below depth 2 | [#24](https://github.com/snowu/looting-simulator/pull/24) merged |
| 8 | `feat/ri-8-laws` | Step 4, part 2: biome laws for Ossuary, Deep Mines, Vermin Burrows | [#25](https://github.com/snowu/looting-simulator/pull/25) merged |
| 9 | `feat/ri-9-grave` | Step 5, part 1: the corpse run | [#26](https://github.com/snowu/looting-simulator/pull/26) merged |
| 10 | `feat/ri-10-lieutenants` | Step 5, part 2: floor lieutenants | [#27](https://github.com/snowu/looting-simulator/pull/27) merged |
| 11 | `feat/ri-11-seals` | Step 7: Ashen Seals, and the Descend panel | [#28](https://github.com/snowu/looting-simulator/pull/28) merged |

Log (newest last), one line per landed piece with what is and is not done:

- 2026-09-19 — design agreed; tracker created.
- 2026-09-19 — **PR 1 built.** Five elite traits (Hasted, Ironhide, Frenzied,
  Vengeful, Thieving) in `src/data/elites.ts`, rolled from depth 3 at 5% → 11%
  on the `elite:` stream after generation; read through `enemyView` mods; glow,
  pulse and target-bar name as the tell; loot ×2.5 gold / ×3 gear / ×1.5
  materials on the same draws. The Cutpurse (`thief: true`) steals on an
  unblocked blow and flees; kill it to recover, 30s out of sight and it escapes
  (was 20s; see the chase fix below).
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
- 2026-09-19 — **PR 3 built** (stacked on PR 2). `Floor.cracks` (optional),
  placed last on the `cracks:` stream: 2 shortcuts (≥12 steps saved), seams
  (more on earth floors) and 1 cache per floor, none on the throne. 3 blows
  from any weapon (as decided), 2 wear and 6-tile noise per blow; the tile
  becomes FLOOR. Seams spill 2–4 metal ore; caches roll like a chest with a
  gold floor. Rendered as a box in one of 21 new composited textures (7 walls
  × cracked/ore/sealed); the opening's floor, ceiling and inner walls are
  pre-built so no rebuild is needed. Not done: monsters don't break walls (the
  Barrow Champion idea), the Deep Mines collapse law is step 4, the automap
  doesn't mark cracks, and no real delve or phone check.
- 2026-09-19 — **PR 4 built** (stacked on PR 3). Gravecaller (weight-0 def,
  new `gravecaller_0/_atk` art) placed by its own `gravecaller:` pass on
  Ossuary/Catacombs floors from depth 2 (so D2–3 in practice), not marking its
  tile occupied so loot and keys don't move. It chants 2s over the nearest
  fallen undead within 4 and stands it up at 50%, risen; limit 3, 6s
  cooldown; any damage breaks the chant. `EnemyState.remains`: blunt or 25%
  overkill shatters, holy damage or Threshold sanctifies (melee killing blows
  only). Not done: thrown/trap/burst kills never set remains; the Ossuary
  lieutenant (floor-wide rising) is step 5. **Step 2 is complete with this PR.**
  Next up: step 3, Delve Oaths (new branch `feat/ri-5-oaths` off this one).
- 2026-09-19 — **Oath rewards decided: build properties now.** Asked the user
  what Oaths should pay before step 6 existed; answer: build step 6 first. So
  PR 5 is properties and PR 6 is Oaths.
- 2026-09-19 — **PR 5 built** (stacked on PR 4). Six properties in
  `src/data/properties.ts`: Riposte, Execution, Kindling (weapon), Bulwark
  (shield), Retrieval (thrown belt), Last Flask (armour). Learned into
  `state.properties` (save revision 25, additive), inscribed onto `Item.property`
  at a new forge **Inscribe** bench for 150g, one per item, never on a relic.
  Read into `UniqueTraits` flags by `applyProperty`. The dev lab learns all six.
  No player-facing way to learn one until PR 6, so PR 5 carries no patch note;
  PR 6's covers both. Not done: phone-width check of the bench (the browser
  window couldn't be resized here).
- 2026-09-19 — **PR 6 built** (stacked on PR 5). Delve Oaths: Blood Price,
  Unbroken, Hunter (`src/data/oaths.ts`). Sworn at the Oath Stone (since PR 11
  a panel that opens on Descend) into `state.pendingOath`, moved onto `run.oath` by `startRun`,
  settled in `endRun`: kept and home alive → `state.oathReward` = 3 unlearned
  properties (seeded by run), or 10 renown if none left. Save revision 26
  (additive). Hunter marks one of the three toughest monsters on D2–4 at first
  generation (first version picked a rat). No new oath while a reward is
  unchosen. The patch note covers PRs 5 and 6 together. Not done: HUD target
  bar overlaps the status block at ~500px width (layout issue from before,
  longer "Marked …" names make it worse); oath choice isn't seeded per day
  (all three always on offer, since there are only three).
- 2026-09-19 — **PR 7 built** (stacked on PR 6). The fork is at depth 2's down
  stair, not a second stair (no generation change): `forkPending` emits a
  `fork` event, a panel offers `run.roads` (snapshot of `roadsForDay(saveId,
  day, events)` at `startRun`), `chooseRoad` sets `run.road` and descends.
  `generateFloor(..., biomeId)` honours the road on depths 3–4 only where the
  biome can appear. Town news names the day's roads. Bot takes roads[0]. No
  save-revision bump (run fields optional; absent means no fork).
- 2026-09-19 — **PR 8 built** (stacked on PR 7). `src/data/laws.ts`. Ossuary:
  undead remains stir as `deadT` crosses 8s (`stirT`, rendered like a
  Gravecaller's chant) and stand 2s later at 50%, risen, once. Mines: a crack
  broken on a mines floor collapses onto every monster beside it (30 + 12×depth
  blunt, 1.2s reel). Burrows: `noise()` scales crack, Wardcry, alarm and chest
  radii ×1.75; a broken root cache lures monsters within 12 to the cache. The
  arrival message plays on a floor's first generation. **Step 4 done with this
  PR.** Next: step 5, lieutenants and the corpse run.
- 2026-09-19 — **PR 9 built** (stacked on PR 8). `src/systems/grave.ts`:
  `endRun` digs `state.grave` (lost items, lost coin, the weapon's damage type,
  depth fallen) on a non-Hardcore death, replacing any unclaimed grave. The
  Shade (weight-0 def on the knight sprite, pale tint) is placed once per
  delve when its depth is generated (`startRun` for depth 1, `changeFloor`
  otherwise); killing it drops the grave and clears it. Save revision 27.
- 2026-09-19 — **Harness bug found:** `newGame` gives each save a random
  `saveId` (`crypto.randomUUID`), and since PR 7 the day's roads are seeded
  from it, so harness runs stopped being reproducible. The harness comparisons
  quoted in PRs 7 and 8 were noise. Fixed on PR 7's branch (the bot fixes its
  save id) and re-measured.
- 2026-09-19 — **PR 10 built** (stacked on PR 9). Two lieutenants
  (`src/data/lieutenants.ts`), placed in `changeFloor` on first generation, 40%
  per floor from D2–5. Goblin Quartermaster (red-banner goblin): goblins ×1.25
  damage and no fleeing while it lives; rout and a vault-tier strongbox on its
  death. The Hoarder (rat with a coin sack): collects unattended piles (not
  keys or flask shards), shies from the player, spills its hoard on death.
  Swapped the design's Ossuary Gravecaller lieutenant for these two, since the
  Ossuary law (PR 8) already does floor-wide rising. `pathStep` stops short of
  its goal, so the Hoarder takes the last step itself. **Step 5 done.** Next:
  step 7, Ashen Seals.
- 2026-09-19 — **PR 11 built** (stacked on PR 10). Five Seals
  (`src/data/seals.ts`), unlocked by a King kill in the bestiary. Teeth via the
  world's `diff`, Multitudes and Champions via a `FloorMods` argument to
  `generateFloor`, the Dry Well at `startRun`, the Lightless in
  `playerLightRadius`. +25% renown and +15 find each (find through a world
  `lootFind` getter, since loot rolls take the base difficulty by id);
  `lifetime.bestSeals` record. Save revision 28. **User change:** the Oath
  Stone and the Seals now open in a *Before you go down* panel on Descend
  instead of sitting above the town tabs; the oath reward stays in town. **All
  seven steps of the plan are now built.**
- 2026-09-19 — **Oaths stack, and the pool grew to eight** (user: Blood Price
  too punitive; "picking as many as they want is fun"; 3 oaths go stale). Tiers
  (hard pays 2 inscriptions, medium 1), any number sworn, +1 for keeping all of
  two or more, a daily offer of 2 hard + 3 medium. New: Dry Throat, Duelist,
  Kingsbane (hard); Silence, Pilgrim (medium). Save revision 29 turns the
  single oath fields into lists. Follow-up the same day: the stone shows five
  (was three) and a multi-pick reward is chosen together, then learned at once.
- Art previews for PR descriptions are PNG sheets from `npm run art:sheet`,
  committed under `docs/previews/ri-*.png` and embedded by raw URL (user's
  request, 2026-09-19).
- 2026-09-19 — **PR 3 follow-ups** (user feedback). The ore and sealed
  textures were far too obvious, so both were redrawn quiet: ore is a thin
  fissure with a few dull, translucent glints; sealed is a faint, broken mortar
  outline with a hairline crack (the plain shortcut crack is unchanged). Easter
  egg: an unbroken Mining Pick breaks any crack in one blow; in MECHANICS.md,
  deliberately not in the patch notes.
- 2026-09-19 — **Thief chase fix** (user: "nearly impossible to chase").
  The old flee took the step that maximised distance every tick and kept
  sprinting away from your last-seen position out of sight. Now: laden ×1.25
  step, 12% fumble (0.7s stand) per step in sight, panicked step choice (any
  step not closer, prefers straight, no lookahead, so it bolts into dead ends),
  creeps one tile per 1.5s out of sight, a coin trail every 3 steps (max 6),
  escape 30s. A scripted chase sim didn't reproduce the problem (a bot chaser
  caught even the old thief 55/60), so the fix targets the causes, not a sim
  number; it needs a human read.
- 2026-09-19 — **Thief retune, middle ground** (user: the fix made it "too
  nerfed and too easy"). Kept the panicked step choice; dropped the laden
  slowdown (×1.25 → ×1, a goblin is already slower than you), fumble 12% → 5%,
  out of sight it now sprints 2s (`THIEF_BOLT`) before creeping one tile per 1s
  (was straight to 1.5s creeps), coin trail every 4 steps up to 3 drops (was
  3/6), escape 25s (was 30s; original 20s).

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

## Shipped 2026-09-20 — Oddities (branch `feat/oddities`)

The run-identity work (#18–#31) answered *why is this delve different from the
last one*. This answers *why is this fight different from the last one*, and
adds somewhere to go that nobody planned for. Design, numbers and the harness
comparison are in **docs/ODDITIES.md**.

1. **Attack moves.** A creature carries a weighted move set and rolls one when
   it commits: jab, flurry, thrust, sweep, slam, feint, or the plain blow.
   Every move is priced against the plain blow's damage over time and sits
   within 4% of it (`relativeDps`, pinned by `attacks.test.ts`). Measured over
   seven bot profiles: damage taken flat, hits taken up ~28%. Twenty creatures
   have a set; archers and the King do not.
2. **Strange floors.** `Floor.quirk`, rolled per fresh floor at depths 2–5 and
   applied *after* generation, so `generateFloor` stays pure and the golden
   hashes keep their meaning. The Forbidden Pasture (upside down, cattle) and
   The Silent Picture (black and white, ×1.25, hats and monocles, every melee
   weapon drawn as a cane).
3. **Three weapons.** The Big Toe (ordinary drop pool), and two relics locked
   to their floors by `UniqueDef.only`, which keeps them out of every
   Legendary roll including the King's promise.

### What this leaves for next time

- **The bot cannot play a strange floor properly.** The Silent Picture is only
  a time scale so the harness handles it, but the Pasture's difficulty is a
  camera roll, which the bot does not experience at all. Its numbers for that
  floor mean nothing. Either accept that it is a human-only difficulty or give
  the bot a penalty that stands in for disorientation.
- **A per-save record of strange floors seen.** The codex has relics and the
  bestiary has monsters; there is nowhere that remembers you found a Pasture.
  A line in the codex would cost little and would make them collectable.
- **More quirks.** The machinery is generic — enemy pool, lighting, post pass,
  time scale, loot promotion, music — and adding a third is now a data change
  plus whatever art it needs. Candidates that reuse what exists: a floor where
  every container is a mimic, a floor lit only by what you are carrying, a
  floor where the monsters are asleep until you make a noise.
- **Elite cattle read oddly.** An elite trait's pulse on a cow is correct but
  unremarked; the Pasture might want its own trait names.
- **Sweep has no shield answer.** It is priced 10% under neutral because it
  takes the sidestep away, but a tower shield does nothing special against it.
  If sweeps end up feeling unfair, the lever is letting a raised guard cover
  the flanks rather than making the move weaker.

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

---

# 4. The battlemage — **BUILT 2026-10-12**

The user's direction: magic should make a **battlemage** possible, sword in one
hand and spell in the other, rather than a ranged caster or a bigger sigil
list. Sigils stay exactly as they are (one attuned, utility, long cooldown);
this is a second, separate thing.

## The problem

Every elemental stat in the game (Fire, Frost, Shadow, Holy) is a rider on a
melee swing. There is no way to *fight* with an element: no build where
picking Flame Shards over Frost Shards changes how a fight plays rather than
how big the numbers are. Ranged play exists only as a belt of shafts. And the
offhand slot has one honest answer, a shield, plus the two-handers that empty it.

## North star

> Give up the shield for a spell, and weave the two: a spell that lands sets
> up the blade, and a blade that lands feeds the spell.

A battlemage should play differently from a sword-and-board, not just hit from
further away. If the best way to use a conduit is to stand back and cast, the
design has failed.

## Decisions

- **Conduits are a new offhand class**, not a weapon and not a sigil. Named
  *conduits* because "Spell Focus %" and gem "catalysts" are already taken.
  A conduit blocks far worse than a shield (Wand 30%, the bare-weapon rate;
  Rod more, see Bases). **Parry is unchanged.** Weak guarding is the main cost
  of the trade, and it makes the parry matter more for a battlemage, not less.
  A conduit and a **thrown belt can both be worn**: the belt has its own slot
  and stays exactly as it is.
- **No mana bar** (the rule from §9a holds). A conduit holds a few **charges**
  that **regrow on a timer during the delve** (settled: not a per-delve stock). Each cast also costs **stamina** from the bar you
  swing with. Kills shave the regrow time through the same `refundSigil`
  machinery and its 20% cap.
- **A spellbook, and several spells loaded at once** (user, 2026-10-11:
  "unlock and have multiple spells loaded"). Spells are learned permanently
  into `state.spellbook`. Ember Bolt is known from the start; the rest come
  from **spell tomes**, which drop where sigil stones do, on their own hashed
  stream, and never as one you already know. A tome is read at the forge's
  *Spells* bench, which also **loads** spells into the worn conduit's slots:
  **Wand 2, Rod 3, Stave 4**. All loaded spells draw on the conduit's one
  shared charge pool. You change the loadout only in town, or while a town
  portal is open (the sigil rule). One spell is *selected* at a time, and the
  cast input casts it.
- **A cast is scored like a throw.** The conduit's own power, plus the
  player's matching elemental stat, goes through `mitigate` at half armour
  (the existing elemental rule) and then × the monster's resistance. Fire gear
  makes a fire conduit stronger, so elemental stats finally have a build that
  wants them.
- **Weave, the battlemage rule.** It is on every conduit and is the point of
  the class:
  - A spell that lands **charges your weapon** with its element for the next
    blow within 3s (a bonus about the size of a tier-matched Kindled draught).
  - A melee blow that lands **takes 1.5s off** the conduit's regrow.
  - So the loop is cast, close, strike, cast. Standing back and casting runs
    dry; swinging without casting wastes the charge.

## The four spells

One per element. Each works on a mechanic that already exists, so none needs
a new combat subsystem.

| Element | Spell | Shape | What it is for |
|---|---|---|---|
| Fire | **Ember Bolt** | Projectile, range 5 | Damage, plus a short **burn** (damage over 3s). Feeds the Kindling property |
| Frost | **Rime Lance** | Projectile, range 5 | Light damage; the target's next wind-up is **×1.5 longer** for 4s. Makes parries easier to land: the defensive spell |
| Holy | **Smite** | **Hitscan**: lands at once on the first monster in your line, range 5, no bolt | A golden-white **streak** strikes down over the target. ×2 on undead, and a kill **sanctifies the remains** (the Ossuary law and the Gravecaller already read this) |
| Shadow | **Hex** | **Hitscan**, range 5 | Turns the monster into a **penguin for 15s** (user, 2026-10-11): it cannot attack, waddles, and keeps its health. Damage does not break it. The control spell, priced in charges accordingly. Works on **elites**; bosses and lieutenants refuse it. Costs **2 charges** (user, 2026-10-11) |

Enemy resistances already make the choice matter: a fire conduit into the
Frost Vault meets ×1.6 Rimebound, and into the Emberworks meets ×0.45 Slagborn.
That gives the road fork and the day's rumour a new reason to change your kit.

## Bases

| Base | Slot | Material | Notes |
|---|---|---|---|
| Wand | offhand | wood | Entry conduit: 3 charges, 30% block. Recipe bought at the forge |
| Rod | offhand | metal | The Wand's step up its gear line, **stronger on every axis**: harder casts, 4 charges, faster regrow, more block (~40%), some Defense. Blueprint, depth 3+ |
| Stave | weapon **2H** | wood | A blunt melee weapon that is also a conduit: 5 charges, strongest casts, no offhand at all. Line of one, like the halberd. Blueprint, depth 4+ |

All numbers are placeholders until `npm run tables` has a conduit row to place
them against: a wand cast should land near a thrown knife at the same tier,
and a full charge bar should be worth about one belt of javelins per fight.

## Controls

**Casting gets its own input** (settled; thrown belts keep theirs). With
several spells loaded, the input also needs a way to pick the next one:

| Device | Cast the selected spell | Select the next loaded spell |
|---|---|---|
| Keyboard | **V** (beside the sigil's C; ignores key repeat like T, R, G, C) | **B** |
| Touch | Tap the **Cast** button (tools row, beside Throw, Call and Sigil; shown only while a conduit is worn, dimmed while spent) | Tap the **↻** button beside it (shown with two or more loaded) |
| Gamepad | Tap **D-pad Down** | Hold **D-pad Down** for 0.4s |

D-pad Down was picked because every face button and bumper is taken, and it
only duplicated the left stick's step back; D-pad Up still steps forward. The
HUD shows the loaded spells as a short row with the selected one lit, plus
the shared charge pips.

## Build order

1. **Wand and Rod, Ember Bolt and Rime Lance.** Conduit offhand, the
   spellbook and loadout, a Rime Lance tome, charges, the cast and next-spell
   inputs, Weave, the forge's Spells bench, the HUD spell row and pips,
   viewmodel and cast pose, projectile art (reuse the Flame Wraith and Frost
   Wisp bolts), patch note.
2. **Smite and Hex (their tomes), and the Stave.** Both are hitscan
   (settled 2026-10-11), so neither has a bolt: Smite draws a golden-white
   streak down over its target, Hex needs penguin art (idle, waddle) and a
   poof. Hex costs **2 charges** and works on elites (user, 2026-10-11,
   replacing an earlier "1 charge plus a cooldown"). Open: whether it also
   keeps its own 30s cooldown. If it does, spells gain an optional per-spell
   `cooldown` beside the shared pool, and the HUD dims a cooling spell with a
   dial like the sigil's.
3. **Battlemage payoffs.** Two or three build properties (for example a
   parry that refunds a charge), a relic, and the conduits joining Oath rewards.
4. **Harness.** The bot casts, so `npm run playtest` and `tables` can price it.

Standing constraints apply: new item bases and `state.spellbook` /
`state.spellLoadout` only, additive migration, `SAVE_REVISION` bump, no `SAVE_VERSION` change;
any generation roll for conduit or blueprint drops on its own hashed stream;
every new sprite id in `ALL_ART` needs its PNG in `public/art` or boot throws.

## Progress

- 2026-10-11 — **Step 1 built** (branch `feat/battlemage-1`). Wand and Rod,
  Ember Bolt and Rime Lance, the spellbook and loadout, Rime Lance tomes in
  chests (own `tome:` stream), charges and regrow, Weave, the forge's Spells
  bench, V/B, touch Cast/↻, gamepad D-pad Down tap/hold, HUD spell row and
  pips, conduit viewmodels and cast pose, art sheet *Spells* page (plays each
  cast), lab racks both conduits and knows every spell. Save revision 30.
  Played in a headless browser on a normal delve: casts land, burn ticks,
  chill applies, no console errors. Numbers are first-pass: the balance
  harness's bot does not cast yet (step 4). Not done: a phone-width check,
  Smite/Hex/Stave (step 2), and the lab room itself crashes the headless
  software renderer (on master too), so it was checked through `?autostart=dungeon`.
- 2026-10-12 — **Step 2 built** (branch `feat/battlemage-2`). Smite and Hex,
  both hitscan, with tomes (they joined the `tome:` pick automatically: never
  one you know or carry). Smite: holy, a streak of light, not turned by a
  shield, ×2 on undead through their existing holy resistance, and its kills
  are sanctified. Hex: 2 charges, a penguin for 15s, refused by the King and
  the lieutenants with the charges handed back. **Settled the open question:
  no separate 30s cooldown**; 2 charges is the price (2 of a Wand's 3). The
  Stave: a blunt two-hander and the strongest conduit (4 slots, 5 charges,
  8s regrow), 80% of its Attack as spell Power, blueprint from depth 4.
  Art: penguin (standing, mid-waddle), Smite streak and Hex puff (two frames
  each), Smite and Hex icons, Stave icon and viewmodel with its lit crown.
  Golden loot hash re-pinned as `staveLootHash` (the Stave joined the weapon
  drop pool). No save revision bump: nothing new on `GameState`, and
  `EnemyState.hexT` is optional like `chillT`. Next: step 3 (payoffs), step 4
  (the harness bot casts), then rites (§6).
- 2026-10-12 — **Steps 3 and 4 built** (branch `feat/battlemage-3`), step 4
  first so the payoffs were priced against a bot that casts.
  **Harness:** `Policy.cast` (off by default, so older profiles measure what
  they did): the bot looks down its four lines for the first monster in each,
  Hexes an elite or anything while two close in, Smites the undead, otherwise
  Ember Bolt, else Rime Lance; only at range, never into a wind-up at arm's
  length, never below a swing's stamina. Reports casts per spell, misses and
  hexes. `npm run playtest:battlemage` (the careful bot, depth-4 kit, same 24
  seeds: shield / Rod idle / Rod / Rod with both properties / Wand / Stave)
  and a `spells` block in `npm run tables` (every conduit × spell through the
  game's own `spellView`, now exported from `player.ts`). Result: every
  casting kit within noise of the shield (46–54% deaths vs 50%), same damage
  taken; per-cast and per-pool numbers sit where the Bases section asked
  (Wand pool under a javelin belt, Rod about a belt of axes, Stave about two).
  **No spell numbers changed.**
  **Payoffs:** Countercharm (weapon/offhand: a parry returns a charge) and
  Requiem (hands: a spell's killing hit returns its charges); Dr. Mantis
  Toboggan's Rod (relic, moonsilver Rod, depth 4: a cast the pool cannot
  cover is paid at 10% max health per charge short, never the last point);
  and kept Oaths now teach **lessons**, inscriptions or unknown battle spells
  (`spell:<id>` in `oathReward.choices`). "Conduits joining Oath rewards" was
  read as the spells, which are knowledge like inscriptions; conduit
  blueprints stay drops. Loot hash re-pinned as `relicRodLootHash` (one more
  rollable relic). No save change: the reward choice is still a string.
  Not done: the bot never wears the relic, and a phone-width check of the
  reward pane with spell rows.

## Settled 2026-10-11

- **Input:** casting has its own key and button; thrown belts are untouched
  and can be worn alongside a conduit.
- **Charges:** regrow on a timer within the delve.
- **Wand → Rod:** the Rod is stronger than the Wand overall, not a sidegrade.
- **Bolts look like what they are** (user: the orbs "look so bad"): Ember
  Bolt is a fireball and Rime Lance an icicle, drawn head-up and turned by
  quarter turns relative to the view, with their own HUD icons.
- **Smite and Hex are hitscan** (user, 2026-10-11): Smite a golden-white
  streak over the target, Hex a 15s penguin.
- **Spells are unlocked and several are loaded at once.** This replaced the
  earlier draft, where one gem attuned into the conduit set its element.
  Elemental *gear* stats still power the matching spells.

---

# 5. Elemental hazards — **BUILT 2026-10-12**

The user's follow-up, to come after section 4: biome hazards and elemental
interactions, so that **fire burns oil, water puts out fire**, and so on.

The ground is already laid. The Emberworks lava, Catacombs water and Frost
Vault ice are currently **decoration only**: no damage, collision, interaction
or persisted state (MECHANICS.md, Elemental surfaces). The four biomes with no
law yet (Catacombs, Frost Vault, Emberworks, Sporegrove) are the elemental
ones. So this is most naturally **the missing four biome laws, built as one
system of surfaces that the battlemage's spells act on**, rather than four
unrelated rules.

To design once section 4 exists:

- A per-tile **surface** layer on `Floor` (oil, water, ice, burning, spores),
  persisted with the floor, generated on its own hashed stream.
- A small interaction table, applied equally to the player, monsters, spells,
  elemental bolts and the elemental residents. Fire ignites oil and spores
  and melts ice into water; water douses burning; frost freezes water to ice;
  holy or fire burns spores away.
- Each surface stays **readable** (punishing, not unfair): it is drawn on the
  tile, and anything that will change it gives a tell first.
- The test for each one, from the run-identity plan: it must be something you
  can *use* (lure a Slagborn onto oil, then light it), not just a tax on
  walking.

## Decisions (2026-10-12)

The user moved this ahead of rites (§6): "more interactive and more frequent
gameplay". So the first step is the part that appears on **every** floor, not
the four biome laws, which come after.

- **Surfaces are common.** Every fresh floor from depth 1 gets pools: two of
  oil and one of water as a base, 3–6 tiles each, in ordinary rooms. The
  biome shifts the mix: Mines and Emberworks more oil, the Frost Vault lays
  its water as ice, the flooded Catacombs (already water from wall to wall)
  get only a slick of oil. Laid after generation on the `surface:` stream,
  like quirks, so `generateFloor` and every golden hash stay put.
- **Four surfaces to start:** oil, water, ice, fire. Spores (Sporegrove) and
  live lava (Emberworks) wait for their biome laws.
- **One table, applied to everything.** Fire from anywhere (a spell, a
  monster's bolt, a blow carrying fire, a burning or fiery creature's feet)
  lights oil and melts ice; frost from anywhere freezes water. You get no
  exemption: a monster's fire bolt lights the oil under *you*, and its frost
  bolt freezes the water you stand in (1s for you, 2.5s for a monster).
- **Fire** burns 6s a tile, walks to the next oil tile every 0.3s, bites
  whatever stands in it every 0.5s (you through armour like a trap; a
  monster raw × its fire resistance) and sets a monster burning, so it
  carries the fire out with it, into more oil, or into water, which puts it
  out. Monsters will not walk into fire and step out of it.
- **Ice** makes a monster struck on it slip: down for 0.8s, out of its
  wind-up. Bosses never slip or freeze.
- **Readable:** every pool is drawn on its tile with a few dim emissive
  pixels so it shows in the dark; fire lights the room.

## Build order

1. **Oil, water, ice, fire** on every floor, the interaction table, art,
   and the bot walking round fire. *(built)*
2. **The four biome laws, as surfaces.** *(built)*
   - Catacombs, *the water carries*: frost that **lands** where a bolt
     stops freezes the flood within 1 tile, and whatever stands there. Not
     along a bolt's path, or one Rime Archer would freeze a corridor; and
     not under a frost blade's blows, which in the first build froze
     everything a moonsilver axe touched (141 freezes in 24 bot delves).
     Flood ice thaws back into the flood. Your own bolt never holds you; a
     monster's does.
   - Frost Vault, *the ice is treacherous*: two more ice pools; a monster
     that slips is also open (double damage) while down, and you go down
     for 0.6s when an unblocked blow lands on you on the ice.
   - Emberworks, *the vents breathe*: 4 vents per floor, bursting every
     7–11s after a 1.2s glowing warning: the tile is scorched (2 of fire's
     ticks) and oil beside it catches. Monsters do not avoid them, which is
     the point. (Chosen over making the decorative lava live: a vent is a
     tile you can read and plan around; the lava bubbles are scenery.)
   - Sporegrove, *the spores*: 4 patches of 1–3 tiles. Treading on one
     puffs it away, blinding every monster within a tile for 3s (they
     stumble, as under Flash) and dimming your lamp for 3s if you are in
     it. Fire makes spores burst: 2 ticks of fire over the tile and the four
     beside it. (Holy burning them away was dropped: nothing would use it.)
3. **Oil barrels**: red-hooped barrels, one per floor (two in the Mines,
   the Emberworks and the barrel biomes), against a wall where they cut
   nothing off. Smashed, a barrel spills oil over its tile and up to five
   more, and holds no loot. Reached by fire it bursts: the spill goes up at
   once and 3 of fire's ticks land on the tile and the four beside it.
   *(built)*
4. **Harness**: the casting bot prefers Ember Bolt when oil, spores or a
   barrel lie on its line or beside the target (never when it is standing
   in or beside fuel itself), and Rime Lance at a monster in water or
   anywhere on the Catacombs' flood; it walks round vents and never smashes
   an oil barrel. Reports count oil lit, monsters frozen, slipping and
   burned to death. *(built)*

## Progress

- 2026-10-12 — **Step 1 built** (branch `feat/hazards-1`). `Floor.surfaces`
  (optional, no save revision bump: older floors simply have none),
  `src/data/surfaces.ts` (rules and numbers), `src/systems/surfaces.ts`
  (placement, `ignite`, `chill`, `tickSurfaces`), the world's hooks
  (projectiles crossing tiles, blows, monster steps, `updateSurfaces`,
  `freeze`, `slip`, `escapeFire`), the renderer (decals, flames, firelight,
  frozen tint), six sprites handed to the artist, the bot walking round
  fire. Not done: steps 2–4, the automap does not show surfaces, and no
  sound of its own (it borrows lava, splash and snuff sounds).
- 2026-10-12 — **Steps 2–4 built** (branch `feat/hazards-2`, stacked on
  `feat/hazards-1`). The four elemental biome laws (`flood`,
  `treacherous`, `vents`, `spores` in `src/data/laws.ts`), oil barrels
  (`Prop.oil`), and the bot working them. New sprites: oil barrel, vent,
  spores, a spore cloud and a burst of fire (two frames each, the shape of
  Hex's puff). Still optional fields only: no save change. Not done: the
  automap, sounds of their own, a phone check, and nothing yet reads the
  spores' blinding against the bot (it never steps on them on purpose).

---

# 6. Rites: sigils you draw — **IDEA 2026-10-11, SLICED 2026-10-12**

**Sliced:** Meteor end-to-end — depth-3 carving, study-to-learn, trace-to-cast on mouse, touch and gamepad with the world at 15%, full/weak/botch grading, once-per-floor plus burn-every-charge cost. Still open: Glacial Tomb, Judgement and the Great Penguining; milestone pacing (depth 5, first King kill, rising random chance); whether the marks live in a rereadable book or in memory.

The user's idea, from their claudemancy tool (draw a sigil to cast a skill):
cast by **drawing** instead of a button, with time slowed while you draw.
Their worry: as an everyday input it would get old fast. So it is kept for a
small set of **rites**, rare and fight-changing. Ordinary spells stay on the
button (§4).

## What a rite is

- **Very powerful, and rare to cast.** Once per floor, and it burns every
  charge in your conduit. You save it for the moment that matters.
- **Drawn, in slow motion.** Hold the cast input; the world slows (to about
  15%, tuned so it is a dramatic beat, not a free pause); trace the sigil on
  the view; release to cast. Only possible this rarely, which is what keeps it
  from undoing Hard's real-time reading of wind-ups. Touch and mouse draw;
  gamepad would need the right stick or a fallback.
- **Drawing quality decides the outcome.** The recogniser's match score: a
  clean trace lands the full rite, a sloppy one a weaker one, a botch
  **backfires** (a curse, a hit to yourself, or a burst on your own tile).
  The risk is what keeps it exciting the tenth time.
- **Recognition:** port claudemancy's $P point-cloud recogniser (~150 lines)
  and its plain-text `.sigil` format, one stroke per sigil.

Example rites, one per element:

| Rite | Element | Effect |
|---|---|---|
| Meteor | fire | Fire falls on every monster in the room |
| Glacial Tomb | frost | Everything in sight frozen solid for several seconds |
| Judgement | holy | A pillar of light; every undead in the room dies and stays dead |
| The Great Penguining | shadow | Every monster in the room is a penguin for 15s |

## How they are found

**Carvings** on walls. Studying one unlocks the rite for good. The game must
have recorded it as seen: drawing a rite you never found does nothing, so a
guide online cannot skip the hunt. Open: whether the sigil is shown again
after (a list of names at the forge, drawings only in memory), or kept in a
book you can reread.

Pacing, the user's main concern: never too soon, never too late, never a
flood. It copies the flask shards' milestone pattern, plus a small random
chance (user, 2026-10-11):

| Source | When |
|---|---|
| Guaranteed | First time you **reach depth 3** |
| Guaranteed | First time you **reach depth 5** |
| Guaranteed | Your **first King kill** |
| Random | Every floor from depth 3, rising with depth: **2% / 3% / 4% / 5%** on depths 3–6 |

- Nothing before depth 3, so the opening floors keep their tuning.
- A full delve to the King finds a bonus carving about 13% of the time
  (1 − 0.98·0.97·0.96·0.95), roughly one every 7–8 full delves.
- At most **one new rite per delve**; never one you know or carry. Rolled on
  its own hashed stream (`rite:`), so no existing floor moves.
- Placed in that floor's vault or secret room, else a dead end, so it is
  still *found*.
- Which rite: random among those the depth allows, or tied to the road taken
  (the Frozen Road teaches Glacial Tomb). Open.
- Check with the balance harness: report on which delve each rite arrives,
  per bot profile. Caveat: the bot finds secret rooms poorly, so placed
  carvings will read late in its numbers.

## Order

After battlemage step 2: the rites reuse its machinery (burn, chill, penguin,
sanctified remains), and with more spells the button path is settled first.
