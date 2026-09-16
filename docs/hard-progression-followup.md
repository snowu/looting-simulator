# Hard progression follow-up

The baseline is in [the original audit](hard-progression-audit.md). This comparison uses the same 2,400 generated floors (200 seeds × six depths × two Find settings).

## Changes

- Empty gem pools now yield no gem, including salvage. No full-catalog fallback. Found gear records its source depth so its random +0–2 item levels cannot advance salvage catalysts into the next floor's band. Older gear without source depth uses a conservative `(ilvl - 2) / 2` estimate, with a floor of 1.
- Authored monster gems obey the same gates: premature Frost Shards, Sunstones, Wardstones, Flame Shards and Shadow Essence become Crystal Shards at depths 2+; at depth 1 they are deferred. Drop chance and quantity stay authored. These safety fixes apply to both difficulties.
- Hard vaults/secrets still guarantee gear. The first piece rolls a minimum rarity bonus before its natural rarity roll:

| Depth | Common minimum | Uncommon minimum | Rare minimum |
| --- | ---: | ---: | ---: |
| 1 | 80% | 20% | 0% |
| 2 | 65% | 35% | 0% |
| 3 | 50% | 35% | 15% |
| 4 | 35% | 35% | 30% |
| 5 | 20% | 35% | 45% |
| 6 | 5% | 35% | 60% |

The 25% second-gear chance uses natural rarity on Hard. Normal retains both previous minimum-rarity rules. Find still affects natural rarity. Boss guarantees remain unchanged.

- Appraiser-identified Uncommon/Rare weapons retain salvage mastery, including after saving. Naturally identified Commons, manually identified weapons, crafted weapons and non-weapons do not gain new eligibility. Existing saves lack identification provenance, so previously identified weapons cannot be retroactively classified. The upgrade text and salvage tooltip explain eligibility.
- Blueprint probabilities, secret blueprint guarantee, mastery thresholds, crafting strength, generic material gates and merchant schedules are unchanged.

## Allowed early structural exceptions

All authored non-gem drops remain intact in this pass. The currently observed exceptions are:

| Enemy | Material | Early depths | Generic gate |
| --- | --- | --- | --- |
| Bat | Leather | 1 | 2 |
| Skeleton | Iron | 1 | 2 |
| Tunnel Stalker | Spider Silk | 2–3 | 4 |
| Cave Spider | Spider Silk | 3 | 4 |

## Interpretation and limits

At zero Find, depth-1/2 Uncommon shares fall from 82.3%/83.4% to 26.5%/40.0%. Rare goes from 14.0% at depth 3 to 21.0% at depth 4 and 26.8% at depth 5, replacing the 7.9% → 59.8% cliff. No premature gems remain in this sample; remaining early materials are the structural exceptions above.

The lower enchanted-gear share also reduces unidentified weapon supply: depth 1 falls from 0.58 to 0.23 per clear, depth 3 from 0.96 to 0.49. Blueprint supply remains about 2–4.4 per floor, with sampling differences because changed loot rolls advance the random stream differently. No compensating mastery or blueprint buff is included. This is a deliberate first comparison; mastery timing still needs multi-day playtesting. The full-clear sample does not model deaths, carrying capacity, identification choices or purchases.

## Validation

Regression coverage includes empty pools, maximum item-level salvage rolls, authored elemental substitutions, retained structural drops, Appraiser serialization/manual identification, early Common availability and the Rare ramp. Historical loot hashes remain intact; a separate progression hash pins the intentional new distribution.

Run `npm test`, `npm run build`, and `npx vitest run --config vitest.playtest.config.ts scripts/progression.bench.ts`.

---

# Hard loot progression sample

200 generated floors per depth and Find setting. Every non-mimic container and initial enemy is looted; loose pickups included. Fresh recipe/unique history; boss rewards included at depth 6. Full-clear supply, before backpack limits, deaths, identification costs or crafting choices.

## Find 0

| Depth | Gear/floor | Common | Uncommon | Rare | Epic | Legendary | Mean material tier | BP/floor | Unidentified weapons/floor | Early materials/floor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3.04 | 73.5% | 26.5% | 0.0% | 0.0% | 0.0% | 1.00 | 2.02 | 0.23 | 1.04 |
| 2 | 3.00 | 60.0% | 40.0% | 0.0% | 0.0% | 0.0% | 1.51 | 2.29 | 0.38 | 0.20 |
| 3 | 3.46 | 51.7% | 34.3% | 14.0% | 0.0% | 0.0% | 1.76 | 2.73 | 0.49 | 0.99 |
| 4 | 3.74 | 43.9% | 35.2% | 21.0% | 0.0% | 0.0% | 2.28 | 3.01 | 0.84 | 0.00 |
| 5 | 4.00 | 38.0% | 32.4% | 26.8% | 2.9% | 0.0% | 2.58 | 3.42 | 0.97 | 0.00 |
| 6 | 6.55 | 25.3% | 20.3% | 22.0% | 16.7% | 15.7% | 2.99 | 4.39 | 1.66 | 0.00 |

## Find 60

| Depth | Gear/floor | Common | Uncommon | Rare | Epic | Legendary | Mean material tier | BP/floor | Unidentified weapons/floor | Early materials/floor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3.19 | 56.8% | 43.2% | 0.0% | 0.0% | 0.0% | 1.00 | 2.04 | 0.41 | 1.13 |
| 2 | 3.44 | 45.2% | 54.8% | 0.0% | 0.0% | 0.0% | 1.51 | 2.23 | 0.54 | 0.23 |
| 3 | 4.05 | 34.6% | 47.3% | 18.0% | 0.0% | 0.0% | 1.75 | 2.81 | 0.90 | 1.54 |
| 4 | 4.21 | 29.5% | 46.5% | 24.0% | 0.0% | 0.0% | 2.29 | 2.97 | 1.21 | 0.00 |
| 5 | 4.83 | 28.2% | 39.2% | 28.8% | 3.8% | 0.0% | 2.58 | 3.38 | 1.38 | 0.00 |
| 6 | 8.02 | 18.3% | 28.7% | 23.8% | 15.6% | 13.5% | 2.96 | 4.34 | 2.56 | 0.00 |

## Materials arriving before their generic depth gate (Find 0)

| Source | Units per floor |
| --- | ---: |
| D1 bat: leather | 0.330 |
| D1 skeleton: iron | 0.715 |
| D2 tunnel_stalker: spider_silk | 0.205 |
| D3 spider: spider_silk | 0.870 |
| D3 tunnel_stalker: spider_silk | 0.125 |

## Controlled craft comparison

Same dagger base and iron primary, timber grip; median preview quality. Attack includes physical attack only. Flame Shard is a tier-4 catalyst; this illustrates what an early catalyst can enable, not how often the whole recipe is affordable.

| Smith level | Recipe rank | Catalyst | Rarity | Item level | Attack | Fire | Affixes |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 0 | 1 | none | Common | 4 | 8 | 0 | 0 |
| 0 | 1 | flame_shard | Uncommon | 8 | 8 | 15 | 1 |
| 0 | 5 | none | Common | 4 | 11 | 0 | 0 |
| 0 | 5 | flame_shard | Uncommon | 8 | 11 | 15 | 1 |
| 3 | 1 | none | Uncommon | 4 | 10 | 0 | 1 |
| 3 | 1 | flame_shard | Rare | 8 | 10 | 15 | 2 |
| 3 | 5 | none | Uncommon | 4 | 13 | 0 | 1 |
| 3 | 5 | flame_shard | Rare | 8 | 13 | 15 | 2 |
