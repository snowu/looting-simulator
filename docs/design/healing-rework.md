# Healing rework: the flask, morsels and torn scrolls

Status: **designed, not implemented.** Numbers marked *(tune)* are starting
points for the playtest bot to settle, not commitments.

## Why

Healing today is a stockpile. Early on you have no potions; later you buy them
by the stack, and "health" stops being a resource. The target (King's Field /
Shadow Tower attrition, Dead Cells-style flask) is healing that is **always
useful and always limited** at every depth and every bank balance.

The rework has three parts:

1. **The flask**: a refillable, upgradeable heal. Your only in-fight healing.
2. **Morsels**: food dropped by monsters that you eat where it falls. Healing
   between fights.
3. **Torn scrolls**: an instant panic use for each of the two scrolls, limited
   to one tear per floor.

After this, the only consumables you can buy or carry are **Scroll of Identify**
and **Scroll of Recall**.

## What is removed

- `healing_draught`, `greater_healing` and `stamina_tonic` stop existing as
  obtainable items: no drops from corpses, urns, chests or vaults, no shop
  stock (`SHOP_CONSUMABLES` in `src/systems/market.ts`), and no starting kit.
- The per-kill 2.5% Healing Draught roll and every container potion roll in
  `src/systems/items.ts` go (search `makeConsumable('healing_draught'` and the
  `rng.pick([...])` lists that include potions).
- **Supply Crate** (`src/systems/meta.ts`, used in `src/systems/run.ts`) is
  removed.
- **Fight Milk** stops being drunk. It becomes a legendary flask infusion (see
  below). It is still found only in the dark and never sold or crafted.
- Keep the consumable *defs* in `src/data/items.ts` so old saves still resolve
  their refs during migration. Mark them unobtainable rather than deleting them.

Healing never regenerates on its own, and that does not change. Life leech
stays exactly as it is.

---

## 1. The flask

### Core

| | |
|---|---|
| Charges | **3** at base, refilled to full at the start of every delve |
| Heal per sip | **30%** of max health at base |
| Sip | **0.5s** *(tune)*. Your guard is down for the whole sip. The heal lands at the end |
| Hit mid-sip | Does **not** cancel. The blow lands unblocked, and the heal still lands |
| Movement | You can't step or turn while sipping |
| At full health | Refused ("You are already at full health."), no charge spent |

A sip is a commitment, not a free button. Drinking in melee range should get
you hit.

All flask healing goes through `World.heal` (`src/world/world.ts`), so Eulogy
Plate's 50% and the difficulty's `playerHealing` apply automatically.

### Upgrades

**Charges come from Flask Shards found in the dungeon.** Each shard is +1
charge, up to **6** total (3 shards).

| Shard | Source |
|---|---|
| 1st | The first time you reach **depth 3** in the playthrough |
| 2nd | The first time you reach **depth 5** |
| 3rd | Your first kill of **the Ashen King** |
| Any missing after that | Vaults and secret chests, rare *(tune: ~4%)* |

A shard is picked up like loot and applies immediately and permanently. It
never sits in the pack and can't be lost on death. Store it on the persistent
state (for example `state.flask.shards`), **not** on the run. It can't drop
once you have all 3.

**Potency is bought with gold in town,** at the merchant that used to sell
potions. This replaces potions as a steady gold sink.

| Level | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Heal per sip | 30% | 35% | 40% | 45% | 50% |
| Cost | — | *(tune)* | | | |

Price it against `docs/design/gold-renown-balancing.md`: level 1 should be
affordable after a few days, level 4 should be a late-game purchase.

### Refills in the dungeon

- **Font of Mending** and the **Hollow Idol's** good outcome: as now (60%
  health, full stamina via `restore()`), **plus one flask charge**, never above
  max.
- **Offering Stone:** heals as now but does **not** refill a charge. A stone
  you can pay three times would otherwise turn gold back into heals. `restore()`
  is shared by all three, so give it a parameter.

### Dregs

Healing wasted past full health (from `World.heal`: morsels, leech, fonts,
sips) fills a **dregs** meter. When it reaches **50% of max health** *(tune)* it
empties and gives **+1 charge**, if you are below max. At max charges, the meter
holds full and waits.

Show it as a thin fill under the flask icon. It makes eating a morsel at 95%
health a weak choice rather than a wasted one. It resets each delve.

### HUD and input

- The flask gets a **fixed first quick-bar slot** with its own icon, showing
  charges as pips and the dregs fill under it. It can't be dragged; the scrolls
  are reorderable after it, as now.
- Keyboard: **1** sips. The scroll slots move to 2–4.
- Touch: tap the flask slot.

---

## 2. Infusions

At the forge (a bench next to Sigils), you place **one material** into the
flask. The material is **consumed**. The infusion **stays until you replace it**,
and replacing destroys the old one. It can only be changed in town (or while a
town portal is open), the same rule as sigil attunement.

**Every infusion lowers healing by 10 percentage points** (a 40% flask sips for
30%). In return every sip also triggers the material's effect, keyed by the
material *category*, the same identities secondary crafting uses:

| Category | Effect of each sip (6s *(tune)*) |
|---|---|
| Metal | +Defense |
| Wood | +Speed |
| Hide | No timed effect. The 10-point cost is waived and the sip heals **+5 points** instead |
| Cloth | Refills stamina immediately (replaces the Stamina Tonic) |
| Bone | +Attack |
| Gem catalysts | That gem's catalyst affix for 6s: Shadow Essence → Leech, flame shard → Fire, and so on |

**Strength scales with the material's tier and rarity** by the same ladder
crafting already uses. Reuse the existing material-bonus scaling rather than
inventing a second table.

**Fight Milk** is a legendary infusion. While infused, its current effect
(stamina regen 22/s → 37.4/s, −20 max stamina) is **always on** for the delve
from the moment you enter, instead of triggering per sip. It still counts as
the 10-point potency cost. The relic codex rules (`uniquesSeen` /
`uniquesKnown`) still apply: holding the bottle counts as holding it.

A plain, uninfused flask is always an option and is the strongest pure heal.

---

## 3. Morsels

### What they are

| Morsel | Heals | Dropped by |
|---|---|---|
| **Scrap** | 10% max health | Giant Rat, Cave Bat, Goblin Cutpurse, Ember Wisp, Frost Wisp |
| **Cut** | 12.5% | Goblin Archer, Goblin Shieldbearer, Skeleton, Skeleton Archer, Skeleton Shieldguard, Cave Spider |
| **Heart** | 15% | Ghoul, Hollow Knight, Barrow Champion, Flame Wraith, Mimic |

The Ashen King drops none. Put the tier on the enemy def (`src/data/enemies.ts`)
so new monsters have to pick one.

### Drop chance

Per kill, rolled in its own seeded stream so existing loot rolls do not reshuffle:

`chance = 0.35 − 0.026 × (depth − 1)` → 35% on depth 1, about 22% on depth 6 *(tune)*.

Target: **25–35% of max health in food per floor** across the delve. Deeper
floors hit harder but feed you the same, so the flask has to cover the gap. Loot
find does **not** raise it.

### On the floor

- A morsel lands on the corpse's tile as its own floor object, **not** an item.
  It never enters the backpack, stash, loot window or economy.
- **Eat** with [F] / the context button while standing on or facing it:
  **1.2s chew** *(tune)*, healing spread evenly over the chew. A hit during the
  chew **drops the morsel**: whatever hasn't healed yet is lost, and the morsel
  stays on the floor with its remaining value.
- At full health, eating is allowed (the overflow goes to dregs), but the prompt
  says so: *Eat the scrap (you are not hurt)*.
- **The underfoot rule** from loot applies: a morsel never takes the one-button
  action over a swing while an enemy is alive within 2 tiles, or within 4 and
  hunting you.
- **They persist and show on the automap** as a small marker, so a floor keeps
  a trail of food you can walk back to.

### Rot

A morsel **rots 240s** *(tune)* after it dropped, measured on the run clock
(`run.time`), so time spent in town through a portal does not count. It gets
visibly darker over the last third, then disappears, including from the map.
Store the drop time on the morsel. Rot is checked lazily, so floors you are not
on need no ticking.

### Scavengers

A **Giant Rat or Cave Bat** that walks onto a morsel while idle or wandering
**eats it**: 1s, interruptible by being hit. The monster heals fully and gets
**+25% max health and +15% attack** *(tune)* for the rest of the run, once per
monster. The sprite gets slightly larger. It only happens when you left food
behind, and is mainly there to make the Burrows feel alive.

### Persistence

Floors persist for the run (`run.floors`), so morsels are saved with the floor.
Add them as an optional array defaulting to `[]` in migration.

---

## 4. Torn scrolls

Each scroll keeps its normal **read** exactly as it is today. **Tearing** is a
second, instant use that spends the scroll and does something rough and local.
A tear never gives information and never takes you off the floor.

### Limit: one tear per floor

A tear is allowed **once per depth per run**, shared between both scrolls.
Record it on the run as the set of depths already torn on (e.g.
`run.tornDepths: number[]`). It is keyed by depth, not "since the last stairs",
so stepping up and down a staircase doesn't reset it. When used up, trying to
tear says *Your nerve is spent on this floor.* and does nothing.

### Input

- **Touch:** long-press the scroll's quick-bar slot (reuse the long-press in
  `src/ui/dom.ts`). The slots are drag-reorderable (commit b5370c9): a press
  that **moves** is a drag, and a press that **holds still** past the threshold
  is a tear. A tear must never fire on a drag.
- **Keyboard:** hold the scroll's number key for about 400ms. A tap reads.
- Show a short fill ring on the slot while holding, so a tear is never an
  accident.

### Recall, torn: Snap back

You are yanked back along your own path to **where you stood 2 seconds ago**.

- Keep a short ring buffer of `(x, y, facing, time)` whenever the player enters
  a tile.
- Destination: the **oldest** recorded tile from the last 2s that is still
  walkable and unoccupied, at most **4 tiles** of path back. You keep the facing
  you had at that point.
- If there is no valid earlier tile (you stood still, or every tile is now
  blocked), the tear **fizzles**: no scroll spent, no tear used, *The scroll
  will not tear. You have been nowhere.*
- Nothing else changes. Enemies stay alerted and keep chasing, projectiles in
  flight keep flying, and you are still on the floor, now a few tiles further
  away.
- Cancels a recall read in progress, and any sip or chew.
- **Allowed in the Ashen Throne** (unlike reading recall there), since it
  doesn't leave the fight.
- Feel: a sharp reverse whoosh, a quick blur toward the destination (~0.12s),
  a small camera shake.

### Identify, torn: Flash

A blinding flash of true light at **the monster facing you**, in the style of a
Dead by Daylight flashlight save.

**Target:** the nearest living enemy **in front of you within 3 tiles**, in line
of sight, **that is looking at you**: alerted and facing your tile. You can't
flash a monster that has its back to you. With no valid target the tear
**fizzles** (nothing spent) with *There is nothing looking at you.*

**On hit:**

| | Normal enemy | Enemy **mid-wind-up** (flash save) | Ashen King |
|---|---|---|---|
| Blinded | 2s | **3s** | 0.8s |
| Wind-up | — | **Cancelled**, attack not delivered | Not cancelled |
| Shield guard | Dropped for the blind | Dropped for the blind | — |

**Blinded monster:**
- can't start an attack
- turns and stumbles: one random step per ~0.6s, never toward you on purpose
- **loses your trail when the blind ends if you are more than 2 tiles away** (it
  drops out of `chase`, like Snuff, but for one monster). Within 2 tiles it
  finds you again.

Other enemies are unaffected. A flash save should get its own log line and
sound (*Caught it in the light!*). It's a skill shot, and landing one should
feel good.

This does not overlap with **Wardcry** (push) or **Snuff** (floor-wide
de-aggro): Flash is single-target, facing-dependent, and rewards timing against a
wind-up.

---

## Save migration

Follow `src/state/migrations.ts`. Additive only. **No `SAVE_VERSION` bump**, and
never wipe a save.

- **Potions and Stamina Tonics** in stash, loadout, and an in-progress run's
  backpack: remove them, credit **gold at item value** (`itemValue`) to the
  purse. Log it once in the patch note, not in-game per item.
- **Fight Milk** in the stash: becomes the infusion material, placed in the
  stash. **Fight Milk already drunk** in an in-progress run (`run.tonics`):
  leave it applied until that run ends, then drop `tonics`.
- **Supply Crate levels:** refund the renown spent (sum of `costs` up to the
  level), then delete the key.
- New fields default safely: `flask: { shards: 0, potency: 0, infusion: null }`
  on state; `flask: { charges: max, dregs: 0 }`, `tornDepths: []` on a run
  (an in-progress run migrates in with full charges); `morsels: []` on each
  saved floor.
- **Flask Shard milestones on old saves:** grant retroactively from `lifetime`.
  `bestDepth ≥ 3` → 1, `bestDepth ≥ 5` → 2, and a recorded King kill → 3.
  Existing players shouldn't have to redo depth 3.
- Add the legacy fixture case to `src/__tests__/fixtures/save-legacy.json`
  tests: a stash of draughts turns into gold, and Supply Crate turns into renown.

## Things that must be updated with it

- `scripts/playtest.ts`: the bot drinks potions below `drinkAt`. Change it to
  sip the flask, walk to and eat known morsels between fights (when no enemy is
  hunting), and report `sips`, `morselsEaten`, `morselsRotted`, `tears`. **Use it
  to tune** the drop rate, rot time and base charges against the 25–35% food
  target.
- `scripts/upgrades.bench.ts`, `balance.bench.ts`: remove Supply Crate and
  potion assumptions.
- `src/dev/boss-arena.ts`: sets `supply_crate: 3`. Give it max shards, potency 4
  and a plain flask instead.
- `docs/MECHANICS.md`: player table ("Potions, shrines and life leech only"),
  shrines, containers, monster drops, controls (1–4), relic table (Fight Milk),
  meta upgrades.
- README controls table.
- In-game patch note in `src/data/patches.ts` (validated by `npm run patches`).
- Tests referencing `healing_draught` in `SHOP_CONSUMABLES`
  (`src/__tests__/economy.test.ts`) and drop tables.

## Suggested build order

Each step is playable and committable on its own:

1. **Flask core:** charges, sip, HUD slot, potions and Supply Crate removed,
   migration, font/idol charge refill, bot update.
2. **Morsels:** drops, eating, automap, rot. Then dregs.
3. **Flask upgrades:** shards and milestones, potency at the merchant.
4. **Infusions:** the forge bench, then Fight Milk as an infusion.
5. **Torn scrolls:** the input first (long-press vs drag), then Snap back, then
   Flash.
6. Scavengers, last and optional.
