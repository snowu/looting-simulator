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

The stock is finite, filled once when you first carry a belt into a delve, and nothing refills it. Spent shafts land where they stop — in the thing you hit, not in front of it — and stay on that floor across a trip upstairs and back. Walk over one to collect it, or press **R** to call them all back: **one every three quarters of a second**, paying stamina and a point of belt wear for each as it arrives. A blow stops them coming, and you keep what already got home.

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
