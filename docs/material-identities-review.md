# Material identities and balance review — 2026-09-16

Reviewed the latest merged PRs: [#14 crafting progression](https://github.com/snowu/looting-simulator/pull/14), merged 01:00 UTC, and [#15 catalyst/progression gates](https://github.com/snowu/looting-simulator/pull/15), merged 01:24 UTC. Baseline: `1133b42`.

## Consistent structural ladders

Market rows sort by rarity, then tier and base value. Every structural family uses white / green / blue / purple / gold for tiers 1 / 2 / 3 / 4 / 5. Equipment rarity remains its own affix-quality system: a green material does not automatically produce green equipment.

| Family | Identity | T1 | T2 | T3 | T4 | T5 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Metal | Defense | 1 | 2 | 4 | 7 | 12 |
| Wood | Speed | 1 | 2 | 4 | 7 | 10 |
| Hide | Health | 3 | 6 | 12 | 24 | 40 |
| Cloth | Stamina | 3 | 6 | 10 | 18 | 30 |
| Bone | Attack | 1 | 3 | 6 | 12 | 20 |

The upper tiers grow faster so scarce materials deliver a substantial upgrade. Titan Bone adds +20 Attack rather than +5. With Iron primary, no catalyst, smith level 0 and recipe rank 1, the dagger preview is **8 Attack with Timber / 9 with Bone / 11 with Dense Bone / 14 with Fossil Bone / 20 with Wyrm Bone / 28 with Titan Bone**. No mastery is required for the material payoff.

These are flat bonuses per selected material slot, identical in primary and secondary roles. Primary tier still scales the equipment base. Secondary bonuses no longer add a second hidden category bonus. Mastery scales positive base stats, not these flat bonuses. Market headings and material tooltips expose the family role.

Silver and Gold remain tier-3 metals with +4 Defense. Silver also grants +3 Holy; Gold has greater trade value. This preserves material IDs and gives Silver a combat identity alongside Gold’s trade role.

Special materials keep their elemental identity on top of the family bonus:

| Material | Family bonus | Elemental bonus |
| --- | --- | --- |
| Silver | +4 Defense | +3 Holy |
| Moonsilver | +7 Defense | +6 Frost |
| Star Iron | +12 Defense | +10 Shadow |
| Dragon Scale | +40 Health | +10 Fire |
| Shadow Silk | +18 Stamina | +7 Shadow |

Both bonuses apply once per material slot and stack with catalysts and affixes, including matching elements. Material tooltips and forge previews list both. Other off-family bonuses (luck, Find, focus, etc.) remain removed. Existing equipment references material IDs, so its stats update on load too; no item or recipe is removed.

## Supply and progression

Changing Iron from white to green must not multiply its scarcity by 0.35. Structural rolls now use shared tier weights **1 / 1 / 0.35 / 0.042875 / 0.01500625**, followed by the existing tier-distance weighting. Gems retain rarity-based weights. This normalizes families while preserving Iron's supply and the old tier-4/5 scarcity factors.

Structural merchant targets are **40 / 40 / 14** for tiers 1–3, subject to depth gates. Tier 4 still requires depth 5 and day 6, ships one every three days, and caps at one/two from days 6/12. Tier 5 still requires depth 6 and day 18, ships one every six days, and caps at one/two from days 18/30. Prices retain their existing values and market formulas; higher corrected rarity also affects existing price volatility and transaction impact formulas.

Generic material gates remain depths **1 / 2 / 4 / 5 / 6**. Authored early Iron, Leather and Spider Silk exceptions are retained. The same 2,400-floor sample reproduces the previous gear-rarity, blueprint and catalyst yields; only structural material choices change. Mean equipped material tier at zero Find changes **1.00→1.00 / 1.51→1.53 / 1.76→1.78 / 2.28→2.37 / 2.58→2.63 / 2.99→3.00** across depths 1–6.

## Catalysts and recipes

No premature catalyst appeared in 2,400 sampled Hard floors. Tier-2 catalysts begin at depth 2, tier 3 at depth 4, tier 4 at depth 5. Zero-Find direct supply per full clear is **0 / 2.18 / 4.14 / 6.40 / 8.86 / 8.63** (approximate totals summed from the rounded tier columns). These counts exclude salvage and merchant purchases. Full clears also ignore deaths and carrying limits.

Vaults/secrets guarantee a gem only when an eligible pool exists; ordinary chests roll 10% times the Find factor. Enchanted salvage rolls 20/40/60/80% by gear rarity, then uses its source floor's eligible pool. Premature authored enemy gems become Crystal from depth 2 and are deferred at depth 1. Regression tests cover these gates, including Normal; the large sample is Hard-only.

All 28 recipes retain quantities and have structural choices at every tier. Most require one optional catalyst; Pendant requires one gem and debuts at depth 2, when gems become obtainable. A dagger costs 2 metal + 1 grip, a greatsword 7 metal + 2 grip, and plate 9 metal + 3 hide. Merchant-only tier-5 primary supply therefore takes until day **24 / 54 / 66**, respectively, if every shipment is bought starting day 18. Exploration and salvage remain necessary for faster late crafting.

Blueprint costs remain 1/2/3/4/5: **15 matching plans** from locked to rank 5, or **14** from starter rank 1. Salvage-only equivalents are **30 / 26 matching eligible weapons**. Bonuses remain **0/8/16/26/40%** at ranks 1–5. The sample yields **2.02 / 2.29 / 2.73 / 3.01 / 3.42 / 4.39** total plans per clear but only **0.23 / 0.38 / 0.49 / 0.84 / 0.97 / 1.66** unidentified weapons across all recipes. Early plans also retire three floors after debut, so continued early-recipe mastery requires revisiting those depths or matching salvage.

Assessment: catalysts are available once gated; matching-plan dilution and eligible-weapon supply are the more plausible mastery bottlenecks. These samples do not establish days to rank 5. No speculative blueprint, mastery or recipe-cost buff is included.

## Combat impact and limits

Same eight seeds per profile, comparing merged PR #15 against stronger late-tier family bonuses plus restored material elements, using the existing combat bot:

| Profile | Mean depth before → after | Extracted before → after |
| --- | --- | --- |
| Fresh, 35% parry | 1.63 → 1.63 | 2/8 → 1/8 |
| Fresh, no parry | 1.25 → 1.25 | 2/8 → 1/8 |
| Iron Rare, reckless | 3.00 → 3.00 | 4/8 → 3/8 |
| Iron Rare, careful | 3.00 → 3.25 | 6/8 → 5/8 |
| Moonsilver Epic, reckless | 4.13 → 4.38 | 7/8 → 4/8 |
| Moonsilver Epic, careful | 4.00 → 4.50 | 4/8 → 6/8 |
| Prepared deep expedition | 6.00 → 5.88 | 5/8 → 4/8 |

Neither version killed the King in this sample. Material elements remain available alongside the family bonuses. These small samples still show different survival outcomes and are not evidence of equivalent difficulty. The bot uses fixed old loadouts and does not optimize new material/catalyst choices or simulate town crafting. Larger samples with adapted builds and multi-day mastery remain needed before claiming endgame balance is settled.

The independent six-seed D4 economy regression measured 609.83 kept item value during the identity pass; its upper guard moves from 600 to 700 while depth, gold, kills, extraction and timeout guards stay intact. Historical golden fixtures remain unchanged, with separate material-identity hashes and player-health values pinning the new behavior.

## Validation

- 552 tests across 49 files pass; production build and diff checks pass (existing bundle-size warning).
- 2,400-floor progression sample passes, now asserting every sampled catalyst's depth gate.
- 56 combat runs per version complete without timeouts; results above describe limitations rather than treating benchmark completion as a balance guarantee.
- Browser inspection confirms all five structural families follow the requested color order; market and forge use the same family bonuses.
- Static balance tables regenerated. Patch checker succeeds with the existing uncurated auto-reload commit `9a64d47` warning.

Reproduce: `npm test`, `npm run build`, `npm run tables`, `npx vitest run --config vitest.playtest.config.ts scripts/progression.bench.ts`, and `PLAYTEST_RUNS=8 PLAYTEST_OUT=/tmp/materials-combat.txt npm run playtest`.

---

# Hard loot progression sample

200 generated floors per depth and Find setting. Every non-mimic container and initial enemy is looted; loose pickups included. Fresh recipe/unique history; boss rewards included at depth 6. Full-clear supply, before backpack limits, deaths, identification costs or crafting choices.

## Find 0

| Depth | Gear/floor | Common | Uncommon | Rare | Epic | Legendary | Mean material tier | BP/floor | Unidentified weapons/floor | Early materials/floor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3.04 | 73.5% | 26.5% | 0.0% | 0.0% | 0.0% | 1.00 | 2.02 | 0.23 | 1.04 |
| 2 | 3.00 | 60.0% | 40.0% | 0.0% | 0.0% | 0.0% | 1.53 | 2.29 | 0.38 | 0.20 |
| 3 | 3.46 | 51.7% | 34.3% | 14.0% | 0.0% | 0.0% | 1.78 | 2.73 | 0.49 | 0.99 |
| 4 | 3.74 | 43.9% | 35.2% | 21.0% | 0.0% | 0.0% | 2.37 | 3.01 | 0.84 | 0.00 |
| 5 | 4.00 | 38.0% | 32.4% | 26.8% | 2.9% | 0.0% | 2.63 | 3.42 | 0.97 | 0.00 |
| 6 | 6.55 | 25.3% | 20.3% | 22.0% | 16.7% | 15.7% | 3.00 | 4.39 | 1.66 | 0.00 |

## Find 60

| Depth | Gear/floor | Common | Uncommon | Rare | Epic | Legendary | Mean material tier | BP/floor | Unidentified weapons/floor | Early materials/floor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3.19 | 56.8% | 43.2% | 0.0% | 0.0% | 0.0% | 1.00 | 2.04 | 0.41 | 1.13 |
| 2 | 3.44 | 45.2% | 54.8% | 0.0% | 0.0% | 0.0% | 1.53 | 2.23 | 0.54 | 0.23 |
| 3 | 4.05 | 34.6% | 47.3% | 18.0% | 0.0% | 0.0% | 1.77 | 2.81 | 0.90 | 1.54 |
| 4 | 4.21 | 29.5% | 46.5% | 24.0% | 0.0% | 0.0% | 2.37 | 2.97 | 1.21 | 0.00 |
| 5 | 4.83 | 28.2% | 39.2% | 28.8% | 3.8% | 0.0% | 2.61 | 3.38 | 1.38 | 0.00 |
| 6 | 8.02 | 18.3% | 28.7% | 23.8% | 15.6% | 13.5% | 2.97 | 4.34 | 2.56 | 0.00 |

## Direct catalyst supply

Units per full clear, excluding salvage and merchant purchases. Tier 2 unlocks at depth 2, tier 3 at depth 4, tier 4 at depth 5. Every sampled gem is checked against its depth gate.

| Find | Depth | Tier 2 | Tier 3 | Tier 4 |
| --- | ---: | ---: | ---: | ---: |
| 0 | 1 | 0.00 | 0.00 | 0.00 |
| 0 | 2 | 2.18 | 0.00 | 0.00 |
| 0 | 3 | 4.14 | 0.00 | 0.00 |
| 0 | 4 | 3.85 | 2.55 | 0.00 |
| 0 | 5 | 3.52 | 3.16 | 2.18 |
| 0 | 6 | 2.63 | 3.37 | 2.63 |
| 60 | 1 | 0.00 | 0.00 | 0.00 |
| 60 | 2 | 2.35 | 0.00 | 0.00 |
| 60 | 3 | 4.74 | 0.00 | 0.00 |
| 60 | 4 | 4.75 | 2.99 | 0.00 |
| 60 | 5 | 4.04 | 3.88 | 2.75 |
| 60 | 6 | 3.19 | 3.97 | 2.99 |

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
