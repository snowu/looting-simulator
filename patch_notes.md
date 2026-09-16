# Learn from broken blades, earn the better steel

*Unreleased, on `fix/hard-progression-gates`. No save break: existing recipes, gear, mastery and renown carry over (save revision 19 adds per-recipe salvage counts, nothing resets).*

Crafting mastery used to hinge on rare duplicate blueprints while wood, hide, cloth and bone ladders dead-ended before the deep tiers. This spreads single-copy plans through the dungeon, lets salvaging an unidentified weapon teach its recipe, completes the material ladders, and paces late merchant stock by game day and depth. On top of that, Hard closes two early power shortcuts — depth-1 gems pulling from the whole catalyst catalog, and guaranteed special-chest rarity making Uncommon the whole early game — and smooths the reward curve without slowing everything down.

## Blueprints, one at a time

- Every blueprint drop is a **single plan**; no bundles. Secret chests always hold one.
- Depth 1 → 6 chances: urns **2.5% → 5%**, chests **14% → 24%**, vaults **38% → 53%**, enemy bonus rolls **1.2% → 3.2%**. The boss keeps its guaranteed plan. Across 1,200 generated Hard floors, full clears average **1.98 / 2.31 / 2.62 / 2.94 / 3.44 / 4.29** plans on depths 1–6 — yields, not promised take-home loot.
- Plans never arrive before their base's minimum depth. Early plans retire three floors after debut (daggers: depths 1–3); depth-4+ plans stay in the endgame pool. Merchant blueprint wares follow the same pool using best depth.
- Relevant weapon plans get easier to find deeper down (softer gear-ladder scarcity, weapon weighting 1× → 2.5×). Unknown plans keep their preference; fully capped pools still yield sellable spares.

## Salvage teaches the recipe

Found unidentified melee and thrown weapons teach their matching recipe as well as giving materials: **4** salvages to unlock, then **5 / 6 / 7 / 8** for ranks 2–5. The forge shows progress and reports gains; blueprint upgrades keep earned salvage progress. Crafted, identified and armour pieces teach nothing; rank 5 stays capped. Blueprint costs stay 1/2/3/4/5.

## Materials and a slow merchant

Nine additions complete tiers 1–5 for every structural category: Deep Yew, Starwood, Troll Hide, Wool, Astral Silk, Dense Bone, Fossil Bone, Wyrm Bone and Titan Bone. Recipe quantities, material gates, mastery bonuses and catalyst power are unchanged.

Late structural merchant stock is deliberately small, including on Hard (both day *and* depth gates must be met; only a finished delve past depth 1 advances the day):

| Tier | Depth needed | First shipment | Refill | Shelf cap |
| --- | ---: | ---: | --- | --- |
| 4 | 5 | Day 6 | 1 every 3 days | 1, then 2 at day 12 |
| 5 | 6 | Day 18 | 1 every 6 days | 1, then 2 at day 30 |

Buying every Star Iron shipment on days 18/24/30 supplies three units over that span: exploration remains the primary source.

## Hard: catalysts stay deep, rarity ramps gradually

- Empty gem pools now yield **no gem** instead of widening to the entire catalog — no more tier-4 catalysts from a depth-1 chest. Found gear records its source floor so a lucky +0–2 item-level roll cannot unlock next-floor salvage gems.
- Authored monster catalysts obey the same gates in both difficulties: premature Frost Shards, Sunstones, Wardstones, Flame Shards and Shadow Essence become **Crystal Shards** at depths 2+, deferred entirely at depth 1. Early iron, leather and spider-silk drops remain as documented exceptions.
- Hard vaults/secrets still guarantee gear, but the first piece now rolls a minimum-rarity *chance* that grows with depth instead of a universal floor (second piece uses natural rarity; Normal keeps its previous guarantees; boss guarantees unchanged):

| Depth | Uncommon-or-better | of which Rare |
| --- | ---: | ---: |
| 1 | 20% | 0% |
| 2 | 35% | 0% |
| 3 | 50% | 15% |
| 4 | 65% | 30% |
| 5 | 80% | 45% |
| 6 | 95% | 60% |

At zero Find this takes depth-1/2 Uncommon from 82–83% to **26.5% / 40.0%**, and replaces the depth-3→4 Rare cliff (7.9% → 59.8%) with **14.0% → 21.0% → 26.8%** across depths 3–5. No premature gems remain in the 2,400-floor sample.
- **Appraiser II no longer costs you mastery**: auto-identified Uncommon/Rare weapons keep salvage eligibility (including after saving); manually identified weapons still spend it. Previously identified weapons in old saves lack provenance and cannot be retroactively classified.

Fewer enchanted early drops also means fewer salvage-eligible weapons (depth 1: 0.58 → 0.23 per clear). That is documented rather than offset with a mastery buff — multi-day playtesting is still needed to judge time to rank 5.

Validation: `npm test` passes **545/545** (48 files), `npm run build` passes, 2,400-floor progression benchmark passes, `git diff --check` clean. Historical golden fixtures retained; a separate progression hash pins the intentional distribution change.

---

# Weapon overhaul, continued: retrieval, hands, and redrawn gear

*Unreleased, on `feat/weapon-overhaul`, on top of the notes below. Still no save break: `SAVE_VERSION` and `SAVE_REVISION` do not move.*

## Retrieval is a hold, and it reaches the whole run

Calling shafts back used to be a tap that only swept the floor you stood on. It is now a channel: **hold R** (or hold Call on touch) and release to stop. Shafts already in the air still land when you let go — stopping a call never loses anything.

- The call reaches **every floor of the run**, not just this one. A shaft further than nine tiles away, or on another floor entirely, returns from a couple of tiles ahead of you instead of flying across the dungeon, so the animation stays honest and distant stock is never stranded.
- The raised receiving hand **holds its pose until the last shaft lands**, with a small beckoning pulse per return; the shield stays lowered while you call.
- The belt counters count floor stock **and** shafts already flying home, so the number beside the belt is the number you will get.
- Throws also recover much faster — knives 0.34s → 0.10s, axes 0.46s → 0.14s, javelins 0.58s → 0.18s — so hurling one no longer locks you out of the next action.

## Hands, shields, and icons redrawn

Every held sprite is redrawn at twice the density (48px wide canvases; the renderer normalises by canvas height, so blade length now survives it) with one shared hand language: broad knuckles, short brown creases, diagonal brass cuff, light from the upper left.

- **Dagger** and **Short Sword** get their own viewmodels instead of sharing the Long Sword's; blade length is the difference between them.
- Each shield gets its own model — round buckler, pointed kite, broad tower — mapped per base, and the renderer draws the equipped one rather than a single `vm_shield`.
- The retrieval hand is its own open receiving hand (`vm_hand`), and the casting stone is a round ring-carved sigil whose lit frame burns the carving.
- Held weapons are now **recoloured by the equipped material** in the renderer, skin and brass untouched; the art-sheet Viewmodels group stages tall models at native pixels and pins the deciding crafting material per base, with `npm run art:sheet -- viewmodels --material <id>` to match.
- Weapon icons follow one convention — thin silhouette on a diagonal, head top-right — and each sigil stone takes its own tint and shape, so the five stop being the same pebble with a scratch.
- `npm run art:sync -- --ids vm_blade,vm_axe` regenerates just the named art without touching hand-painted PNGs.

## Thrown weapons are no longer held

A fistful of javelins held up through the wind-up put a second pair of hands in the frame beside the ones already holding your weapon, so the three thrown viewmodels are deleted: a throw animates nothing, and the shaft in flight plus the shaft on the floor is the whole of a belt's art. The art-sheet Props group now lists both explicitly — **Thrown · in flight** and **Thrown · on the ground**, derived from the belt data — and the orphaned handoff PNGs are gone.

Validation: `npm test` passes **465/465**, `tsc --noEmit` clean.

---

# Weapon overhaul: two hands, thrown steel, and sigils

*Unreleased, on `feat/weapon-overhaul`. Nothing here invalidates a save: `SAVE_VERSION` does not move, every new field is additive, and an existing character keeps its gear, its stash and its renown.*

Six new weapon bases and a spell system, aimed at the one complaint the roster had — that every weapon was a stick of a different length, and the offhand was a shield in all cases because there was never a reason for it not to be.

## Two-handed weapons

**Halberd**, **Great Maul** and **Greatsword**. Wearing one empties your offhand: the shield goes back to the pack you drew the weapon from, and you are refused the swap outright if there is nowhere to put it. Nothing eats your gear.

That is a real loss — a silver Tower Shield is +12 Defense and 82% block, and a two-hander blocks 20% — so each buys something a shield cannot:

- **A cleave**, at 25% of the blow, into every tile touching the thing you hit. Beside it, diagonally, and *behind* it. A guard only ever covers the tile you face; this covers the rank behind that tile, and with a halberd's reach it lands three tiles deep into a corridor. It never spills back onto your own tile, and a cleaved blow is glancing: one guard chip, and it will not bash a shield open.
- **Stagger**, adding to a struck enemy's attack cooldown — half a second on the halberd. It buys you time. It does not cancel a wind-up; cancelling wind-ups is the parry's job and stays the parry's job.
- **Two guard chips** a swing, so a shieldbearer opens in two blows instead of three.

**They hit harder than anything one-handed**, and the cost is weight. A Great Maul lands the biggest blow in the game, about twice a Long Sword's; the Greatsword has the highest sustained damage of any weapon.

What you pay is Speed, three times over: the swing slows, every step slows, and past −12 total speed you are encumbered and your steps slow again. A Great Maul alone sits exactly on that line — put it over Plate Armour and you will feel every corridor. They drink the bar too, 27 to 31 stamina a swing, which is three swings from full on the maul.

One place they are not the answer: armour compresses flat damage, and the Ashen King has the most of it. Against him a Long Sword lands 44.8 and a Great Maul lands 53.9 — most of the maul's advantage is eaten, and the faster weapon wins the race. Against the Hollow Knight and the Barrow Champion, where blunt bites, the maul kills in 9.7s against a War Axe's 14.7s.

**Parrying is completely unchanged with a two-hander.** It never needed a shield and still does not.

## Thrown weapons

**Throwing Knives**, **Throwing Axes** and **Javelins** — and they are not weapons. A belt of shafts gets a slot of its own, worn alongside whatever is in your hands, and unlike a shield a two-hander does not displace it. A greatsword and a bandolier of javelins is a good loadout.

The belt gives you no stats at all: it is ammunition, not gear. And a throw is scored on the shafts alone — your sword never makes your javelins hit harder, and good javelins never make your sword hit harder. Your Crit, leech and elemental damage still ride along, because those are things about you.

**You throw with [T].** Never with the attack button, which used to throw by itself whenever nothing was adjacent — so the weapon decided for you, you could not choose to close and stab, and stepping back from a fight spent a javelin you were saving.

The stock is finite, filled once when you first carry a belt into a delve, and nothing refills it. Spent shafts land where they stop — in the thing you hit, not in front of it — and persist across a trip upstairs and back. Walk over one to collect it, or hold **R** to call them back from anywhere in the run: **one every three quarters of a second**, paying a point of belt wear for each as it arrives. Releasing stops the call, and anything already airborne still lands.

So a full belt of knives is five seconds of standing still, which a fight will not give you. The decision to throw the last one is a real decision.

A javelin thrown is about what a Long Sword swung is. But a belt is three of them, and then it is nothing until you have walked over to get them back.

## Sigils

Five of them, and you carry exactly one, chosen in Bleakmere before you go down. You can never hold both the escape and the control, so a fight is played with the tool you guessed at upstairs.

There is no mana bar — a mana bar is topped up in town and free in the moment it matters. Each sigil has its own long cooldown and is cast out of your stamina, with **G** or **C**.

- **Wardcry** — shoves what you face back a tile and leaves it reeling, or crushes it against the wall behind. It shouts: everything within 8 tiles learns where you are, through walls.
- **Snuff** — everything within 12 tiles loses your trail, and you are in the dark for eight seconds.
- **Sounding** — reads six tiles of stone: the map, the traps in it, and the bearing of anything hidden.
- **Threshold** — consecrates the tile you stand on for eight seconds. The parry window doubles. Step off it and it is gone.
- **Temper** — mends the most worn thing you are wearing by a quarter.

Wardcry grants no vulnerability window. A parry pays a second of doubled damage; the push pays nothing, which is what keeps it from replacing the guard.

**Kills shorten the cooldown**, so a sigil is a reward for fighting rather than a timer you wait out — and it is capped at a fifth of the base cooldown per kill, so no build resets one in fewer than five. The cooldown also runs at half speed while anything alerted is within 8 tiles, so it recovers between fights rather than during them. **Warden's Vigil** on the Warden's board and the new **Spell Focus** stat both feed the same refund; Spell Focus rolls as *Graven* and *of the Vigil* on head, rings and amulets, and the **Wardstone** forges it in.

Sigil stones drop from the Ashen King (always, while any are undiscovered), from vault and secret chests (22%), and rarely from ordinary chests. You can never be handed one you already have. A stone is **inscribed at the forge**, permanently, and attuned from the same bench.

## Fixed

- **Every save crashed on entering town.** Adding the Wardstone to the material table left existing saves without a price for it, and the market screen reads a price for every material the instant it draws. The repair now runs on every load rather than at one particular save revision, so adding a material can never do this again.
- The five sigils were drawn their own icons and then shipped pointing at a placeholder gem.
- The sigil bench did not exist. Stones dropped, the cast key worked, and there was no way to inscribe or attune one — a found stone sat in the stash for good.

---

# Balance pass: slower, harder, scarcer

*Unreleased. The worktree is uncommitted and nothing has been pushed.*

The earlier game gave roughly 40 items per floor against a 16-slot pack. By depth 3, strong gear killed most ordinary enemies in one hit while armour made their attacks negligible. This pass cuts routine loot, moves monsters onto the same depth curve as the player, and makes stamina and healing matter. It aims for a punishing dungeon where the player can read what went wrong.

## What changed

**Combat and monsters**

- Monster health now scales with absolute floor depth as well as levels past a monster's first floor: `(1 + 0.12 × overlevel) × (1 + 0.5 × (depth − 1))`. Attack and defence scale more gently, at 55% and 45% of that health increase. The new roster has higher base health, attack and armour; enemies spawn about a third less often so the longer fights do not simply multiply the crowd.
- Player damage against monster armour now uses `k=45` rather than 15. Elemental damage passes through half of monster armour instead of bypassing it. Incoming hits use `k=75` with at least 34% of damage getting through, so high-tier armour still helps without erasing attacks.
- The Cave Spider's attack cycle is slower and its wind-up easier to read. The light-enemy stagger threshold moved from 40 to 55 base HP to preserve which monsters can be interrupted after the roster's HP increase. The Ashen King's stats remain 470 HP and 32 attack.
- Stamina regenerates at 22/s after a 0.9s delay, down from 34/s after 0.5s. Fight Milk's text and calculations now reflect the new base rate.

**Loot and progression**

- Ordinary rooms have a 12% chest chance instead of 35% and usually at most one urn. Treasure rooms, shrines, the throne room and loose floor piles also contain less. Enemy gear and material drops, chest gear, potions and blueprint odds are lower. Chests and vaults pay more coin per find; vaults and secret rooms remain premium rewards.
- Natural Rare and Epic gear now start at depths 3 and 5, rather than 2 and 4. Material tiers enter later, and `materialForDepth` aims lower. Day-one market stock therefore no longer includes iron. The Ashen King's guaranteed drops remain guaranteed.
- Healing Draught restores 25% of maximum health instead of 35%; Greater Healing restores 55% instead of 75%. Shrines mend 60% of maximum health and refill stamina instead of fully healing. Their messages describe the partial mend.
- Renown payouts, durability and the global enemy damage multiplier are unchanged. The supply shop now honours Fight Milk's found-only rule instead of offering unlimited bottles.

**The Warden**

- The starting backpack is **12 slots, down from 16**. Sixteen was sized for the old loot volume; with routine loot cut by about sixty percent, no scripted profile at any depth ever filled a 16-slot pack, which removed the decision about what to carry home and left Pack Mule worth measurably nothing. A deep delve now peaks around nineteen slots, so the squeeze lands on deep runs and nowhere near the first floor. `addItem` refuses to overfill rather than dropping, and `startRun` returns anything that no longer fits to the unlimited stash, so an older save cannot lose items to the smaller pack; there is a test for it.
- Three upgrades repriced against measured value (`npm run upgrades`, each upgrade maxed and alone against no upgrades, same seeds): **Pack Mule** 4/8/14 → 3/6/11, which measured at exactly zero on depth, survival and haul before the pack shrank and is worth about +85g a run after. **Supply Crate** 3/6/10 → 5/11/18, the best buy in the tree by a distance, since healing supply is what binds a deep delve. **Treasure Sense** +12% → +20% per level, 5/10/16 → 6/13/22. It measured as close to nothing, and what it did add was almost entirely Common: find multiplied the good rarity bands but Common's flat weight of 100 anchored the roll, so "loot find" bought more junk rather than better loot. Find now divides that weight as well, and scales a chest's valuable and gem rolls, which it never touched. At +60 find that is +22% gear pieces and **+85% more Uncommons**, so it is priced as a real upgrade rather than a rounding error.
- Whole tree: **333 renown**, against 314. The total barely moved; this reshaped the tree rather than inflating it.
- **Five upgrades were deliberately not repriced.** Silver Tongue, Market Insider, Master Smith and Appraiser's Eye act entirely in town, where the bot never goes. Second Wind measures at zero as well, but only because a slow weapon's stamina regeneration roughly matches its cost per swing; it binds for fast weapons, which the bot does not carry. A number the harness cannot see is not evidence.

**Tooling and records**

- `scripts/playtest.ts` runs seeded delves through the real `World` and settles them through `endRun`. It reports deaths, depth, damage sources, parries, loot kept or lost and renown. The bot handles loot, stairs and full packs without editing floor contents. It distinguishes a depth-6 visit from an Ashen King kill. Damage from a player-triggered trap is attributed only to the following hurt in the same event batch; alarms and monster-triggered traps cannot relabel later monster damage.
- When nearby enemies repeatedly turn the bot away from a route, it can use the player's strafe or back-step controls to leave the tile. This removes a seeded playtest timeout without changing game combat.
- `npm run playtest` includes fresh, geared and prepared profiles; `npm run tables` produces faster static composition, loot and combat tables. The separate `scripts/prepared.bench.ts` compares reaching depth 6 with seeking the King under the same seeds. `scripts/` is now trackable apart from the personal helper. The ordinary test suite remains separate.
- Seven new tests cover balance gates and guaranteed boss loot. `docs/MECHANICS.md` is the numerical reference, including generated monster tables; `docs/NEXT.md` records the remaining playtest questions. No save format or migration changed. Floors already stored in a live run retain their generated contents.

## The Ashen King, in three phases

He was the biggest trash mob in the game: one telegraph, one volley, thirty swings of health, and nothing changed between the first swing and the last. The fight now asks a different question as it goes, and each one is something the six floors above already taught.

- **The Throne** (100–65%) — the fight exactly as it was. Read the telegraph, step off the tile.
- **The Dark** (65–30%) — he puts out every torch in the throne room, permanently, and the guards you killed get back up at a third of their health. Only his glow and your lantern are left; the Lantern Wick finally earns its renown.
- **The Last Stand** (30–0%) — the crown splits, he gets faster, and he raises a ward of shadow that turns blows the way a shieldbearer's guard does. Openings have to be made, and the parry is how.

**He stays one creature.** Phases change his sprite family, glow, wind-up, recovery and whether he carries a guard; his id, name, resistances, hoard and health are untouched, because the codex, the field notes and the one guaranteed relic in the game are all keyed off them. `enemyView()` folds the phase into a copy of the stat block, so the guard rhythm, the sprite picker and the volley read the fields they always read.

**Which phase he is in is derived from his health, not stored**, so it cannot drift out of step with the bar — and a King already mid-fight in an older save resolves on the next tick with no migration. `SAVE_VERSION` and `SAVE_REVISION` both stay where they are.

**The turn is an opening, not a free hit.** He reels for 1.2 s and cannot act while the room changes around you — the same grace beat the mimic gets when it unfolds. It is deliberately *not* a parry window; that belongs to the parry. Anything he had in the air is cleared when the lights go out, because losing the room and three unseen bolts in the same instant is the one genuinely unfair combination here.

**Health 470 → 330**, so racing him is about 23 swings at the gear depth 6 is meant to be reached with, and clearing the risen guards too is about 32. The old fight was a flat 30. The guards are optional — phase advance is driven by the King's health alone, so you can ignore them and carry two knights into the last phase.

**A risen guard pays nothing.** Killing one again costs it no second hoard, no second tally and no second contract credit; without that the throne room would be the best place in the game to farm a Hollow Knight's moonsilver.

Art is recomposed, not redrawn: two new palettes over the existing grids, a crown with its two inner points knocked out, and an emissive ward stamped across the chest for the guard pose. No new 48×48 sprites.

## What the checks show

The 24-seed headless report uses the same seeds for the fresh parry comparison. These are scripted policies, not human success rates.

| Profile | Before | After |
|---|---:|---:|
| Fresh character, 35% parry | 38% die; mean depth 2.46 | 58% die; mean depth 1.67 |
| Fresh character, no parry | 63% die; mean depth 2.00 | 54% die; mean depth 1.58 |
| Iron Rare kit, aggressive | 21% die; mean depth 5.58 | 54% die; mean depth 3.17 |
| Iron Rare kit, careful | — | 33% die; mean depth 3.21 |
| Moonsilver Epic kit, aggressive | 0% die; all reach depth 6 | 54% die; mean depth 4.50 |
| Moonsilver Epic kit, careful | — | 42% die; mean depth 4.58 |

At 64 seeds the fresh profile settles at mean depth 1.77 with 75% reaching depth 2, so the 24-seed figure above is a little pessimistic by sampling noise rather than by design.

With endgame gear, high renown upgrades, 20 Greater Healings and a route that skips routine urns, the prepared bot reached depth 6 in **24/24** runs. It extracted in 16/24, but killed the Ashen King in **0/24**: reaching the floor is not winning the final encounter. A separate boss-seeking check reached depth 6 in 24/24 runs with 12 Greater Healings and killed him in none. With an extreme 60-bottle supply, it killed him in 8/16 and extracted in 3/16. That last loadout has 4,200g of base item value and is a stress test, not a plausible repeatable budget.

The bot does not dodge telegraphs, plan town visits, price repairs or restocking, or earn its starting endgame gear and upgrades over connected runs. It therefore establishes that a well-stocked character **can enter depth 6** and that the King **can be beaten**, but does not establish whether normal play reaches that loadout by the twentieth run or whether the final fight feels fair. The two Hollow Knight guards and the supply cost across depth 6 deserve particular attention in a human session.

Validation on the final code: `npm test` passes **330/330**, `npm run build` passes, `npm run playtest` completes with no timeouts, and `git diff --check` is clean. The build reports Vite's existing large-chunk advisory.
