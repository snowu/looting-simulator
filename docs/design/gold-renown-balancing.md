# Gold vs Renown balancing — sinks, durability, paid healing, altars

*Design spec. Companion to [MECHANICS.md](../MECHANICS.md).*

> **Implemented** on branch `gold_reward_heal_blessing_curses` (see MECHANICS
> §§5–7 for the landed numbers): durability wears 2/hit with whiff tax and
> 0.5×+tier-floor repairs, broken at 15% stats; physicker heal button in the
> market (`src/systems/heal.ts`); shrine base 55% + pity (≥1 in 1–3, ≥2 in
> 4–6); stronger blessings/curses incl. Vitality and Brittle; chest/urn/loose
> gold trimmed ~20–25% (vaults/secrets untouched).

All numbers below are measured against the real formulas in `src/`,
not invented. Goal: fix "gold income way too high, not enough gold sinks"
without breaking renown progression, and make altars/healing matter more.

## 1. Current state (measured)

### 1.1 Gold income

Per `balance-tables.txt:116-121` (find=0, avg over 60 seeds, raw floor gold
before selling anything):

| Floor | Raw gold |
|---|---|
| D1 | ~140 |
| D2 | ~286 |
| D3 | ~464 |
| D4 | ~679 |
| D5 | ~906 |
| D6 | ~1270 |

Sources (`src/systems/dungeon.ts:903-910`, `src/systems/items.ts:705-793`,
`src/data/enemies.ts`, `src/systems/market.ts:212-276`, `src/systems/contracts.ts:73-88`):

- Loose pickups: `1+ceil(depth/2)` spots, 55% gold `int(2,5)*depth`.
- Containers: urn `30%: int(2,6+depth*3)`; chest `int(10,22)*depth`;
  vault/secret `int(40,75)*depth` + gear + valuable + gem. Multiplied by
  `diff.gold` (Normal `1.2`, Hard `1.0` — `src/data/difficulty.ts:98`).
- Enemy drops: e.g. goblin `[3,12]`, ghoul `[5,20]`, hollow_knight `[10,40]`,
  ashen_king `[150,300]` + star_iron/shadow_essence/jeweled_skull.
- Selling: materials at face with slippage + supply depression; gear at
  `itemValue * sentiment * wear * (0.5+0.04*haggle)` (`0.45x` if unidentified).
  `itemValue` (`src/systems/items.ts:435-459`): `base.value*(1+(tier-1)*0.9) +
  mat.value*1.5 + affixes*4`, `x2.2` unique, `x[1,1.35,1.9,2.8,4.5]` rarity.
  D6 `value=15193` per floor in tables — most of it sellable.
- Contracts: deliver `mat.value*qty*1.5`; gear `60+90*order²+depth*20`;
  slay `(hp*0.9+8)*count`; delve `80*d`.

Banking (`src/systems/run.ts:27-35,85-103`): all carried gold banked on
extract; `20%*pouchLevel` on death; town portal banks immediately.

### 1.2 Gold sinks (the whole list)

Crafting is materials-only (`src/systems/crafting.ts:99-108`). The only
things that cost gold today:

- Repairs: `ceil(itemValue*0.3*(1-frac))` (`src/systems/items.ts:330-334`).
- Buy commodities / merchant wares / supplies
  (`src/systems/market.ts:212-257,286`): e.g. draught ~29g, greater ~84g,
  recall ~114g at haggle 0.
- Identify: `max(5,(10+value*0.12)*(1-0.4*appraiser))` or scroll
  (`src/systems/items.ts:475-477`).
- Coffer shrine: `30+25*depth` (`src/world/world.ts:2057-2060`) — d1 55g,
  d6 180g. Skipped if unaffordable, i.e. capped by design.

Result: a D4–D6 run banks ~700–1300g raw plus sales, while a full repair
after a normal run is typically tens of gold (see §2). Surplus accumulates
with nothing to spend it on.

### 1.3 Renown income (for contrast)

`renownForRun` (`src/systems/meta.ts:82-85`):

- Death: `max(0,depthReached-1)` (D1 death = 0, D4 death = 3).
- Extract: `0` if depth ≤ 1, else `2+depth*2` (D2 = 6, D6 = 14) `+25` on boss
  kill (D6+boss = 39).
- Contracts: deliver `1+floor(tier/2)`; gear `1+rarityOrder`; slay `2`;
  delve `3+d` (`src/systems/contracts.ts:73-88`).

Spent on `META_UPGRADES` (`src/systems/meta.ts:9-22`): cheapest tracks
`[3,6,11]`, most expensive single level 22 (treasure_sense L3, toughness L5).
A clean D2 extract (6) buys ~2 early levels; a D6+boss extract (39) buys
~2–3 late levels. Renown pacing is roughly right: scarce early, meaningful
per decision. **Do not fix gold by inflating renown costs** — the two
economies serve different purposes (gold = within-run power/convenience,
renown = permanent progression). The fix is sinks for gold, not a renown
grind.

### 1.4 Durability (why it is pointless today)

- Pools (`src/systems/items.ts:262-274`): weapon 110, offhand 130, thrown 90,
  body 150, head 120, hands 110. Rings/amulets 0 (never wear),
  `never_dulls` unique 0. Max scales `*(0.8+0.2*tier)*(1+masteryBonus)`,
  mastery up to +40% (`src/systems/items.ts:285-294`).
- Wear (`src/world/world.ts:470-491,1204,1423,2722,2741,2903`): weapon 1 per
  landed blow (2 on 2H cleave), offhand 1 per blocked hit (0 on parry),
  armour 1 on a random body/head/hands piece per unblocked damaging hit,
  0 on miss/air/dodge/parry.
- Penalty: broken = `x0.25` all stats (`src/systems/items.ts:276-277`).
  Warn at 25%, broke at 0.
- Repair cost pro-rated to missing fraction, so light wear costs 1–5g.

Math: a 110-dur weapon needs 110 landed hits to break — roughly 3–4 full
floors. Armour spreads hits across 3 slots, so a single piece breaks after
~300+ unblocked hits taken. Most runs extract or die long before anything
breaks, and partial wear costs pocket change. No tension, no sink.

### 1.5 Market healing (does not exist yet)

Healing today is dungeon-only (fonts/shrines) or consumables bought in town
(draught 25% maxHp, greater 55%) used from the backpack
(`src/world/world.ts:2205-2216`, via `World.heal()` with trait/difficulty
multipliers `src/world/world.ts:457-463`). There is no "heal to full in
town" service. Players enter runs damaged (or burn potions) with no gold
outlet for it.

### 1.6 Altars / shrines

- Spawn (`src/systems/dungeon.ts:593-596`): at most 1 shrine room per floor,
  `45%` chance, no pity/guarantee. Expected shrines per 6-floor run ≈ 2.7,
  but variance is high: P(no shrine in 3 floors) = `0.55³ ≈ 16.6%`.
- Flavour per `floorSeed:propId` (`src/systems/dungeon.ts:330-333`):
  font 4 / idol 4 / coffer 3 (~36%/36%/27%).
- Effects (`src/world/world.ts:2067-2130,331-347,431-439`):
  - font: free, heals 60% maxHp + full stamina, clears curse, never
    blesses/curses.
  - idol: free gamble — 60% heal + blessing (or just heal if blessed),
    40% random curse, no heal.
  - coffer: `30+25*depth` gold — heal + blessing (or just heal if blessed).
- Blessing (one max, run-long, `grantBlessing` no-ops if blessed):
  fortune +30 find, fury +25% attack, ward +5 defense.
- Curse (one slot, overwrite): frailty `x0.85` maxHp, leaden −12 speed,
  dulled `x0.8` attack, hunted +2 enemy sight range.

Shrines are the only in-dungeon healing + the only blessing/curse source,
so a dry streak of 3–4 floors with no shrine means no comeback mechanic at
exactly the moment a bleeding run needs one.

## 2. Problems

1. **Gold income >> gold sinks.** Raw floor gold alone (140 → 1270 by depth)
   dwarfs repair/identify/consumable spend. Endgame value yield (D6 ~15k)
   converts to thousands of gold via sales.
2. **Durability is not a sink and not a decision.** Pools are too deep,
   misses/dodges/parries cost nothing, broken-at-25%-stats still works, and
   pro-rated repair makes typical bills trivial.
3. **No paid healing outlet.** Damaged players have no "pay gold, enter whole"
   button; potions partially cover it but are cheap and hoardable.
4. **Altars too rare / too swingy.** 45% independent rolls with no guarantee
   produce frequent droughts; blessings/curses are small enough (+5 def,
   +25% atk, −12 speed) that missing them for a whole run feels like nothing
   happened.
5. **Blessings/curses too flat.** One blessing slot, four curses, fixed
   magnitudes, no depth scaling — no reason to care or to gamble on idols
   past D2.

## 3. Proposals

### 3.1 Durability → a real (but fair) gold sink

Intent: repairs become the steady per-run gold tax; breakage becomes rare
but scary. Not: degrade-per-swing tedium or jewellery book-keeping.

- **Halve effective pools via wear rate, not pool size** (keeps `maxDurability`
  display stable; one constant to tune). Suggested: weapon 1 → 2 per landed
  blow (2H cleave 2 → 3); armour 1 → 2 per unblocked hit; offhand block 1 → 2.
  Net effect: weapon breaks after ~55 hits (~1.5 floors of fighting) instead
  of ~110. Thrown stays 1+1 (already shortest).
- **Charge for misses/air at 1 wear per 3 whiffs** (counter, not per-event
  float): currently spamming attacks into air is free; this closes the
  exploit without punishing normal play.
- **Keep rings/amulets exempt and `never_dulls` exempt** — no change.
- **Repair cost: `0.3 → 0.5` of itemValue, with a floor by tier.**
  New formula: `max(tierFloor, ceil(itemValue*0.5*(1-frac)))` where
  `tierFloor = [0, 4, 9, 18, 32, 50][tier]`. Light wear still cheap on
  early gear; deep gear at 50% wear costs real money (e.g. a 400-value
  moonsilver piece at half wear: `ceil(400*0.5*0.5)=100g` vs `60g` today).
- **Broken penalty `0.25 → 0.15` stats + cannot block/cleave while broken.**
  Breakage must mean "extract or die", not "finish the floor at 75%
  efficiency". Keep warn at 25% + add UI red tint (already have warn event;
  surface it).
- **Mend-all stays** (`src/ui/town.ts:800-849`) — the sink is the price,
  not the clicks.

Expected outcome: typical D3–D4 run pays ~80–150g in repairs (vs ~10–30g
today) — a tax, not a wipe. Full-break neglect costs 200g+ on deep gear.
Tune with `scripts/tables.ts` loot-yield harness before shipping.

Alternatives rejected: per-swing degradation regardless of hit (feels
random); jewellery wear (book-keeping); crafting gold fees (conflicts with
materials-only design).

### 3.2 Market "Heal" button (paid full heal in town)

New town service next to repair bench, e.g. `src/ui/town.ts` "Physicker":

- **Effect:** restore HP to full + clear nothing (curses persist — fonts keep
  their job). No stamina component (stamina refills on its own cadence).
- **Cost formula** (scales on all three requested axes):
  `cost = ceil((8 + maxHp*0.9 + gearScore*0.5) * curseMult * depthMult)`,
  where `gearScore = sum(itemValue of worn equipment)/10`,
  `curseMult = 1.5` if cursed else `1.0`,
  `depthMult = 1 + 0.08*(depth-1)` (run depth; bestDepth between delves).
  Indicative: early (70 maxHp, ~150 worn value → gearScore 15, D1):
  `~(8+63+7.5)=79g`. Late (135 maxHp, ~6000 worn value → gearScore 600,
  D6 `x1.4`): `~(8+121.5+300)*1.4 ≈ 602g`. Cursed late: ~903g. These are
  deliberately steep at the top end —
  full-heal-every-run should compete with buying gear/potions, not be
  automatic.
- **Design notes:** price shown before click; unaffordable → disabled with
  tooltip (same pattern as coffer). Does not heal in-dungeon (no new
  consumable, no power creep on draughts). Curse multiplier makes fonts/idols
  relatively more attractive when cursed — intended interplay.
- Open tuning: flat `8` base vs pure scaling; whether `gearScore` should use
  worn-only or worn+stash value (recommend worn-only: rewards quitting while
  ahead with backup gear).

### 3.3 Altar spawn: slight increase + pity guarantees

Constraints from the brief: not guaranteed each level; ≥1 in floors 1–3;
≥2 in floors 4–6 (i.e. ≥3 per full run, up from expected ~2.7 but with
variance removed).

- **Base rate `45% → 55%`** per floor (`src/systems/dungeon.ts:593`).
- **Pity:** track consecutive floors without shrine across the run seed;
  force-spawn if the block guarantee is unmet:
  - if floor 3 ends the 1–3 block with 0 shrines, floor 3 gets one;
  - if floor 6 ends the 4–6 block with <2 shrines in that block, floor 6
    gets one (and if 0 in block by floor 5, floor 5 gets one).
  Implementation: pass `runSeed + blockCounts` into floor gen; deterministic,
  no cross-floor RNG state beyond counters already available in run object.
- **Keep max 1 per floor.** Keep flavour split 4/4/3 (or 5/4/3 if coffers
  should trail the new heal button — see §3.2; recommend keeping 4/4/3 for
  now, revisit after heal-button telemetry).
- Expected result: ~3.3 shrines/run expected, minimum 3 per full clear,
  droughts capped at 2 floors. Early runs (die on D2) still often see 1 —
  the guarantee only bites for players who reach floor 3.

### 3.4 Stronger blessings and curses

Intent: shrines feel eventful; idol gambles are real decisions; curses hurt
enough to make fonts/coffers/heal-button into comeback tools.

- **Blessings (pick one, magnitudes up + depth scaling):**
  - fortune: `+30 → +40` find, `+5 per depth beyond 2` (D6: +60).
  - fury: `+25% → +30%` attack, rounded as today.
  - ward: `+5 → +6 defense, +1 per 2 depths` (D6: +8/+9).
  - **New: vitality** — `+20% maxHp for the run` (heals the gained amount on
    pickup, like a max-up). Gives heavy-armour runs a reason to care.
  Keep one-blessing-max + no-op-if-blessed (no stacking).
- **Curses (magnitudes up, one slot, overwrite as today):**
  - frailty: `x0.85 → x0.80` maxHp.
  - leaden: `−12 → −15` speed.
  - dulled: `x0.8 → x0.75` attack.
  - hunted: `+2 → +3` enemy sight range.
  - **New: brittle** — worn gear takes +1 wear per event (stacks with §3.1
    rates; the "please find a font" curse).
- **Idol odds `60/40 → 65/35`** (slightly kinder to compensate stronger
  curses; keeps gamble positive-EV but scary).
- **Font stays free** (heal 60% + cleanse). **Coffer price unchanged**
  (`30+25*depth`) — with stronger blessings it becomes good value; revisit
  if coffers become auto-buy (telemetry: coffer take-rate vs affordable
  rate).

### 3.5 What NOT to change (renown)

Renown pacing (§1.3) is healthy. Do not raise upgrade costs to soak gold
(wrong currency), do not pay renown for market actions, and do not gate the
heal button behind renown. If gold sinks overshoot and players stall on
potions/identifies, tune sink prices first.

## 4. Numbers to verify before implementation

1. Repair-tax calibration: run `scripts/tables.ts` loot-yield harness +
   wear counters over 60 seeds with §3.1 rates; target §3.1 "80–150g per
   D3–D4 run".
2. Heal-button curve: compute `gearScore` distribution at each depth from
   real worn sets (not catalogue maxes) — adjust `0.25` coefficient so D1
   cost lands 60–120g, D6 600–900g uncursed.
3. Shrine pity edge cases: boss floors / throne / vault overrides must not
   double-place; pity shrine yields to fixed-role rooms (place only if a
   `normal` room exists, same guard as today).
4. Blessing balance: fury +30% vs ward +8 at D6 TTK — re-run matchups table
   (`balance-tables.txt:123+` method) with each blessing to confirm no
   one-pick meta.

## 5. Telemetry / follow-up

- Gold banked per run vs spent on repairs/heal/coffer/identify (are sinks
  ~30–50% of income on D3+?).
- % runs with 0 shrines in first 3 floors (should go to 0 by construction).
- Idol gamble take-rate before/after; curse-overwrite rate (is `brittle`
  too oppressive with §3.1?).
- Mend-all bill distribution — if median > 200g on D2, §3.1 overshot.

---
*Files referenced: `src/systems/dungeon.ts`, `src/systems/items.ts`,
`src/systems/market.ts`, `src/systems/contracts.ts`, `src/systems/meta.ts`,
`src/systems/run.ts`, `src/systems/crafting.ts`, `src/data/enemies.ts`,
`src/data/difficulty.ts`, `src/world/world.ts`, `src/ui/town.ts`,
`balance-tables.txt`.*
