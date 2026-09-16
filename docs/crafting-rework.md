# Crafting progression rework

## Blueprint supply

Every drop is a single blueprint. Secret chests guarantee one. Other sources distribute extra plans across the floor:

| Source | Depth 1 | Depth 6 |
| --- | ---: | ---: |
| Urn | 2.5% | 5% |
| Chest | 14% | 24% |
| Vault | 38% | 53% |
| Secret chest | 100% | 100% |
| Enemy bonus roll | 1.2% | 3.2% |

The boss keeps its existing guaranteed plan and can still get its ordinary bonus roll. Blueprint chances do not multiply with Find or difficulty.

Plans cannot arrive before their base weapon/armour's minimum depth. The rolling window retires plans three floors after their debut: dagger plans appear on depths 1–3, never on 4–6. The endgame retains depth-4-and-later plans. This also applies to the merchant's two blueprint wares, whose pool follows best depth. Early recipes remain improvable by revisiting early floors or salvaging their weapons.

The old exponential gear-ladder scarcity is softened by its square root (1 / 0.4 / 0.16 becomes 1 / 0.63 / 0.4). Weapon and thrown-weapon plans gain a depth weight from 1× to 2.5×. Unknown recipes retain their 3× preference. Uncapped recipes take priority over distinct copies in a multi-plan roll. If every eligible plan is capped, the guaranteed reward remains a sellable spare.

## Salvage mastery

Salvaging a found, unidentified melee or thrown weapon advances its matching recipe while returning the usual materials. Identified equipment, crafted equipment and armour do not award mastery. The forge displays partial progress and reports it after each salvage.

| Current rank | Salvages to next rank | Progress per salvage |
| --- | ---: | ---: |
| Locked (0) | 4 | 25% |
| 1 | 5 | 20% |
| 2 | 6 | 16⅔% |
| 3 | 7 | 14²⁄₇% |
| 4 | 8 | 12.5% |

Counts use integers, so the sixth or seventh salvage always completes the rank. A starter weapon needs 26 salvages to go from rank 1 to 5; a locked weapon needs 30 to unlock and reach 5 without any blueprints. Blueprints retain their existing costs (1 to unlock, then 2/3/4/5). Partial salvage counts survive a blueprint upgrade and contribute toward the new target; completing a rank through salvage resets its count. Rank-5 weapons give materials only. Crafted items retain the rank at which they were forged.

Save revision 19 adds the per-recipe salvage counts without changing the save format family or resetting existing mastery. Existing commodity repair on load registers new materials.

## Materials and merchant pacing

The audit found complete metal progression but missing tiers in every other structural category. Added:

- Wood: Deep Yew (4), Starwood (5).
- Hide: Troll Hide (3).
- Cloth: Wool (2), Astral Silk (5).
- Bone: Dense Bone (2), Fossil Bone (3), Wyrm Bone (4), Titan Bone (5).

They use existing category art and participate in generic material drops, equipment material rolls, salvage, crafting and commodity trade. Existing authored enemy drops are unchanged. Material depth gates remain 1/2/4/5/6 for tiers 1–5. Prices and material bonuses follow neighboring tiers; recipe quantities, mastery stat bonuses and catalyst power are unchanged. This supplies growth paths without also discounting every craft or raising mastery power.

Late structural stock is deliberately slow and deterministic in both modes, including Hard:

| Tier | Required depth | First shipment | Cadence | Shelf cap |
| --- | ---: | ---: | --- | --- |
| 4 | 5 | Day 6 | One unit every 3 days | 1; increases to 2 on day 12 |
| 5 | 6 | Day 18 | One unit every 6 days | 1; increases to 2 on day 30 |

These are scheduled market days, not days since unlocking the depth. Unsold stock stays on the shelf; selling to the merchant never destroys excess stock. Gems and valuables keep their existing stock rules. Prices are unchanged. A game day advances only when a completed delve reached beyond depth 1. For example, buying every available Star Iron shipment on days 18, 24 and 30 supplies only three units over that span. Deep loot remains the main source for expensive multi-unit recipes.

## Verification

- Behavioral tests cover exact mastery thresholds, invalid salvage sources, rank cap, old-save migration and progress persistence, depth bands, single-copy drops, drop-rate samples, all material tiers, and day/depth-gated restocking.
- Historical golden fixtures are retained; new crafting hashes pin intentional loot and embedded floor-material changes, and a new health sample pins equipment rolls containing the expanded material pool.
- `npx vitest run --config vitest.playtest.config.ts scripts/crafting.bench.ts` reproduces the 1,200-floor full-clear blueprint sample and writes `/tmp/crafting-loot-report.md`.
- The existing combat playtest was run with eight seeds per profile. It does not simulate town purchases, crafting decisions or mastery progression; it cannot prove a calendar-length progression target.

# Crafting loot sample

200 seeds per depth, Hard, zero Find, all non-mimic containers opened and all initial enemies defeated. These are full-clear yields, not promised take-home loot.

| Depth | Container BP | Mob/boss BP | Total BP |
| --- | ---: | ---: | ---: |
| 1 | 1.88 | 0.10 | 1.98 |
| 2 | 2.17 | 0.13 | 2.31 |
| 3 | 2.35 | 0.26 | 2.62 |
| 4 | 2.56 | 0.39 | 2.94 |
| 5 | 3.02 | 0.43 | 3.44 |
| 6 | 2.68 | 1.61 | 4.29 |
