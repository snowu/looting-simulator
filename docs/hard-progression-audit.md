# Hard-mode progression audit

## Assessment

The current curve is uneven, rather than uniformly too fast. Early special-container gear skips most of the Common phase; depth 4 makes Rare the majority of full-clear gear. Late material progression is still restrained. The highest-priority correction is premature catalyst access, which can multiply early crafted damage without requiring high mastery.

No gameplay constants were changed during this audit.

## Findings, in priority order

1. **Depth-1 gem fallback bypasses every material gate.** `rollGem` uses the entire gem catalog when its eligible pool is empty. All gems start at tier 2 or higher, so this happens on depth 1. Secret/vault guaranteed gems and chest gem rolls can consequently produce Flame Shards and Shadow Essence before their intended depth-5 gate. The sample contains 0.14 tier-4 catalysts per fully looted depth-1 floor. These are rare individual drops but a major jackpot for an early character. A median iron dagger with a Flame Shard has 8 physical attack plus 15 fire, versus 8 physical without the catalyst, before enemy mitigation. This does not require recipe mastery or Master Smith.
2. **Authored monster materials bypass generic depth gates.** Examples include iron from depth-1 skeletons, leather from depth-1 bats, spider silk from depth-2 tunnel stalkers, and Flame Shards from depth-3 elemental enemies. Some early structural drops may be intentional rewards; high-tier elemental catalysts deserve stricter treatment because their guaranteed affix and catalyst bonus are immediately usable. This is separate from the empty-pool bug.
3. **Guaranteed container rarity dominates the effective curve.** On fully cleared floors with zero Find, Uncommon is 82–83% of depth-1/2 gear. Rare goes from 7.9% on depth 3 to 59.8% on depth 4. Secret/vault first pieces have a minimum rarity of Uncommon, switching to Rare at depth 4; natural rarity weights alone do not describe what players receive. This makes craft rarity less distinctive during early growth, though rarity alone is not a complete measure of strength.
4. **Appraiser II conflicts with salvage mastery.** The upgrade makes Common/Uncommon/Rare drops identified; salvage mastery requires an unidentified weapon. Before Epic unlocks at depth 5, buying Appraiser II therefore removes this mastery source from ordinary gear drops. The player pays renown for identification convenience and silently loses a progression avenue. Preserve the intended decision about manually identifying loot, but track automatic identification separately if that upgrade is to remain a benefit.
5. **Late structural quality is not flooding the game.** Average dropped-equipment material tiers are 1.00 / 1.56 / 1.70 / 2.26 / 2.56 / 2.98 across depths 1–6 at zero Find. Only 2.9% of depth-5 gear is Epic. Depth-6 rarity includes the guaranteed boss Legendary and Epic-or-better rewards, so its displayed 15% Legendary share must not be read as the ordinary-drop rate. Day/depth-gated merchant shipments remain slow supplements.
6. **The new mastery supply is not obviously excessive.** Full-clear unidentified melee/thrown weapons average 0.58–2.06 per floor at zero Find, spread across multiple recipes. A starter recipe needs 26 matching salvages to reach rank 5 without blueprints. Blueprint supply averages about 2–4.3 per floor, also spread across recipes. This does not demonstrate a rush to rank 5. Master Smith III costs 28 total renown and combines +18% quality with an extra affix; with rank 5, median positive core stats are about 65% above a smith-0/rank-1 craft of the same materials. That ceiling is meaningful but should not be judged as day-one power.

## Recommended tuning order

- Fix empty gem pools first: use a depth-appropriate non-gem reward or defer the gem; never widen to the entire catalog.
- Make an explicit table of allowed early monster-material exceptions. Gate or substitute premature high-tier catalysts while retaining thematic elemental rewards.
- Smooth Hard's special-container rarity: keep guaranteed gear, but make early Uncommon and depth-4 Rare upgrades chances rather than universal floors. Measure proposed probabilities against this baseline before choosing them. Preserve the secret blueprint guarantee.
- Resolve Appraiser II's salvage interaction before using mastery timing as a balance target.
- Keep blueprint rates, exact salvage thresholds, late material scarcity, and the conservative merchant schedule unchanged for the first comparison.

These changes would target the actual early power shortcuts without making all progression slower. A multi-day policy simulation or player testing is still required to establish time-to-rank-5 and build-specific combat pacing: a full-clear loot sample does not model deaths, backpack choices, identification spending, purchases, or which weapon a player chooses to master.

## Reproduce

`npx vitest run --config vitest.playtest.config.ts scripts/progression.bench.ts`

The script writes `/tmp/hard-progression-report.md`. The raw results below are from the current crafting branch, with 200 seeds at each of six depths for both 0 and 60 Find (2,400 generated floors total).

---

# Hard loot progression sample

200 generated floors per depth and Find setting. Every non-mimic container and initial enemy is looted; loose pickups included. Fresh recipe/unique history; boss rewards included at depth 6. Full-clear supply, before backpack limits, deaths, identification costs or crafting choices.

## Find 0

| Depth | Gear/floor | Common | Uncommon | Rare | Epic | Legendary | Mean material tier | BP/floor | Unidentified weapons/floor | Early materials/floor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2.94 | 17.7% | 82.3% | 0.0% | 0.0% | 0.0% | 1.00 | 1.98 | 0.58 | 3.02 |
| 2 | 3.04 | 16.6% | 83.4% | 0.0% | 0.0% | 0.0% | 1.56 | 2.31 | 0.83 | 0.18 |
| 3 | 3.50 | 17.7% | 74.4% | 7.9% | 0.0% | 0.0% | 1.70 | 2.62 | 0.96 | 2.25 |
| 4 | 3.71 | 20.6% | 19.5% | 59.8% | 0.0% | 0.0% | 2.26 | 2.94 | 1.13 | 1.05 |
| 5 | 3.94 | 22.3% | 19.1% | 55.6% | 2.9% | 0.0% | 2.56 | 3.44 | 1.19 | 0.00 |
| 6 | 6.70 | 19.8% | 15.4% | 33.4% | 16.4% | 15.0% | 2.98 | 4.29 | 2.06 | 0.00 |

## Find 60

| Depth | Gear/floor | Common | Uncommon | Rare | Epic | Legendary | Mean material tier | BP/floor | Unidentified weapons/floor | Early materials/floor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3.24 | 19.8% | 80.2% | 0.0% | 0.0% | 0.0% | 1.00 | 1.95 | 0.63 | 3.41 |
| 2 | 3.44 | 15.7% | 84.3% | 0.0% | 0.0% | 0.0% | 1.54 | 2.17 | 0.97 | 0.21 |
| 3 | 4.04 | 16.6% | 71.3% | 12.1% | 0.0% | 0.0% | 1.71 | 2.73 | 1.20 | 3.13 |
| 4 | 4.32 | 19.0% | 27.7% | 53.3% | 0.0% | 0.0% | 2.27 | 3.00 | 1.37 | 1.41 |
| 5 | 4.83 | 20.8% | 26.7% | 49.0% | 3.5% | 0.0% | 2.61 | 3.42 | 1.49 | 0.00 |
| 6 | 7.96 | 16.1% | 23.6% | 31.1% | 16.1% | 13.1% | 2.96 | 4.38 | 2.65 | 0.00 |

## Materials arriving before their generic depth gate (Find 0)

| Source | Units per floor |
| --- | ---: |
| D1 bat: leather | 0.365 |
| D1 chest: crystal | 0.075 |
| D1 chest: emerald | 0.020 |
| D1 chest: frost_shard | 0.015 |
| D1 chest: jade | 0.060 |
| D1 chest: shadow_essence | 0.015 |
| D1 chest: sunstone | 0.010 |
| D1 chest: wardstone | 0.020 |
| D1 secret: crystal | 0.245 |
| D1 secret: emerald | 0.110 |
| D1 secret: flame_shard | 0.025 |
| D1 secret: frost_shard | 0.110 |
| D1 secret: jade | 0.280 |
| D1 secret: moonstone | 0.065 |
| D1 secret: shadow_essence | 0.045 |
| D1 secret: sunstone | 0.110 |
| D1 secret: wardstone | 0.070 |
| D1 skeleton: iron | 0.560 |
| D1 vault: crystal | 0.265 |
| D1 vault: emerald | 0.080 |
| D1 vault: flame_shard | 0.030 |
| D1 vault: frost_shard | 0.035 |
| D1 vault: jade | 0.175 |
| D1 vault: moonstone | 0.085 |
| D1 vault: shadow_essence | 0.025 |
| D1 vault: sunstone | 0.075 |
| D1 vault: wardstone | 0.045 |
| D2 tunnel_stalker: spider_silk | 0.185 |
| D3 bat_frost: frost_shard | 0.045 |
| D3 cinder_raider: flame_shard | 0.120 |
| D3 elemental_frost: frost_shard | 0.075 |
| D3 ember_wisp: flame_shard | 0.200 |
| D3 ember_wisp: sunstone | 0.045 |
| D3 ghoul_ember: flame_shard | 0.035 |
| D3 ghoul_frost: frost_shard | 0.080 |
| D3 goblin_shield_frost: frost_shard | 0.070 |
| D3 icebound_guard: frost_shard | 0.150 |
| D3 skeleton_ember: flame_shard | 0.175 |
| D3 skeleton_frost: frost_shard | 0.100 |
| D3 skeleton_shield_ember: flame_shard | 0.040 |
| D3 spider: spider_silk | 0.895 |
| D3 spider_ember: flame_shard | 0.110 |
| D3 tunnel_stalker: spider_silk | 0.105 |
| D4 cinder_raider: flame_shard | 0.125 |
| D4 elemental_shadow: shadow_essence | 0.010 |
| D4 ember_wisp: flame_shard | 0.430 |
| D4 ghoul_ember: flame_shard | 0.090 |
| D4 skeleton_ember: flame_shard | 0.160 |
| D4 skeleton_shield_ember: flame_shard | 0.100 |
| D4 spider_ember: flame_shard | 0.135 |

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
