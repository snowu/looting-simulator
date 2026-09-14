# Weapon roster expansion — two-handed and thrown

*Design spec. Not implemented. Companion to [MECHANICS.md](../MECHANICS.md) §2, §7, §9.*

Six new weapon bases: three **two-handed** melee weapons that spend the offhand
slot, and three **thrown** weapons with finite charges you go and pick back up.
Nothing here is a new top tier. Every number below is measured against the real
formulas in `src/systems/combat.ts` and the real data tables, not invented.

**Method.** Unless stated otherwise, a weapon's headline figures are quoted the
way MECHANICS §9 quotes them: `attack` at **material tier 5, quality 1, no
material modifiers, no affixes**.

| Metric | Formula |
|---|---|
| effective DPS | `attack / (windup + recovery)` |
| damage per stamina | `attack / staminaCost` |
| swing window | `(100 / staminaCost) × (windup + recovery)` — seconds of unbroken swinging one 100-stamina bar buys |
| bar damage | `(100 / staminaCost) × attack` |

Time-to-kill figures come from `playerHitsEnemy` run 6000 times per matchup
against `depthPower`/`defensePower`-scaled enemies, the same harness shape as
`scripts/tables.ts`.

---

## A. The problem

### A.1 The measured baseline

Run `npx vitest run --config vitest.playtest.config.ts scripts/tables.bench.ts`
for the ladder and matchups. The per-weapon table below is not in that harness —
it is the §9 table recomputed from `ITEM_BASES`, and it reproduces every published
figure in §9 exactly (blades 45–58 DPS, windows 3.1–3.8s, haft 1.83–2.27 damage
per stamina, war axe 227 vs long sword 179), which is the check that the method
above is the one §9 used.

| Weapon | atk t5 | cycle | **DPS** | cost | **dmg/sta** | window | bar dmg | type |
|---|---|---|---|---|---|---|---|---|
| Long Sword | 43 | 0.74 | **58.1** | 24 | 1.79 | 3.08s | 179 | slash |
| Short Sword | 28 | 0.54 | 51.9 | 16 | 1.75 | 3.38s | 175 | slash |
| War Axe | 50 | 0.98 | 51.0 | 22 | **2.27** | 4.45s | **227** | slash |
| Mining Pick | 42 | 0.84 | 50.0 | 20 | 2.10 | 4.20s | 210 | pierce |
| Spear | 37 | 0.80 | 46.3 | 17 | 2.18 | 4.71s | 218 | pierce |
| Dagger | 17 | 0.38 | 44.7 | 10 | 1.70 | 3.80s | 170 | pierce |
| Mace | 33 | 0.80 | 41.3 | 17 | 1.94 | 4.71s | 194 | blunt |
| Club | 22 | 0.66 | 33.3 | 12 | 1.83 | 5.50s | 183 | blunt |

**MECHANICS §9 has a stale cell:** it lists the Club's stamina cost as **16**.
`src/data/items.ts` says **12**, and 12 is the number that produces the 1.83
damage-per-stamina and 5.5s window §9 quotes two paragraphs later. Fix the table
cell, not the code.

### A.2 What is actually thin

**(1) The offhand slot contains no decision.** `derivePlayer` gives a shield
35–90% block; a weapon with an empty offhand gives 0.30. Every rung of the
`LADDER` in `scripts/tables.ts` from depth 2 down carries a shield, because there
is no reason on earth not to. A silver Tower Shield is +12 Defense and 82% block
for one slot and a −10 speed tax. The offhand is not a choice, it is a checkbox.

**(2) The player has no ranged answer.** Six enemy archetypes shoot
(`goblin_archer`, `skeleton_archer`, the four elemental archers, the two wisps,
`flame_wraith`, and the King's three-bolt volley). The only ranged offence the
player owns is the parry-reflect, which requires the archer to shoot at you
first. Kiting, softening, and pulling — three of the four things a King's Field
player actually does — are not expressible.

**(3) Blunt has no top rung, and blunt is the best damage type.** Measured over
the whole bestiary:

| Type | average multiplier | enemies at ≥1.25 | enemies below 1.0 | worst case |
|---|---|---|---|---|
| **blunt** | **1.10** | 7 | **4** | **0.70** |
| slash | 0.99 | 8 | 10 | 0.55 |
| pierce | 0.97 | 8 | 10 | 0.50 |

(§9 claims blunt averages 1.13. It is **1.10** now — another stale figure; the
Cave Bat's 0.85 and the three wisp/wraith 0.70s came in after that line was
written. Slash 0.99 and pierce 0.97 are still exact.)

Blunt is not dominant because it has the most weak targets — it has the fewest.
It is dominant because **it is almost never punished**: four enemies resist it
and the worst case is 0.70, where slash and pierce are each resisted by ten and
bottom out at 0.55 and 0.50. And the two weapons that carry it are the entry
Club (33.3 DPS, worst in the game) and the mid Mace (41.3 DPS, second worst). A
depth-5 player facing Barrow Champions (blunt ×1.5) and Hollow Knights (×1.2)
has no good blunt option. At silver, tier 3:

```
mace         vs skeleton_shield  hit=33.1  x4  ttk=3.20s   <- the only blunt answer
war_axe      vs skeleton_shield  hit=25.3  x4  ttk=3.92s
long_sword   vs skeleton_shield  hit=20.1  x5  ttk=3.70s
```

The Mace out-damages a War Axe two line-steps above it, per hit, against a third
of the bestiary — and is 24% behind it on DPS everywhere else. That is a hole,
not a balance.

**(4) The Mining Pick is very close to redundant.** At tier 5 it is 50.0 DPS /
2.10 damage per stamina / reach 1 / pierce. The Spear is 46.3 / 2.18 / **reach
2** / pierce, drops one depth earlier, and is cheaper. The Pick buys 8% DPS with
worse efficiency and the loss of reach 2 — and reach 2 is worth vastly more than
8%, because it is the difference between trading blows and not. Measured, at
moonsilver against the Hollow Knight: pick 11.76s, spear 12.00s. Two percent, for
a whole tile of standoff. The Pick survives on its `weaponClass === 'pick'`
"Rock and Stone!" roll and nothing else. *This spec does not fix the Pick* — it
is called out so nobody thinks the roster is healthier than it is.

**(5) Six of eight weapons are `primary: ['metal']`.** Only the Club takes wood
or bone. Yew (+3 speed) and Ironwood (+2 attack, +1 defense) are the only two
Uncommon/Rare woods in the game and neither has a weapon it can be the *primary*
material of. Two of the six new bases fix that.

**(6) Every weapon hits exactly one tile, and only the tile you face.** So does
blocking (§2: "Blocking only works against attacks from the tile you face"). The
game has no answer to three things adjacent at once, in either direction.

---

## B. The roster

Format matches MECHANICS §9. Stats are at material tier 1 with the per-tier gain.

| Base | Slot | Stats (tier 1) | Per tier | Windup / recovery / stamina / reach | Value | From depth |
|---|---|---|---|---|---|---|
| Halberd | weapon **(2H)** | 28 atk | +5.5 atk | 0.34 / 0.66 / 22 / **2** | 92 | 3 |
| Great Maul | weapon **(2H)**, wood/metal | 32 atk | +6.5 atk | 0.46 / 0.74 / 23 / 1 **(sweep)** | 96 | 4 |
| Greatsword | weapon **(2H)** | 30 atk | +6 atk | 0.38 / 0.60 / 24 / 1 **(sweep)** | 130 | 5 |
| Throwing Knives | weapon **(thrown)** | 9 atk | +2.5 atk | 0.16 / 0.34 / 9 / **throw 4** | 26 | 2 |
| Throwing Axes | weapon **(thrown)**, wood/metal | 17 atk | +4 atk | 0.24 / 0.46 / 15 / **throw 5** | 58 | 3 |
| Javelins | weapon **(thrown)** | 26 atk | +4.5 atk | 0.32 / 0.58 / 19 / **throw 7** | 88 | 4 |

Table-side fields:

| Base | `weight` | `primary` | `weaponClass` | `damageType` | `GEAR_LINES` position |
|---|---|---|---|---|---|
| `halberd` | 0.5 | `['metal']` | `'polearm'` | pierce | `['halberd']` — singleton |
| `great_maul` | 0.4 | `['metal','wood']` | `'maul'` | **blunt** | `['great_maul']` — singleton |
| `greatsword` | 0.3 | `['metal']` | `'greatsword'` | slash | `['greatsword']` — singleton |
| `throwing_knives` | 1.6 | `['metal']` | `'thrown'` | pierce | `['throwing_knives', …]` step 0 |
| `throwing_axes` | 0.9 | `['metal','wood']` | `'thrown'` | slash | step 1 |
| `javelins` | 0.5 | `['metal']` | `'thrown'` | pierce | step 2 |

```ts
export const GEAR_LINES = [
  ['dagger', 'short_sword', 'long_sword'],
  ['club', 'mace', 'mining_pick', 'war_axe'],
  ['spear'],
  ['throwing_knives', 'throwing_axes', 'javelins'],   // new
  ['halberd'],                                        // new
  ['great_maul'],                                     // new
  ['greatsword'],                                     // new
  // …offhand, head, body, hands, jewellery unchanged
];
```

**Why the two-handers are singletons and not a line.** A `GEAR_LINES` step is
required to *beat the step below it forged two material tiers better*, on the
base's own stats. A two-hander's compensation is paid in a slot the comparison
cannot see, so appending one to the blade or haft line would force it to be a
strictly better weapon — the new top tier this design is forbidden to create.
Singletons are already first-class here (`spear`, `robe`, `band`, `pendant` are
lines of one, and the docstring says so). Each 2H base is tuned laterally
against the whole one-handed ladder instead.

One wrinkle to hand the implementer: `blueprintDropWeight()` is `0.4 ** gearTier`,
so a singleton's blueprint drops as often as a Dagger's. A greatsword blueprint
should not. **Safe default: add an optional `blueprintWeight?: number` on
`RecipeDef` and set the three 2H recipes to 0.16** (= `0.4²`, a third-step item).
The thrown line needs no override — it is a real line.

New weapon drop weight totals 4.2 against the existing 13.65, so roughly **24%
of weapon drops** are new bases. Deliberately under-weighted: the familiar ladder
should still be what a run mostly hands you.

### Why each one exists

- **Halberd** — the only reach-2 weapon that is not also carrying a shield, and
  the only weapon that pushes an enemy's attack cooldown by half a second. It
  creates the decision *"do I want to trade blows from two tiles away and never
  block, or one tile away behind eighty percent block?"* — a real King's Field
  question that the Spear currently answers for free.
- **Great Maul** — the top rung blunt has never had, and the only weapon whose
  swing resolves against three tiles. It creates *"am I in a corridor or a
  room?"*, a decision no weapon currently makes, and *"is this floor bone?"* with
  a weapon that can actually finish the fight.
- **Greatsword** — a Long Sword with +26% per hit and +26% damage per stamina bar
  for 5% less DPS and no shield. It creates *"is my parry good enough to be my
  whole defence?"*, which is the question the parry system has been waiting for
  since it stopped needing a shield.
- **Throwing Knives** — cheap, plentiful, short-ranged; the base whose job is to
  teach the recall loop on floor 2 before it matters. It creates *"can I finish
  that Goblin Archer before it finishes its wind-up?"*
- **Throwing Axes** — the mid thrown weapon and the only slash that is not
  metal-primary; an ironwood set is a genuine Rare-material weapon. It creates
  *"is it worth spending my stamina on the two rats before the ghoul arrives?"*
- **Javelins** — three or four heavy pierce throws at seven tiles, then a bad
  short spear. It creates the pull: *"soften the Hollow Knight down the hall,
  then decide whether to fight it at all."*

### Recipes (`src/data/recipes.ts`)

Every primary slot's categories match the base's `primary`, so
`src/systems/crafting.ts` can express all six as-is.

```ts
{ id: 'r_halberd', baseId: 'halberd', starter: false, value: 240,
  slots: [{ label: 'Head', categories: ['metal'], qty: 4 },
          { label: 'Shaft', categories: ['wood'], qty: 4 }, GEM] },
{ id: 'r_great_maul', baseId: 'great_maul', starter: false, value: 250,
  slots: [{ label: 'Head', categories: ['metal', 'wood'], qty: 5 },
          { label: 'Haft', categories: ['wood'], qty: 4 }, GEM] },
{ id: 'r_greatsword', baseId: 'greatsword', starter: false, value: 340,
  slots: [{ label: 'Blade', categories: ['metal'], qty: 7 },
          { label: 'Grip', categories: ['wood', 'hide'], qty: 2 }, GEM] },
{ id: 'r_throwing_knives', baseId: 'throwing_knives', starter: true, value: 0,
  slots: [{ label: 'Blades', categories: ['metal'], qty: 2 },
          { label: 'Bandolier', categories: ['hide', 'cloth'], qty: 1 }, GEM] },
{ id: 'r_throwing_axes', baseId: 'throwing_axes', starter: false, value: 130,
  slots: [{ label: 'Heads', categories: ['metal', 'wood'], qty: 3 },
          { label: 'Hafts', categories: ['wood'], qty: 2 }, GEM] },
{ id: 'r_javelins', baseId: 'javelins', starter: false, value: 210,
  slots: [{ label: 'Heads', categories: ['metal'], qty: 3 },
          { label: 'Shafts', categories: ['wood'], qty: 4 }, GEM] },
```

`r_throwing_knives` is a **starter recipe** on purpose: the recall loop should be
learnable in town on day one with two copper and a scrap of hide, not gated
behind a blueprint drop.

Wood-primary bases cap at material tier 3 (Ironwood is the deepest wood). An
ironwood Great Maul is 32 + 6.5×2 + 2 = **47 attack** — a genuine mid-tier
weapon, well short of a moonsilver one's 51, which is exactly the ceiling a
sidegrade material should have.

### No new stat keys

`STAT_KEYS` is untouched. Charges, throw range, two-handedness and the sweep are
all fields on `ItemBaseDef` / `SwingProfile` — **data-table properties of a base,
never properties of an `Item`**. An `Item` still stores only
`{ref, materialId, rarity, ilvl, affixes, quality, dur, …}`, so none of this
touches a save.

### Reconciliation with the types already on `feat/weapon-overhaul`

This spec was written against `src/types.ts` as of commit `0e5e0a0`. A parallel
change has since landed `twoHanded`, `ThrownProfile` and the new `WeaponClass`
members. **Use the shapes that are on disk** — they are good, and where they
differ from the draft below the differences are cosmetic. Two substantive notes:

1. **`ThrownProfile.power` is the multiplier on Attack for a *thrown* hit, and
   `swing` is the melee fallback.** That inverts this spec's `meleeMult`. So the
   base's `attack` must be the **melee** number and `power` scales it up to the
   throw number. Translated, with the throw figures unchanged:

   | Base | `base.attack` / `perTier.attack` (melee) | melee t5 | `power` | **throw t1 / t5** |
   |---|---|---|---|---|
   | `throwing_knives` | 5 / +1.4 | 10.6 | **1.80** | 9.0 / **19.1** |
   | `throwing_axes` | 12 / +2.8 | 23.2 | **1.42** | 17.0 / **32.9** |
   | `javelins` | 17 / +2.9 | 28.6 | **1.54** | 26.2 / **44.1** |

   Every throw figure in sections D and E is reproduced to within 0.2. Charge
   counts map to `stock` / `stockPerTier` as **6 / 0.5**, **4 / 0.5**, **2 / 0.5**
   (`floor(stock + stockPerTier × (tier − 1))` gives the same 6/6/7/7/8 etc.).
   `ThrownProfile.sprite` covers both the in-flight and on-floor art, so §G's
   `proj_*` and `pickup_*` pairs collapse to one id each unless a floor-oriented
   variant is wanted; **prefer two ids** — a spinning axe and an axe lying flat
   are different pictures.

2. **`WeaponClass` on disk has `'halberd'` where this spec said `'polearm'`, and
   also adds `'bow'`.** Use `'halberd'`. **This spec deliberately does not
   include a bow** — see the note in the open questions below.

Still needed on top of what has landed:

```ts
export interface SwingProfile {
  // …existing fields…
  /** Resolves against the tile you face AND the two tiles beside you. */
  sweep?: boolean;
}

export interface ItemBaseDef {
  // …existing fields…
  /** Overrides the weaponClass→viewmodel map for bases that need their own art. */
  viewmodel?: string;
}
```

`viewmodelFor()` changes signature from `(weaponClass)` to `(base: ItemBaseDef)`
and prefers `base.viewmodel` — needed because the three thrown bases share
`weaponClass: 'thrown'` but must not share a viewmodel. Three call sites
(`src/dev/art-sheets.ts:173`, `src/world/world.ts:2322`,
`src/__tests__/art.test.ts:45`) and nothing else reads `weaponClass` except the
Mining Pick's flavour roll.

---

## C. Two-handed — the rule set

### C.1 What flags an item

`ItemBaseDef.twoHanded === true`. Absent means one-handed, so every existing base
reads correctly with no change — the same trick `dur` and `uniqueId` use.

### C.2 What `derivePlayer` does

Two lines and one guard, in `src/systems/player.ts`:

```ts
const weapon = eq.weapon ? itemBase(eq.weapon.ref) : null;
const twoHanded = !!weapon?.twoHanded;

// The offhand contributes nothing at all while both hands are on the weapon.
for (const slot of EQUIP_SLOTS) {
  if (twoHanded && slot === 'offhand') continue;   // <- the whole change
  const it = eq[slot];
  if (it) addStats(stats, itemStats(it));
}

const hasShield = !twoHanded && !!eq.offhand;

block: hasShield ? clamp(stats.block / 100)
     : twoHanded ? 0.20
     : weapon    ? 0.30
     :             0.12,
```

**Block with a two-hander is 0.20, not 0.30.** You cannot get a greatsword
between you and an axe as readily as a long sword and a free hand. It is a small,
legible tax that makes the tooltip honest, and it needs no stat key.

Everything else is unchanged. In particular:

- **Parrying is identical.** Same 0.22s window, same 0.75s cooldown, same free
  cost, same 1s stagger and ×2 vulnerability, same projectile reflect. §2 already
  says "No shield needed — a weapon or bare hands parry the same." *This is the
  hook.* A two-handed build's entire defence is the parry: the shield is
  insurance, two hands is a bet on your timing. Say that in the tooltip.
- **Stamina, speed, health, crit, find, leech, elements** all come from the other
  seven slots exactly as before.

### C.3 What you are giving up, priced

A silver Tower Shield is +12 Defense and 82% Block for −10 Speed. Against the
depth-5 `LADDER` rung (def 55, hp 123, facing an Icebound Guard at 27.4 per hit):

- Defense 55 → 41 raises `mitigate` from `1 − 55/130 = 0.577` to `1 − 41/116 =
  0.647`: **+12% damage on every unblocked hit**.
- Block 0.82 → 0.20 raises what gets through a *blocked* hit from 18% to 80%:
  **4.4× damage on every blocked hit**.
- The −10 Speed comes back, so windup and recovery divide by 1.0 instead of 0.9:
  **swings are ~10% faster**, which is already counted in the DPS figures below
  only insofar as they use the raw profile.

That is an enormous cost and it must be paid for with something other than raw
numbers, or the two-hander is simply the best weapon.

### C.4 The compensation — four things, exactly

**1. The sweep** (`swing.sweep`, on the Great Maul and Greatsword only).

> A sweeping swing resolves against **three tiles: the one you face, and the two
> orthogonally beside you**. Full damage on each. Never behind you, never at
> reach 2.

This is the headline, and it is precisely aimed: §2 says *"Blocking only works
against attacks from the tile you face."* A shield covers one direction. Three
things adjacent is the situation a shield is worst at, and it is the situation a
sweep answers. In a one-tile corridor — most of the dungeon — the flanks are
walls and the sweep does nothing at all.

Details:
- The **front tile only** breaks urns and barrels. A maul is not the best
  container-opener in the game.
- Each tile runs the existing `guardReaction` independently, so a shieldbearer
  swept from the flank behaves exactly as the current code already says it does.
- **A sweep never triggers `shieldBash`.** A `'bash'` reaction on any swept tile
  degrades to `'chip'`. Sweeping into two shieldbearers must not stun you twice.
- Durability: **1 point for the swing, +1 more if two or more monsters were
  struck, capped at 2.** Wiping a room still costs.

**2. Stagger on a landed blow** (all three two-handers).

> A landed two-handed blow adds **+0.3s** to the target's `attackCd`
> (**+0.5s** for the Halberd). It does not cancel a wind-up.

Against enemy cycles of 1.3–2.0s that is a 15–25% cut in their damage output while
you are on them, and it gives the two-handers a reason to exist against a single
large target where the sweep does nothing. It deliberately does **not** interrupt
a wind-up: cancelling wind-ups is what the parry does, and the parry stays the
centrepiece.

**3. Two chips instead of one against a guard** (all three).

> A two-handed blow into a held guard counts as **two** chips toward
> `GUARD_BREAK_AT` (3).

So a two-hander sags a Hollow Knight's or Skeleton Shieldguard's guard in **two**
blows instead of three. It still gets bashed if it lands on the *raise* — the read
is unchanged, the reward for winning it is bigger.

**4. The best damage per stamina in the game, and not the best DPS.**

Hard requirement, verified in section E: **no two-hander has a higher effective
DPS than the Long Sword's 58.1**, and the highest is the Greatsword's 55.1. In a
one-on-one duel in a corridor, a Long Sword and a Tower Shield beats a
Greatsword. The two-hander wins in rooms, against crowds, against shields, and on
the stamina bar.

### C.5 UI

- **Weapon tooltip**, first line under the name, in the amber used for durability
  warnings: `Two-handed — your off hand is stowed.` Second register (Shift /
  tap) adds: `Block 20% (a shield would give 35–90%). Parry unchanged.`
- **Gear screen:** the offhand slot renders **dimmed with a `Stowed` overlay**
  and the item's stat lines struck through. It is still clickable and still
  un-equips to pack or stash the normal way.
- **Derived stat panel:** `Block 20%`, with the shield's Block and Defense shown
  struck through so it is obvious *why*.
- **Equip confirmation:** none. Do not add a modal. The dimmed slot is the
  message.

### C.6 Save compatibility — the important part

**Existing saves have both slots filled. Nothing may be deleted and nothing
migrates.** There are two ways to honour that:

- **Stow (this spec's original proposal):** equipping a two-hander never mutates
  `state.equipment`; the shield stays in `equipment.offhand` and is skipped at
  derive time.
- **Displace (what has since landed in `src/systems/equip.ts`):**
  `twoHandedConflict()` moves the displaced piece out to the pack or stash, and
  **refuses the equip** if there is nowhere to put it — *"Both hands are needed
  for that, and there is no room to stow your offhand."*

**Displace is the better of the two and is the one to keep.** It has the
advantage the stow model does not: the inventory never lies about what you are
wearing. Its one dangerous failure mode — no free slot — is handled by refusing
rather than deleting, which is the correct call. Two things make it safe, and
both are already in place:

1. The equip is **refused, never destructive.** No path drops an item on the
   floor of a town or silently eats it.
2. `derivePlayer` **also** excludes the offhand when the weapon is two-handed,
   defensively, because `Equipment` records are built directly by
   `scripts/tables.ts` and the boss arena as well as by `equipFrom`. Without that
   belt-and-braces the harness would measure a maul *and* a tower shield and
   print numbers for a build the game cannot produce.

Whichever model survives, the save argument is identical and is the point of this
section: **two-handedness is a property of `ITEM_BASES`, not of an `Item`.**

| | |
|---|---|
| `SAVE_VERSION` | **unchanged (2)** |
| `SAVE_REVISION` | **unchanged** — nothing new is written to an item or to the town state |
| Items written | none. Two-handedness is a property of `ITEM_BASES`, and an `Item` stores only its `ref` |
| `persistence.test.ts` fixture | round-trips unchanged; verify it does |

A stowed shield takes **no durability wear** (it absorbs nothing) and is not
repaired for free either. `hasShield` is `false`, so `world.ts` never runs
`wear('offhand')`.

Required tests:

```
derivePlayer(2H weapon + moonsilver tower shield assigned directly)
  → hasShield === false
  → twoHanded === true
  → block === 0.20                      <- STILL MISSING on disk; see below
  → stats.defense excludes the shield's Defense
  → stats.block excludes the shield's Block
  → the shield's affixes contribute nothing either

equipFrom(2H weapon) with a full pack and a full stash
  → refused, with the message, and the shield is still equipped
```

**Not yet done in the landed code:** `derivePlayer` still returns `0.3` block for
a two-hander (`block: hasShield ? … : weapon ? 0.3 : 0.12`). C.2's **0.20** is a
deliberate tax and the only visible penalty a two-hander carries in the stat
panel. One ternary:

```ts
block: hasShield ? Math.max(0, Math.min(0.9, stats.block / 100))
     : twoHanded ? 0.2
     : weapon    ? 0.3
     :             0.12,
```

---

## D. Thrown / ranged — the rule set

### D.1 The one rule that matters: point-blank is melee

> **If a monster is standing in the tile directly in front of you, pressing
> attack melees. Always. You cannot throw at something on top of you.**

No modifier key, no toggle, nothing to learn. It is the primary guard against
every degenerate loop in this design, and it gives thrown weapons their correct
shape: they are good at two to seven tiles and bad in your face — which is
exactly inverted from every other weapon in the game, and is the reason to carry
one.

Otherwise: **charges > 0 → throw. Charges == 0 → melee.**

### D.2 Charges

`charges = base.thrown.charges + floor((materialTier − 1) / 2)`

| Base | t1 | t2 | t3 | t4 | t5 |
|---|---|---|---|---|---|
| Throwing Knives | 6 | 6 | 7 | 7 | 8 |
| Throwing Axes | 4 | 4 | 5 | 5 | 6 |
| Javelins | 2 | 2 | 3 | 3 | 4 |

Charges scale slowly on purpose. **The material tier is about damage; the base is
about rhythm.** A knife-thrower has a pocketful of pinpricks; a javelin-thrower
throws two enormous spears and then has to go and get them. No affix rolls
charges — there is no *of the Quiver*, and there should not be.

### D.3 Where a thrown charge goes

It flies down the row or column using the existing `Projectile` machinery, one
tile per step, marked `friendly: true` and behaving like a `reflected` bolt (it
hits monsters rather than passing through them).

> **It always comes to rest on the last walkable tile it occupied.**

| It meets | It lands on |
|---|---|
| a wall (`blocksSight`) | the floor tile **before** the wall |
| a monster | the tile **player-side** of the monster — never under a corpse, never inside a creature |
| nothing, at max range | that tile |
| anything unexpected | the thrower's own tile (defensive fallback) |

This is the recovery guarantee, and it is non-negotiable on a grid: **a charge is
always standing on a tile you can walk to.** Traps, props, loot piles and stairs
do not interfere — a charge landing on a trap tile does not arm it.

Landed charges live as **one marker per tile with a count**, so five knives in a
doorway is one sprite reading `×5`, not five overlapping billboards.

**Pickup is automatic on step**, like coins and keys — never a loot window, never
a pack slot. This matters twice over: a full pack must never be able to strand
your ammunition, and it means the "loot underfoot never steals the swing" rule in
§3 is untouched, because a charge underfoot is not a loot pile.

Walking over a tile picks up **only charges of the currently equipped base**.
Charges of a base you have unequipped stay where they are until you equip it
again. That is a real cost of swapping weapons mid-delve, and it is stated in the
log the first time it happens.

Range and flight speed (enemy arrows are 6–7 tiles/s for reference):

| Base | range | speed |
|---|---|---|
| Throwing Knives | 4 | 9 |
| Throwing Axes | 5 | 7 |
| Javelins | 7 | 8 |

### D.4 What **R** does

> **R — Recall.** Instant, no channel. Pulls back **every charge of the equipped
> base lying anywhere on the current floor**. Costs **60% of one throw's stamina
> cost, per charge returned**. Refused outright if you cannot pay in full.
> **6-second cooldown.** Only usable while `attack === 'idle'` and not stunned.
> **Every recalled charge costs 1 durability.**

**The options, and why this one.**

| Option | Verdict |
|---|---|
| (a) Instant free recall of the floor | **No.** Removes the walk, which is the entire mechanic. Vermintide's feel is *going to get them*; free recall is an ammo counter that refills itself. |
| (b) A 5s channel, like Scroll of Recall | **No.** Wrong shape and wrong size. A five-second commitment is only ever paid out of combat, where walking is free anyway, so it would be a worse walk that also muddies the recall scroll's identity. |
| (c) Only within N tiles / line of sight | **No.** Unreadable at 240p in a dark corridor, and it makes the answer to "where did my javelin go" a geometry problem. |
| (d) Costs stamina | **Yes**, with a cooldown and a durability price. |

**Why it is not free power.** Take Javelins at tier 5: 4 charges, 19 stamina a
throw, 100-stamina bar.

```
throw ×4          = 76 stamina   → 176 damage, no ammo left
R (4 × 11.4)      = 46 stamina
                  ───────────
one full cycle    = 122 stamina  for 176 damage
```

**A full volley plus a recall costs more than a whole stamina bar, for every
thrown weapon in the roster:**

| Base (t5) | volley dmg | volley cost | recall cost | total | **effective dmg/stamina** |
|---|---|---|---|---|---|
| Throwing Knives | 8 × 19 = 152 | 72 | 43.2 | **115.2** | **1.32** |
| Throwing Axes | 6 × 33 = 198 | 90 | 54.0 | **144.0** | **1.38** |
| Javelins | 4 × 44 = 176 | 76 | 45.6 | **121.6** | **1.45** |

The worst melee weapon in the game on this axis is the Dagger at **1.70**. Every
throw-and-recall loop is between 15% and 22% *worse* than the worst melee weapon
in the game. **Ranged is not a stamina discount. It is a positioning tool that
costs more than swinging.** Walk over to collect them instead and you get
2.11 / 2.20 / 2.32 — mid-table, paid for with a walk through the room you were
trying not to walk into.

**What stops the doorway spammer.** Five independent things, in order of how
early they bite:

1. **Point-blank is melee.** The moment anything reaches your tile-in-front you
   are holding a bad short spear with a 0.20-equivalent guard and no shield
   advantage. The doorway does not protect you; it just decides which one thing
   arrives first.
2. **The volley-plus-recall cycle costs more than a full bar** (table above). You
   physically cannot do it without stopping.
3. **Stamina regen is gated on `attack === 'idle'` plus a 0.9s gap** (§9,
   `world.ts`). Refilling 122 stamina takes ~**5.5 seconds of standing still**
   after every four javelins. That is not a rotation, that is a rest — and it is
   the identical throttle that already turns a held attack button into "six
   swings then one a second".
4. **The 6-second cooldown** stops R being a mid-volley top-up and keeps the ammo
   rhythm and the stamina rhythm locked together.
5. **Recall costs 1 durability per charge, walking costs none.** A javelin's pool
   is 110–198. About **50 recall presses and it is broken** (25% stats, §7). The
   lazy loop is the expensive loop — which is exactly the shape §7 already uses
   for the shield: *"a parry costs nothing — one more reason to meet the swing
   instead of hiding behind it."*

**If it still measures hot** in `scripts/tables.bench.ts` or a playtest run, the
knob is one constant: raise the recall cost from **0.6 → 0.8** of a throw. At 0.8
even the Javelin's effective efficiency drops to 1.29, below the Dagger by 24%.
Ship at 0.6.

R does nothing at all with a non-thrown weapon equipped, and does not log.

### D.5 Melee with a thrown weapon

Fired point-blank or at zero charges. `thrown.melee` is a full `SwingProfile`;
`thrown.meleeMult` scales the damage by multiplying `anim.attackPower` at swing
time (so it scales elemental damage down too, correctly — a knife jab should not
carry the full Blazing).

| Base | melee windup/recovery/stamina/reach | `meleeMult` | melee atk t5 | melee DPS t5 |
|---|---|---|---|---|
| Throwing Knives | 0.14 / 0.30 / 8 / 1 | 0.60 | 11.4 | 25.9 |
| Throwing Axes | 0.20 / 0.42 / 13 / 1 | 0.70 | 23.1 | 37.3 |
| Javelins | 0.26 / 0.56 / 17 / **2** | 0.65 | 28.6 | 34.9 |

**The invariant: a thrown weapon out of ammunition is always worse than the
cheapest melee weapon of its era.** Knives (25.9 DPS) lose to a Club (33.3).
Javelins (34.9 DPS at reach 2) lose badly to a Spear (46.3 at reach 2) — which is
what stops the Javelin being a strictly better Spear that also throws.

`derivePlayer` reports **both**: `swing` is the throw profile (that is what the
tooltip and the HUD show), and a new `meleeSwing` field defaults to `swing` for
every other weapon. `World.attack()` picks between them. `derivePlayer` stays
pure and never needs to know about run state.

### D.6 Interaction with shields and parries

| Question | Answer |
|---|---|
| Can a shield enemy block a throw? | **Yes.** A charge striking a shieldbearer frontally with its guard up runs the existing `shieldChip` for `1 − block` damage and counts one chip. |
| Can it trigger a shield bash? | **No.** A `'bash'` reaction degrades to `'chip'` for thrown charges. It cannot step into you from four tiles away. |
| Can any enemy parry a throw? | **No.** No enemy parries anything today; do not add one. |
| Does the player's parry-reflect touch it? | **No.** Friendly projectiles skip the player-tile branch of `updateProjectiles` entirely. You cannot parry your own javelin, and a charge cannot start on your tile and hit you. |
| Do thrown charges collide with enemy bolts? | **No.** Projectiles do not collide with each other today and should not start. |
| Do affixes and elemental stats apply? | **Yes, in full.** A throw runs `playerHitsEnemy` with the ordinary `PlayerDerived`. Sharp, Brutal, Blazing, Lucky, of the Leech all work exactly as on a swing. No special casing keeps thrown weapons inside the power ladder instead of beside it. |
| Do thrown weapons crit? | Yes, at the default ×1.6. **No `critMult` override** — the Dagger stays the crit weapon. |

Being able to chip a Hollow Knight's guard safely from four tiles is a real
niche and a deliberate one: it is 25% damage for a full-price throw, and after
three chips its guard sags and you have no charges and it is on top of you. Slow,
safe and awful — which is the correct price for standing out of reach.

### D.7 Where ammunition lives

On `RunState`, in `src/state/game-state.ts`. **Run state, never save-slot state.**

```ts
export interface RunState {
  // …existing fields…
  /**
   * Ammunition in hand and on the ground. Delve state: it dies with the run.
   * Absent means "not started" — the same trick `Item.dur` uses, so a save
   * written before thrown weapons existed reads as a fresh one.
   */
  thrown?: {
    /** Charges in hand, keyed by base id (not item uid). */
    held: Record<string, number>;
    /** Charges lying on floors. Floors persist, so these do too. */
    ground: { depth: number; x: number; y: number; base: string; n: number }[];
    /** Seconds of recall cooldown remaining. */
    recallCd: number;
  };
}
```

| Event | What happens to charges |
|---|---|
| New delve | `run.thrown` is created empty; the first time a thrown base is equipped, `held[base]` initialises to full |
| Equipping a thrown base for the first time this run | full charges |
| Re-equipping the same base | **no refill** — `held[base]` is still there. Keyed by base id, so swapping between two iron javelins does not reload |
| Equipping a *different* thrown base | that base starts at full |
| Descending / ascending | nothing. Charges left on a floor stay on that floor (floors persist for the whole run) |
| Taking a town portal home and going back down | **same run** — charges and ground markers survive untouched |
| Extracting or dying | run ends; next delve is full |
| Repairing at the forge | **no refill.** Charges are not durability |
| Leaving a floor with charges on it | they are **gone from your hand until you come back**, and the log says so once, in amber: *"You leave 2 javelins behind."* Never a silent loss |

**Migration: none required.** `thrown` is an optional field whose absent state is
already the correct starting state, and the code initialises it inline. If the
project's convention insists on a numbered step anyway, the step is a no-op and
`SAVE_REVISION` moves by one. `SAVE_VERSION` **does not move** under any
circumstance.

### D.8 Durability

Weapon pool is unchanged: `110 × (0.8 + 0.2 × tier)`, 110 at t1 to 198 at t5.

| Action | Durability |
|---|---|
| Melee blow that lands on a monster (1H, 2H, or a thrown weapon's melee) | **1** |
| Sweeping blow | **1**, +1 more if two or more monsters were struck (max 2) |
| Throwing a charge | **0** |
| A thrown charge that **hits** a monster, including a shield chip | **1** |
| A thrown charge that hits a wall or lands on the floor | **0** |
| **Recalling** a charge with R | **1 per charge, hit or miss** |
| Walking over a charge to collect it | **0** |
| A charge abandoned on a floor you left | **0** — you lost the charge, which is worse |

So: hit and walk back = 1. Hit and press R = 2. Miss and walk back = 0. Miss and
press R = 1. The wear model prices laziness and nothing else.

A **broken** thrown weapon still holds its full charges — it just throws them for
25% damage. Do not couple charges to durability: a weapon that hits zero charges
because it broke is an unrecoverable dead end four floors down.

### D.9 UI and controls

- **R** — Recall. Add to the README control table and to §3 of MECHANICS.
- **HUD:** a row of charge pips beside the stamina bar, filled/empty, with the
  count when it exceeds six. An `R` glyph beside it, greyed while the cooldown is
  running or the stamina cost is unaffordable.
- **Touch:** a small round **R** button below the shield button, with the pip
  count on it. Not a long-press on the action button — the action button is
  already overloaded.
- **First time you hit zero charges, once per save:**
  `Out of ammunition. [R] recalls them, or go and get them.`
- **Log lines:** `You retrieve 3 javelins.` / `You leave 2 javelins behind.` /
  `Not enough breath to recall them.` / `Your throwing axes lie on another floor.`

### D.10 A note the renown tree gets for free

§13 records that **Second Wind measures at exactly zero** in
`scripts/upgrades.bench.ts`, "because a slow weapon's stamina regeneration
roughly matches its cost per swing". Thrown weapons break that: a bigger bar is
directly more throws before you have to stop, and the volley-plus-recall cycle is
sized *just over* one bar on purpose. This design gives Second Wind its first
real customer without repricing it. No change to `src/systems/meta.ts`.

---

## E. Numbers

### E.1 The full new table, tier 5, quality 1, no material modifiers

| Weapon | atk | cycle | **DPS** | cost | **dmg/sta** | window | bar dmg | notes |
|---|---|---|---|---|---|---|---|---|
| Great Maul | 58 | 1.20 | 48.3 | 23 | **2.52** | 5.22s | **252** | biggest hit and longest windup in the game |
| Greatsword | 54 | 0.98 | **55.1** | 24 | 2.25 | 4.08s | 225 | |
| Halberd | 50 | 1.00 | 50.0 | 22 | 2.27 | 4.55s | 227 | reach 2 |
| Javelins | 44 | 0.90 | 48.9 | 19 | 2.32 | — | — | **volley-capped**: 4 × 44 = 176 |
| Throwing Axes | 33 | 0.70 | 47.1 | 15 | 2.20 | — | — | volley 6 × 33 = 198 |
| Throwing Knives | 19 | 0.50 | 38.0 | 9 | 2.11 | — | — | volley 8 × 19 = 152 |

Window and bar damage are meaningless for thrown weapons: the charge count binds
long before the stamina bar does. **Volley damage** (`charges × attack`) is the
honest column, and every volley fits comfortably inside one bar — throw
everything, then decide.

### E.2 Arithmetic, shown

**Great Maul, tier 5:** `attack = 32 + 6.5 × 4 = 58`. `cycle = 0.46 + 0.74 =
1.20`. `DPS = 58 / 1.20 = 48.33`. `dmg/sta = 58 / 23 = 2.522`. `swings per bar =
100 / 23 = 4.35`. `window = 4.35 × 1.20 = 5.22s`. `bar damage = 4.35 × 58 =
252.2`.

**Greatsword, tier 5:** `30 + 6 × 4 = 54`. `cycle = 0.38 + 0.60 = 0.98`. `DPS =
55.10`. `dmg/sta = 54 / 24 = 2.250`. `bar = (100/24) × 54 = 225.0`.

**Halberd, tier 5:** `28 + 5.5 × 4 = 50`. `cycle = 1.00`. `DPS = 50.0`. `dmg/sta
= 50 / 22 = 2.273`. `bar = 227.3`.

**Javelins, tier 5:** `26 + 4.5 × 4 = 44`. `cycle = 0.90`. `DPS = 48.89`.
`charges = 2 + floor(4/2) = 4`. `volley = 4 × 44 = 176` for `4 × 19 = 76`
stamina. `recall = 4 × (0.6 × 19) = 45.6`. `effective = 176 / 121.6 = 1.447`.

**Throwing Axes, tier 5:** `17 + 4 × 4 = 33`. `cycle = 0.70`. `DPS = 47.14`.
`charges = 4 + 2 = 6`. `volley = 198` for `90`. `recall = 6 × 9 = 54`.
`effective = 198 / 144 = 1.375`.

**Throwing Knives, tier 5:** `9 + 2.5 × 4 = 19`. `cycle = 0.50`. `DPS = 38.0`.
`charges = 6 + 2 = 8`. `volley = 152` for `72`. `recall = 8 × 5.4 = 43.2`.
`effective = 152 / 115.2 = 1.319`.

### E.3 Time to kill against three reference enemies

Silver (material tier 3), Common, quality 1, no affixes — the metal a player
actually holds on depths 4–5, and the same conditions the existing eight are
measured under below. Silver contributes +3 Holy, which is why undead numbers run
a little hot for everything. **6000 rolls per matchup through
`playerHitsEnemy`**, `depthPower`/`defensePower` at the enemy's home depth.

Reference enemies: **Goblin Cutpurse** (trash, d1, 28 hp, 2 def, slash ×1.4,
pierce ×1.25); **Skeleton Shieldguard** (mid armoured, d3, 100 hp, 9 def, blunt
×1.5, slash ×0.6, pierce ×0.55, 75% shield); **Hollow Knight** (d5, 405 hp, 20
def, blunt ×1.2, pierce ×1.25, slash ×0.7, 75% shield).

**The new six:**

| Weapon (silver) | atk | Goblin | Skeleton Shieldguard | Hollow Knight |
|---|---|---|---|---|
| Great Maul | 45 | 46.0 ×1 → **1.20s** | 57.6 ×2 → **2.40s** | 32.6 ×13 → **15.60s** |
| Halberd | 39 | 49.7 ×1 → **1.00s** | 21.9 ×5 → **5.00s** | 29.8 ×14 → **14.00s** |
| Greatsword | 42 | 59.2 ×1 → **0.98s** | 24.8 ×5 → **4.90s** | 19.3 ×21 → **20.58s** |
| Javelins | 35 | 44.8 ×1 → **0.90s** | 20.2 ×5 → **4.50s** | 27.1 ×15 → **13.50s** |
| Throwing Axes | 25 | 36.5 ×1 → **0.70s** | 16.8 ×6 → **4.20s** | 12.9 ×32 → **22.40s** |
| Throwing Knives | 14 | 19.7 ×2 → **1.00s** | 11.2 ×9 → **4.50s** | 12.9 ×32 → **16.00s** |

**The existing seven metal weapons, identical conditions:**

| Weapon (silver) | atk | Goblin | Skeleton Shieldguard | Hollow Knight |
|---|---|---|---|---|
| Long Sword | 32 | 45.8 ×1 → 0.74s | 20.1 ×5 → 3.70s | 15.5 ×27 → 19.98s |
| War Axe | 43 | 60.6 ×1 → 0.98s | 25.3 ×4 → 3.92s | 19.7 ×21 → 20.58s |
| Mining Pick | 34 | 43.6 ×1 → 0.84s | 19.7 ×6 → 5.04s | 26.4 ×16 → 13.44s |
| Spear | 28 | 36.4 ×1 → 0.80s | 17.2 ×6 → 4.80s | 22.3 ×19 → 15.20s |
| Mace | 24 | 25.9 ×2 → 1.60s | 33.1 ×4 → 3.20s | 19.0 ×22 → 17.60s |
| Short Sword | 20 | 29.7 ×1 → 0.54s | 14.5 ×7 → 3.78s | 11.0 ×37 → 19.98s |
| Dagger | 11 | 16.1 ×2 → 0.76s | 9.9 ×11 → 4.18s | 10.8 ×38 → 14.44s |

**Reading these honestly.** Three caveats, all of which cut against the new
weapons:

1. **They ignore the 75% shield.** Both armoured references carry one, and every
   frontal blow into a held guard lands for 25%. The two-handers sag that guard
   in 2 chips instead of 3; the thrown weapons chip it safely but at full stamina
   price. The Great Maul's 2.40s against a Skeleton Shieldguard is a *raw* number
   — the real fight includes the guard rhythm.
2. **They ignore charge limits.** A silver Javelin holds 3. Three throws is
   `3 × 27 = 81` of a Hollow Knight's 405. The 13.50s figure is what the *first*
   three throws imply, not a fight you can have. Against a Goblin (one throw) or
   a Skeleton Archer, the charge count is not binding and the number is real.
3. **They ignore that a two-hander has no shield.** The Hollow Knight hits for
   29.2 against the depth-5 ladder build. Take away 12 Defense and 82% Block and
   a 20-second fight is a very different 20 seconds.

The Great Maul's Skeleton Shieldguard line is the design working: **57.6 per hit,
the highest single number in either table by 90%** — blunt ×1.5 on a weapon big
enough to use it. That is the hole in §A.2(3), closed, and paid for with the
shield you would otherwise be blocking that Shieldguard with.

### E.4 The ranking table — nothing new is strictly better

**By effective DPS, tier 5** (new bases in bold):

| # | Weapon | DPS | | # | Weapon | DPS |
|---|---|---|---|---|---|---|
| 1 | Long Sword | 58.1 | | 8 | **Great Maul** | **48.3** |
| 2 | **Greatsword** | **55.1** | | 9 | **Throwing Axes** | **47.1** |
| 3 | Short Sword | 51.9 | | 10 | Spear | 46.3 |
| 4 | War Axe | 51.0 | | 11 | Dagger | 44.7 |
| 5 | **Halberd** | **50.0** | | 12 | Mace | 41.3 |
| 5= | Mining Pick | 50.0 | | 13 | **Throwing Knives** | **38.0** |
| 7 | **Javelins** | **48.9** | | 14 | Club | 33.3 |

**The Long Sword is still the DPS king.** Nothing added takes the top of this
table, and the best new weapon on it — the Greatsword — is 5% behind while giving
up 82% block.

**By damage per stamina, tier 5:**

| # | Weapon | dmg/sta | | # | Weapon | dmg/sta |
|---|---|---|---|---|---|---|
| 1 | **Great Maul** | **2.52** | | 8 | **Throwing Knives** | 2.11* |
| 2 | **Javelins** | 2.32* | | 9 | Mining Pick | 2.10 |
| 3 | **Halberd** | **2.27** | | 10 | Mace | 1.94 |
| 3= | War Axe | 2.27 | | 11 | Club | 1.83 |
| 5 | **Greatsword** | **2.25** | | 12 | Long Sword | 1.79 |
| 6 | **Throwing Axes** | 2.20* | | 13 | Short Sword | 1.75 |
| 7 | Spear | 2.18 | | 14 | Dagger | 1.70 |

\* Thrown weapons only reach this figure if you **walk over and collect them**.
With R, the true figures are **1.45 / 1.38 / 1.32 — the three worst in the game,
all below the Dagger.**

**The Great Maul leads this table by 11% over the War Axe. That is the single
number in this design where anything new is best at anything**, and it costs the
shield, 5% DPS, and the longest windup in the game (0.46s against the War Axe's
0.36s — you are committed a full half-second before the hit).

**Pairwise sanity, the four comparisons a playtester will actually make:**

| | keeps | gains | loses |
|---|---|---|---|
| Greatsword vs Long Sword | — | +26% per hit, +26% damage per bar, a sweep, a stagger, double chips | 5% DPS, **12 Defense and 82% Block** |
| Great Maul vs War Axe | — | +16% per hit, +11% per stamina, a sweep, a stagger, double chips, blunt | 5% DPS, **the shield**, the slowest windup in the game |
| Halberd vs Spear | reach 2 | +8% DPS, +4% per stamina, a 0.5s stagger, double chips | **the shield** |
| Javelins vs Spear | — | 3–4 throws at seven tiles, safe guard-chipping | **25% melee DPS** when empty, and a walk |

None of these is a free upgrade. Every one is a question.

---

## F. What could go wrong

### F.1 The doorway turret

*A playtester finds a corridor mouth, throws until empty, presses R, and never
lets anything reach them. Ranged trivialises hard mode.*

Five stacked guards, all already stated in §D.4:

1. **Point-blank is melee** — the doorway does not stop things arriving, it only
   queues them, and when one arrives you are holding a bad short spear.
2. **A volley plus a recall costs more than one full stamina bar** for all three
   thrown weapons (115 / 144 / 122 against a 100-stamina bar).
3. **Stamina regen is gated on idle**, so the loop has a mandatory ~5.5s rest in
   it — the same throttle a held attack button already meets.
4. **R has a 6s cooldown.**
5. **Recall costs 1 durability per charge, walking costs 0.** ~50 recall presses
   breaks a javelin.

**Pre-authorised nerf if it still measures hot:** raise the recall multiplier
from **0.6 → 0.8** of a throw's stamina cost. One constant. At 0.8 the best
effective efficiency in the thrown set drops from 1.45 to **1.29**, 24% below the
Dagger. Ship at 0.6 and measure.

### F.2 The maul room-wipe

*Sweep, plus the parry's ×2 vulnerability, plus three adjacent enemies: one
54-attack swing deletes a room for 23 stamina.*

Worst case at tier 5: `58 × 2 × 3 = 348` damage from one swing. That is real, and
it should be — parrying without a shield and answering with a sweep is the
payoff the entire two-handed design is selling. What keeps it from being routine:

1. **It needs three enemies standing in three specific tiles** — the one you face
   and the two beside you. In a one-wide corridor, which is most of the dungeon,
   the flanks are walls.
2. **A parry only fires against one attacker**, and `MELEE_PARRY_SPLASH_STUN`
   already staggers the others for 0.25s, which is enough to break up the
   near-simultaneous approach that would produce the three-target case.
3. **Durability caps at 2 per sweep**, so wiping rooms still costs.
4. **A sweep never triggers `shieldBash`** — but each swept tile still runs
   `guardReaction` independently, so a room of shieldbearers is not free.

**Pre-authorised nerf:** `SWEEP_FLANK_MULT`, applied to the two flanking tiles
only. **Ship it at 1.0** so the constant exists and the tests read it; if the
playtest harness shows rooms evaporating, set it to **0.6** and the worst case
drops from 348 to 244 with no redesign.

### F.3 The vanished shield

*A player with a moonsilver Tower Shield equips a Greatsword. The code helpfully
un-equips the shield into a pack with no free slot, and it is deleted, or dropped
on the floor of a town, or the equip silently fails.*

This is the one that eats a save, and it is the reason C.6 is written the way it
is.

1. **Equipping a two-hander never mutates `state.equipment`.** The shield stays
   in `equipment.offhand`. There is no code path that moves it, so there is no
   code path that loses it.
2. **The exclusion is at derive time only** — one `continue` in `derivePlayer`'s
   slot loop.
3. **`SAVE_VERSION` and `SAVE_REVISION` both stay put.** Two-handedness is a
   property of `ITEM_BASES`; an `Item` still stores only its `ref`. Nothing about
   any existing save is rewritten.
4. **Required regression:** the 2026-09-12 fixture in
   `src/__tests__/persistence.test.ts` must round-trip byte-identically, plus the
   five `derivePlayer` assertions listed in C.6.

The related trap, worth one test of its own: **a player must not be able to wear
a Tower Shield "for the stats" behind a Greatsword.** Assert that `stats.defense`
and `stats.block` both exclude the stowed offhand, and that its *affixes* do too
(`itemStats` is skipped wholesale, so they will — assert it anyway).

---

## G. Art requirements

Icons are **16×16** palette-indexed character grids (`src/art/icons.ts`).
Viewmodels are **24×40**, right hand at the bottom, ramp characters `1`–`4`
recoloured by the weapon's primary material (`src/art/viewmodels.ts`). The
existing `HAND` block occupies the bottom 14 rows, leaving ~26 rows of weapon.

`src/__tests__/art.test.ts:45` asserts a viewmodel exists for every weapon base,
so all six viewmodels must land in the same change as the bases.

### The two-handers — the shared read

All three two-handed viewmodels must show **both hands on the haft**: the
existing `HAND` at the bottom right, plus a **second, smaller fist ~10 rows above
it and 3–4 columns left**, gripping the same shaft. That two-fist stack is the
instant, unmistakable "you have no shield" tell at 24×40, and it must be the
first thing the eye finds. Hold the weapon **more centred** than the one-handers
(shaft around column 10–12 rather than 10–14) — a two-hander is carried in front
of the body, not out to the side.

| id | icon | viewmodel | Silhouette |
|---|---|---|---|
| `great_maul` | `ic_great_maul` | `vm_maul` | A **square block head**, 8–9 px wide and 6 tall, sitting on a thick shaft — the widest, heaviest silhouette in the set, roughly twice `vm_blunt`'s head. Read it against the Mace by *shape*: the mace head is round and flanged, the maul head is a rectangular slab with a chamfered top edge and a single bright ramp-4 highlight along its striking face. The shaft is visibly thick (3 px, not 1–2) and banded with two dark rings. At 24×40 it should look like it barely fits in frame. |
| `vm_polearm` | `ic_halberd` | `vm_polearm` | A **long thin shaft running the full height of the frame** with a compound head at the very top: an axe blade on the left, a spike on the right, a point above. It must read as *taller and thinner* than `vm_spear` — the spear is a plain point on a shaft; the halberd is a spear that grew a hatchet. Keep the head inside the top 8 rows and leave 2 px of frame above it so it reads as reaching further. Both hands are low and close together. |
| `greatsword` | `ic_greatsword` | `vm_greatsword` | A **wide straight blade**, 5–6 px across against `vm_blade`'s 3, running from row 0 down to a **prominent cross-guard around row 24** that is noticeably wider than the blade — 12–14 px, nearly half the frame. The guard is the tell: `vm_blade`'s is a thin 3-row bar, this one is a heavy bar with drooping quillons. A fuller (a 1 px dark line) runs the blade's length so the width reads as a blade and not a plank. Long ricasso between guard and upper hand. |

### The thrown weapons

Thrown viewmodels are held **cocked back and low**, not extended: the weapon
should sit in the lower-right quadrant angled up-left, as if about to be thrown
rather than swung. That pose difference is what distinguishes them from
`vm_blade`/`vm_axe` at a glance.

| id | icon | viewmodel | projectile | ground | Silhouette |
|---|---|---|---|---|---|
| `throwing_knives` | `ic_throwing_knives` | `vm_thrown_knife` | `proj_knife` | `pickup_knives` | Viewmodel: **three narrow leaf-blades fanned in the fist**, two behind the front one and offset 2 px each, tips up-left. Read against `vm_blade` by the fan — it is deliberately three of something small, never one of something big. Icon: three crossed knives against a hide bandolier strap. Projectile: a **3×5 px blade with a 2 px dark tail**, spinning (two frames, horizontal/diagonal); much smaller than `proj_arrow`. Ground: two or three knives **stuck point-down in the floor at slight angles**, casting a small shadow. |
| `throwing_axes` | `ic_throwing_axes` | `vm_thrown_axe` | `proj_axe_thrown` | `pickup_axes` | Viewmodel: **a short hatchet held down and back at the hip**, blade up-left, haft only ~8 px of visible wood. Read against `vm_axe`: the war axe fills the frame diagonally with a big bearded head, this is a small head on a stub haft, held low. A **second hatchet head peeks over the wrist** to say there is a stock of them. Projectile: a **5×5 px axe head with a 3 px haft, rotating** — two frames at 45° apart, big enough to read against a wall. Ground: two hatchets **lying flat, crossed**. |
| `javelins` | `ic_javelins` | `vm_javelin` | `proj_javelin` | `pickup_javelins` | Viewmodel: **a long shaft entering bottom-right and running up-left out of the top-left corner**, with a narrow diamond head visible around rows 4–8, cocked overhand. It must not be confused with `vm_spear`, which is centred and vertical and pointing away — this one is **diagonal and clearly wound up**. A leather grip-wrap (2 px of the hide ramp) at the fist. Icon: two javelins crossed in an X, heads up. Projectile: an **8 px long, 2 px thick shaft with a bright 3 px head**, no rotation — javelins fly point-first; the longest projectile sprite in the game. Ground: **one or two javelins standing at ~60°, butt in the floor, head up** — deliberately the tallest ground marker so a javelin is findable across a dark room. |

### Shared requirements for ground markers

- Ground sprites follow the existing convention (`pickup_bag`, `pickup_gold` in
  `src/render/dungeon-renderer.ts`) and are **floor-oriented billboards**, not
  upright ones — except the javelin, which stands.
- All three must be **legible in torchlight at 3–4 tiles** against both the
  Catacombs' pale stone and the Burrows' dark earth. Give each a 1 px near-black
  outline and put the brightest ramp value on the metal.
- Each takes the **weapon's primary material ramp**, so a copper knife and a
  star-iron knife are visibly different objects on the floor. That is what makes
  "which of these three piles is mine" answerable.
- When a tile holds more than one charge, the renderer draws the same sprite once
  with a small count glyph. **Do not author per-count variants.**

---

## Open questions and safe defaults

| Uncertain | Safe default |
|---|---|
| Is the recall's 0.6× stamina multiplier right? | Ship 0.6, measure, raise to 0.8 if the harness shows the turret working. One constant. |
| Is the sweep's three-tile hit too strong in rooms? | Ship `SWEEP_FLANK_MULT = 1.0`; the constant exists so it can go to 0.6 without a redesign. |
| Is the Great Maul's 2.52 damage per stamina — 11% over the War Axe — too much? | It is the only leading number in the design and it costs the shield. If a playtest says otherwise, the knob is the stamina cost: 23 → 25 drops it to 2.32, level with the Javelin. |
| Should `blueprintDropWeight` special-case the 2H singletons? | Yes — add `blueprintWeight?: number` on `RecipeDef` and set 0.16 on all three. Without it a Greatsword blueprint drops as often as a Dagger's. |
| Six new bases against eight existing is a 75% roster expansion. Too many? | If it has to be cut to five, cut **`throwing_knives`** — it is the least load-bearing (an entry teaching tool), and the thrown line survives as `['throwing_axes', 'javelins']`. Do not cut a two-hander: three is the minimum for the 2H tier to carry all three damage types, which is what stops "go two-handed" also meaning "go slash". |
| Does the Mining Pick's near-redundancy (§A.2.4) need fixing here? | **No.** Out of scope, and fixing it by nerfing the Spear would move a shipped, tuned number. Flagged for a separate pass. |
| `WeaponClass` on disk includes `'bow'`. Should there be a bow? | **Not in this pass, and preferably not at all.** A bow breaks three of this design's load-bearing rules at once: its ammunition is a separate consumable rather than the weapon itself, so the recall loop has nothing to recall; it cannot melee, so "point-blank is melee" — the guard that keeps ranged honest — has no answer; and reusable arrows at a distance of 8 with no walk is the free-power case §D.4 exists to prevent. If a bow ships later it needs its own spec and its own answer to the turret. Leave the enum member as dead weight or drop it. |

## Documentation to update on landing

- **MECHANICS §9** — the item-base table (six rows), the *Weapon handling*
  classes (a fourth class: **Thrown**), the corrected Club stamina cost (16 → 12)
  and the corrected blunt average (1.13 → 1.10).
- **MECHANICS §2** — the block line: add "20% with a two-handed weapon".
- **MECHANICS §3** and the **README control table** — the **R** key.
- **MECHANICS §7 Durability** — the *What costs a point* table: sweeps, throws
  and recalls.
- **MECHANICS §15** — a line confirming `run.thrown` is additive and neither save
  number moved.
