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

Validation on the final code: `npm test` passes **309/309**, `npm run build` passes, `npm run playtest` completes with no timeouts, and `git diff --check` is clean. The build reports Vite's existing large-chunk advisory.
