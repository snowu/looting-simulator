# Looting Simulator — Mechanics Reference

Every system, with the numbers that are actually in the code. Keep this updated when you change a data file or a formula; each section names the file it comes from.

Last synced with the build of 2026-09-12.

---

## 1. The loop

One run is one **day**.

1. **Town (Hollowmere).** Sell, buy, craft, take contracts, spend renown, equip.
2. **Descend.** Six floors, each generated from the run seed and kept for the whole run, so you can walk back up.
3. **Come home** by the stairs you came down (floor 1's up-stairs is the exit) or through the portal left by the boss. A **Scroll of Recall** instead opens a two-way town portal, which does *not* end the day.
4. **Day advances**: market prices move, events tick, contracts age, the board is topped up, the merchant restocks.

Dying ends the day too, but you lose the backpack.

*Files: `src/systems/run.ts`, `src/main.ts`*

---

## 2. The player

*Files: `src/systems/player.ts`, `src/systems/combat.ts`, `src/world/world.ts`*

| Property | Value |
|---|---|
| Base health | 70 (+12 per Toughness level, + item Health) |
| Base stamina | 100 (+15 per Second Wind level, + item Stamina) |
| Health regeneration | **None.** Potions, shrines and life leech only |
| Stamina regeneration | 34/s, starting 0.5s after your last swing; 30% of that while blocking |
| Unarmed | 3 attack, 0.14s windup, 0.30s recovery, 9 stamina, reach 1 |
| Step | 0.24s per tile; backwards ×1.25; ×1.2 more if Speed < −12 |
| Turn | 0.17s per 90°, then a 0.16s pause before a held turn repeats |

**Stat list:** Attack, Defense, Health, Stamina, Block %, Speed %, Crit %, Loot Find %, Life Leech %, and four elemental damage stats (Fire, Frost, Shadow, Holy). Speed divides weapon windup and recovery (`1 + speed/100`, floor 0.5).

### Damage

Mitigation is `attack × max(0.2, 1 − defense/(defense + k))`, so armour never blocks more than 80%.

**Your hits:** `mitigate(attack, enemyDefense, k=15) × resistance` + each elemental stat × its resistance, then × stamina power × random 0.9–1.1. Crits are `Crit %` (capped 60%) for ×1.6.

**Stamina power:** `0.4 + 0.6 × min(1, stamina / (maxStamina × 0.5))`. At or above half stamina you hit full strength; empty, you do 40%.

**Their hits:** `mitigate(attack × 1.15, defense, k=25) × random 0.85–1.15`. Elemental attacks ignore half your armour. `ENEMY_DAMAGE_MULT = 1.15` is the global difficulty knob.

**Blocking:** absorbs `Block %` of a hit (shield stat; 30% with just a weapon, 12% bare-handed) and costs `absorbed × 1.3` stamina. Out of stamina, the guard breaks: you take the rest and the block drops. Blocking only works against attacks from the tile you face.

### Parrying

Raising the guard opens a **0.22s window**. A hit that lands inside it is not absorbed — it is denied outright, for no damage and no stamina.

| | |
|---|---|
| Window | 0.22s from the moment the guard starts to rise |
| Cooldown | 0.75s, measured from when the window opened |
| Cost | Nothing. The cost is the risk of mistiming it |
| Requires | Facing the attack. No shield needed — a weapon or bare hands parry the same |
| Tell | Your shield flares pale gold while the window is open |

**Holding the guard up does not parry.** The window only opens on the *rising edge*, and the cooldown means at best one attempt per 0.75s — against wind-ups of 0.35–0.8s you have to meet the swing, not sit behind the shield. Mistime it and it is a normal block, so there is no cliff.

**Against melee:** the attacker is staggered for **1 second** (never shorter than the recovery it would have had) and takes **double damage** for that whole second. Bosses are not exempt — this is the only way to open the Ashen King up, since he cannot be staggered out of his wind-up.

**Against ranged:** the bolt is **reflected**, keeping its damage and element, and flies back the way it came. A reflected bolt hits **the first monster in its path** — which is usually the archer that fired it, but is whatever is standing in between. Incoming bolts still pass through monsters, so an archer's escort only shields it *after* you turn one around. Damage uses the target's own resistance, so a Flame Wraith's bolt turned onto a Frost Wisp lands at ×2.

A volley (the boss fires three) only loses one bolt to a parry: a parry spends the window.

*Files: `src/world/world.ts` — `PARRY_WINDOW`, `PARRY_COOLDOWN`, `PARRY_STUN`, `PARRY_VULN_MULT`*

**Life leech:** heals `damage × leech%` on every hit that lands.

---

## 3. Controls

See the README table. In short: W/S step, A/D turn, Q/E strafe, Space attack, Shift block, F interact, 1–4 consumables, I pack, M map, Esc pause. On touch: drag anywhere to walk and turn, tap or press the big button for the context action, hold the shield to block.

**The one-button action** (tap the view, or the big button) swings at anything in reach and otherwise does whatever **[F]** would. One exception: a loot pile **underfoot never steals the swing while something is alive within 2 tiles**, or within 4 and hunting you. Killing the first of two monsters drops loot on your tile, and without that rule every tap became the loot window instead of a hit on the second one. Doors, stairs and portals still win over the swing, because running is a legitimate answer to a fight. **[F]** is unaffected — looting on the keyboard is always deliberate.

---

## 4. The dungeon

*File: `src/systems/dungeon.ts`*

Floors are generated from `hash(runSeed, depth)`, so the same seed always gives the same dungeon, and they persist for the whole run.

| Step | Rule |
|---|---|
| Size | `31 + 4 × min(depth−1, 4)` tiles square → 31 at depth 1, 47 at depth 5+ |
| Rooms | Target `9 + min(depth, 5)`; 18% are halls (6–9 × 5–8), the rest 3–6 × 3–5, always 2 tiles apart |
| Corridors | Minimum spanning tree over room centres, plus 20% extra links for loops; carved by Dijkstra that prefers existing tunnels and avoids cutting through other rooms |
| Doors | 45% of eligible room entrances (a 1-tile gap flanked by wall) |
| Vault | One dead-end room per floor, locked; its key is placed in a room reachable without it |
| Secret room | `50% + 6% × depth`: a 3×3 room behind a pushable wall, marked with a faint chalk X |
| Shrine | 45% of floors |
| Pillars | Rooms of at least 6×5 get pillars, never blocking a route |
| Stairs | Carved as alcoves — up in the start room, down in the farthest room; the boss floor has no down stairs |
| Torches | Placed on room walls, at least 5 tiles apart, density per biome; always one at the arrival point |
| Props | Normal rooms: 35% a chest, 0–3 urns/barrels, 50% bones. Treasure rooms: a chest (+30% a second) and 2–4 urns. Vault: two vault chests |
| Enemies | `4 + 2 × depth + rooms/3`, never within 7 tiles of the arrival point; 15% spawn wandering in corridors instead of rooms |
| Loose loot | `3 + depth` piles: 55% coins (`3–8 × depth`), otherwise a material stack |
| Traps | `2 + 1.5 × depth`, 70% in corridors, at least 4 tiles apart, never within 3 of the arrival tile; 70% of treasure/vault/secret rooms also get one inside |

Every generated floor is checked: all walkable tiles reachable, keys reachable without their own vault, stairs present. Failed layouts are regenerated (up to 40 attempts).

**Fog of war:** tiles within 2 (line of sight) plus a corridor cone 8 tiles ahead are revealed as you walk. The minimap and the M map only show explored tiles.

### Biomes

| Depths | Name | Doors | Notes |
|---|---|---|---|
| 1–2 | The Ossuary | Wood | Stone brickwork, bone niches, warm torchlight |
| 3–4 | The Deep Mines | Wood | Rubble walls, timber supports, dirt floors |
| 5 | The Glowing Warrens | Iron | Wet stone, glowing fungus (light sources), darkest biome |
| 6 | The Ashen Throne | Iron | Obsidian with glowing mortar, banners, the boss |

---

### Depth 6 — The Ashen Throne (the boss floor)

Depth 6 is the bottom (`FINAL_DEPTH = 6`); there are no stairs down, only the way you came. It is generated differently from the floors above:

- A **9×11 throne room** is placed first, and the rest of the floor (8 rooms instead of `9 + depth`) is fitted around it.
- The throne room is forced to be a **dead end**: it gets exactly one connection, no loop links, and its entrance is an **iron door**.
- You arrive in the room **farthest from the throne**, so there's a floor to cross before the fight.
- **The Ashen King** waits two tiles inside, flanked by **two Hollow Knights**. The floor also carries 3 more wanderers than the usual `4 + 2 × depth + rooms/3`.
- Only the deep roster spawns here: **Ghouls, Frost Wisps, Hollow Knights, Flame Wraiths**. Skeletons stop at depth 4, archers and spiders at 5.
- Vaults, secret rooms (86% chance at this depth) and shrines still generate as normal. The key here is the **Ashen Key**.
- The biome has the densest torches of the game, iron doors and obsidian walls whose mortar glows.

**The fight.** 420 HP, 24 attack, 12 defense. It swings when adjacent and fires a **three-bolt shadow volley** when you line up at range 2+. It is immune to shadow, resists pierce (×0.8), takes ×1.5 from holy, and **can never be staggered** out of its wind-up — step out of the tile it aims at, block, or **parry**, which is the one thing that does stagger it and opens a second of double damage. Its volley can be parried a bolt at a time, and the returned bolt is shadow, which it is immune to — so reflect it into the Hollow Knights beside it instead.

**On its death** it drops a guaranteed **Legendary and an Epic item plus a blueprint**, star iron, shadow essence, a jewelled skull, 50% a dragon scale and 150–300 gold — dropped on a tile *beside* the king, because a **portal** opens on the tile he fell on and would otherwise bury the hoard. Killing it is worth **+25 renown** on top of the usual extraction reward (so 39 for a depth-6 extraction).

There is nothing below. Each new run rolls a fresh seed, so depth 6 can be farmed.

## 5. Monsters

*File: `src/data/enemies.ts`*

| Monster | Depths | HP | Atk | Def | Type | Resists / weaknesses | Behaviour | Windup | Recovery | Step | Sight |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Giant Rat | 1–3 | 10 | 4 | 0 | pierce | — | melee | 0.38 | 0.65 | 0.30 | 6 |
| Goblin Cutpurse | 1–3 | 20 | 6 | 1 | slash | — | skittish | 0.45 | 0.70 | 0.40 | 7 |
| Skeleton | 1–4 | 22 | 7 | 2 | slash | undead: blunt ×1.5, holy ×2, pierce ×0.5, slash ×0.8, shadow ×0.5 | melee | 0.55 | 0.90 | 0.55 | 7 |
| Skeleton Archer | 2–5 | 18 | 7 | 2 | pierce | as undead | ranged (arrow, speed 7, range 5) | 0.75 | 1.40 | 0.50 | 8 |
| Cave Spider | 3–5 | 24 | 9 | 2 | pierce | fire ×1.5 | melee | 0.35 | 0.60 | 0.28 | 5 |
| Ghoul | 3–6 | 48 | 13 | 4 | slash | holy ×2, fire ×1.3, shadow ×0.5 | melee | 0.65 | 1.00 | 0.75 | 6 |
| Frost Wisp | 4–6 | 26 | 10 | 1 | frost | **fire ×2**, frost ×0, pierce ×0.6, slash ×0.8 | ranged (frost bolt, speed 5, range 4) | 0.80 | 1.60 | 0.45 | 8 |
| Hollow Knight | 5–6 | 80 | 16 | 9 | slash | holy ×1.6, blunt ×1.2, pierce ×0.7, shadow ×0.5 | melee | 0.70 | 1.00 | 0.65 | 7 |
| Flame Wraith | 5–6 | 50 | 14 | 2 | fire | **frost ×2**, fire ×0, pierce ×0.6, slash ×0.8 | ranged (fire bolt, speed 5.5, range 4) | 0.75 | 1.40 | 0.50 | 8 |
| Mimic | any chest | 52 | 14 | 5 | pierce | blunt ×1.25, fire ×1.35 | fast melee; dormant until opened | 0.52 | 0.80 | 0.32 | 8 |
| The Ashen King | 6 (boss) | 420 | 24 | 12 | shadow | holy ×1.5, shadow ×0, pierce ×0.8 | boss: melee + 3-bolt volley | 0.80 | 1.00 | 0.80 | 12 |

Spawn weights: rat/goblin/skeleton/spider 3, archer/ghoul/wisp 2, knight/wraith 1.5. Mimics never enter the ordinary spawn pool. Monsters deeper than their `minDepth` get `+12% HP per depth` and the same bonus to damage.

### Monster drops

| Monster | Materials | Gold | Gear chance |
|---|---|---|---|
| Giant Rat | rat hide 60% (1–2), bone 25% | 0–2 | — |
| Goblin Cutpurse | copper 50%, linen 40%, timber 30%, bone idol 10% | 3–12 | 15% |
| Skeleton | bone 70% (1–3), iron 35% | 0–6 | 12% |
| Skeleton Archer | bone 60%, timber 30%, yew 25% | 0–8 | 10% |
| Cave Spider | spider silk 60%, crystal 8% | 0–4 | 5% |
| Ghoul | bone 50%, leather 50%, silver chalice 12% | 5–20 | 20% |
| Frost Wisp | frost shard 45%, crystal 35%, moonstone 8% | 0–5 | 8% |
| Hollow Knight | iron 80% (2–3), silver 40%, moonsilver 8%, candelabra 10% | 10–40 | 45% |
| Flame Wraith | flame shard 45%, gold 20%, emerald 8%, tome 8%, shadow essence 5% | 5–25 | 25% |
| Mimic | the exact tier of hoard hidden by its chest disguise | chest roll | chest roll |
| The Ashen King | star iron ×1–2, shadow essence ×1–2, jewelled skull, dragon scale 50% | 150–300 | guaranteed Legendary + Epic + a blueprint |

Every kill also has a 6% chance of a Healing Draught and `1.2% × depth` of a blueprint. Loot find multiplies material chances by `1 + find/200` and gear chance by `1 + find/100`.

### Monster AI

*File: `src/world/world.ts`*

- **Idle / wander:** a step every 1.2–3.2s, staying within 3 tiles of where it spawned.
- **Noticing you:** needs line of sight within its sight range; walls, pillars and closed doors block it. Alert lasts 6 seconds after losing sight (8 if you hit it), during which it paths to where it last saw you.
- **Chasing:** breadth-first pathfinding, recomputed about 3 times a second, up to 18 tiles. Closed doors block monsters, so shutting one behind you works.
- **Attacking (the telegraph):** the monster commits to the tile you are standing in, leans in and flashes red for its windup, then strikes. **Step out of that tile and it misses.** Then it's in recovery and can't act.
- **Staggering:** hitting a monster with under 40 base HP during its windup interrupts it (0.5s recovery). Bosses never stagger.
- **Ranged:** only fire along a row or column with clear sight. They back away if you close to melee and sidestep to line up a shot. Bolts travel tile by tile, so strafing out of the line dodges them.
- **Skittish** (goblins): flee below 35% health.
- **Boss:** melee when adjacent, otherwise a three-bolt shadow volley when aligned.

---

## 6. Interacting

*File: `src/world/world.ts`*

| Thing | What happens |
|---|---|
| Door | Opens/closes. Monsters can't open them |
| Locked door (vault) | Needs that floor's key, which is always findable without it; consumes the key |
| Chalk-marked wall | Push it aside to open a secret room |
| Chest | Opens into the loot window; gold goes straight to your purse. 12% are mimics: two pale points in the lid seam are the quiet tell |
| Urn / barrel | Smash by attacking or interacting; small loot |
| Shrine | One of three flavours — see below. The prompt names it before you touch it |
| Stairs | Walk into the alcove. Floor 1's up-stairs leaves the dungeon |
| Portal | Appears when the boss dies; steps you home and ends the run |
| Town portal | Opened by a Scroll of Recall; steps you to Hollowmere with the run still going |
| Loot pile | Coins and keys are picked up automatically; items open the loot window |

### Shrines

A shrine serves one of three gods, fixed per floor and rolled from its own seed stream. **You can tell which before you pray**: the flame, the orb and the light it throws across the room are a different colour, and the prompt names it. Praying is a decision, not a coin toss. Weights are font 4, idol 4, stone 3.

| | Colour | Prompt | What it does |
|---|---|---|---|
| **Font of Mending** | cold blue | *Drink at the font* | Full health and stamina, and **lifts a curse**. Never harms you |
| **Hollow Idol** | violet | *Pray at the hollow idol* | **60%**: full restore and a blessing. **40%**: a curse for the rest of the run |
| **Offering Stone** | gold | *Offer N gold at the stone* | Costs `30 + 25 × depth` carried gold for a full restore and a blessing. Too poor? It stays unused — come back with the coin |

**Blessings** (one per run): Fortune (+30% loot find), Fury (+25% damage), Warding (+5 defense).

**Curses** (one per run, independent of your blessing — you can carry both):

| Curse | Effect |
|---|---|
| Frailty | −15% maximum health |
| Leaden Limbs | −12 speed |
| Dulled Edge | −20% damage |
| Hunted | monsters see you 2 tiles further |

A curse lasts until a **font** washes it off or the run ends, which is what makes crossing a floor for a blue light worth doing. Once you already hold a blessing an idol has little left to give you and the same 40% to take — so the second idol of a run is usually a worse bet than the first, and leaving it alone is a legitimate play.

**Scroll of Recall:** 5 seconds of standing still, then a **town portal** tears open on the tile in front of you. Moving, attacking or being hit cancels the reading.

### The town portal

Diablo's, in short: a two-way door that costs one scroll for the round trip.

- Stepping through puts you in **Hollowmere with the run still open** — the day does not advance, the market does not move, contracts do not age, and the dungeon is exactly as you left it.
- The coin you were carrying is **banked into your purse** on arrival, so you can spend what you found. It is no longer at risk if the rest of the delve goes badly.
- In town the Descend button becomes **Step back through the portal**. It drops you on the portal's own tile, at the depth you left from, and the portal **closes behind you**.
- **One at a time.** Reading a second scroll collapses the first portal and opens a new one where you stand.
- The portal is part of the save, so closing the browser in the middle of a portal trip and coming back still works.

*Note that this is strictly better than the old behaviour, where a Recall ended the run: the scroll now buys a shopping trip rather than an exit.*

---

## 6a. Traps

*Files: `src/systems/dungeon.ts` (placement), `src/world/world.ts` (`TRAPS`, spotting, springing)*

Every trap starts **hidden and armed**. You spot one by looking at it: the tiles ahead down a clear line (**two**, or **three** with Lantern Wick) and the four tiles beside you are checked on every step and every turn. Spotting is not a dice roll — it is whether you were looking. A held W down a corridor gives you one step of warning, which is the whole point.

A spotted trap is drawn as a floor decal — cold iron against warm stone, so it reads by hue and value if you are looking at the floor, without glowing or being labelled. It stays marked on the automap (orange armed, grey spent) and can be disarmed with **[F]** from the tile in front.

**Nothing shouts at you.** Springing one plays its sound, shakes the frame and names it in the log ("The floor gives way onto spikes!") — the same weight as taking any other hit. A first careless run down a corridor should cost you; what the game owes you is the means to do better next time, which is: the plate is genuinely visible, the log tells you what hit you, the sprung trap stays on the floor and the map to be looked at, and the disarm prompt appears when you face one.

| Trap | Damage | Type | On top of that |
|---|---|---|---|
| Dart trap | `5 + 3 × depth` | pierce | Fires from a pinhole in an adjacent wall |
| Spike pit | `9 + 5 × depth` | pierce | The heavy one: 39 at depth 6, before armour |
| Alarm ward | none | — | Every monster within 12 tiles gets 10s of alert pointed at the ward |

Damage goes through the normal mitigation, so armour and Warding help; **blocking does not**, since a trap is under you rather than in front of you. Each trap fires once and is then spent.

**Disarming always works** — the skill was noticing it, not fiddling with it. It yields salvage 60% of the time (25% for wards): iron or timber from a dart, iron or copper from spikes, bone or linen from a ward. That is what makes clearing one worth the detour instead of walking around it.

**Monsters set them off too**, taking 80% of the listed damage with no mitigation. Backing over a spike pit you have already found and letting a Hollow Knight follow you across it is a legitimate tactic.

Placement weights: 45% dart, 35% spikes, 20% ward. Treasure, vault and secret rooms are seeded first and prefer spikes, so greed is what gets guarded.

---

## 7. Loot and items

*File: `src/systems/items.ts`*

An item is **base × material × rarity × affixes × quality**. Nothing is stored except those; stats and names are derived.

| Rarity | Affixes | Value multiplier |
|---|---|---|
| Common | 0 | ×1 |
| Uncommon | 1 | ×1.35 |
| Rare | 2 | ×1.9 |
| Epic | 3 | ×2.8 |
| Legendary | 4 (and a unique name like "Duskfang") | ×4.5 |

**Rarity roll** (weights, `f = 1 + find/100`): Common 100, Uncommon `(28 + 6×depth) × f`, Rare `(7 + 3×depth) × f`, Epic `(1.2 + 1.1×depth) × f`, Legendary `(0.15 + 0.3×depth) × f`.

**Item level** = `depth × 2 + 0–2`. It sets affix strength. **Quality** = `0.86–1.08 + 0.04 × rarity`, a multiplier on the base stats.

**Material tier** drives the stat scaling: `base + perTier × (tier − 1)`, times quality, plus the material's own bonuses (a secondary crafting material contributes half).

**Identification:** Common drops are identified; Uncommon and better arrive unknown, showing the base but hiding affixes, which **do not apply** until identified. Identify with a Scroll of Identify or pay the appraiser `10 + 12% of value` (Appraiser's Eye L1 makes that 40% cheaper; L2 identifies Rare and lower on the spot). Unidentified gear sells for 45% of its price.

**Item value** = `(baseValue × (1 + 0.9 × (tier − 1)) + materialValue × 1.5 + 4 × affix values) × quality × rarity multiplier`.

**Salvage** (at the forge) returns half the recipe's primary material, 50% of the secondary, and `20% × rarity` chance of a gem.

### Containers

Each newly generated chest has a deterministic **12% chance to be a mimic**. It looks almost right: two pale points interrupt the lid seam, visible to someone who has learned to check without announcing the trick to a first-time player. Opening one makes it split into a maw and unfold eight wooden legs, with a brief moment to react before this unusually tough, fast monster attacks. Killing it releases the same tier of hoard the chest would have contained, including vault and secret-chest rewards.

| Source | Contents |
|---|---|
| Urn / barrel | 55% a material (1–2), 35% gold `2 – (6 + 3×depth)`, 6% potion, 5% valuable |
| Chest | `8–20 × depth` gold, 1–3 material stacks, 40% gear, 20% potion, 18% valuable, 12% gem, 10% identify scroll, 8% blueprint |
| Vault / secret chest | `30–60 × depth` gold, a Rare+ item (50% a second Uncommon+), a valuable, a gem, 35%/70% blueprint, 35% a good consumable |

---

## 8. Materials and commodities

*File: `src/data/materials.ts`* — 29 tradeable goods. Tier drives crafted stats; value is the market's fair price.

| Material | Category | Tier | Rarity | Value | Bonus as primary / catalyst |
|---|---|---|---|---|---|
| Copper Ore | metal | 1 | Common | 8 | — |
| Iron Ore | metal | 2 | Common | 15 | — |
| Silver Ingot | metal | 3 | Uncommon | 42 | +3 Holy |
| Gold Nugget | metal | 2 | Rare | 75 | +3 Crit, +6 Find |
| Moonsilver | metal | 4 | Epic | 190 | +3 Frost, +2 Crit |
| Star Iron | metal | 5 | Legendary | 460 | +4 Shadow, +2 Attack |
| Timber Plank | wood | 1 | Common | 5 | — |
| Yew Stave | wood | 2 | Uncommon | 22 | +3 Speed |
| Ironwood | wood | 3 | Rare | 64 | +2 Attack, +1 Defense |
| Rat Hide | hide | 1 | Common | 4 | — |
| Leather | hide | 2 | Common | 13 | — |
| Wyrm Leather | hide | 4 | Epic | 170 | +10 Health, +1 Defense |
| Dragon Scale | hide | 5 | Legendary | 520 | +5 Fire, +15 Health |
| Linen | cloth | 1 | Common | 6 | — |
| Spider Silk | cloth | 3 | Uncommon | 36 | +4 Speed |
| Shadow Silk | cloth | 4 | Epic | 155 | +3 Shadow, +2 Crit |
| Bone | bone | 1 | Common | 3 | — |
| Jade | gem | 2 | Uncommon | 46 | catalyst → Vital (+Health) |
| Crystal Shard | gem | 2 | Uncommon | 40 | catalyst → Tireless (+Stamina) |
| Moonstone | gem | 3 | Rare | 92 | catalyst → Lucky (+Crit) |
| Emerald | gem | 3 | Rare | 110 | catalyst → of Plunder (+Loot Find) |
| Frost Shard | gem | 3 | Rare | 96 | catalyst → Rimed (+Frost) |
| Flame Shard | gem | 4 | Epic | 205 | catalyst → Blazing (+Fire) |
| Shadow Essence | gem | 4 | Epic | 230 | catalyst → of the Leech (+Leech) |
| Bone Idol | valuable | 1 | Common | 26 | sell only |
| Silver Chalice | valuable | 2 | Uncommon | 58 | sell only |
| Gilded Candelabra | valuable | 3 | Rare | 96 | sell only |
| Ancient Tome | valuable | 3 | Rare | 125 | sell only |
| Jewelled Skull | valuable | 5 | Epic | 280 | sell only |

---

## 9. Item bases

*File: `src/data/items.ts`* — stats shown at material tier 1, with the per-tier gain.

| Base | Slot | Stats (tier 1) | Per tier | Windup / recovery / stamina / reach | Value | From depth |
|---|---|---|---|---|---|---|
| Dagger | weapon | 5 atk, 3 crit | +3 atk | 0.12 / 0.26 / 11 / 1 | 18 | 1 |
| Short Sword | weapon | 7 atk | +4 atk | 0.18 / 0.36 / 15 / 1 | 28 | 1 |
| Long Sword | weapon | 10 atk | +5.5 atk | 0.26 / 0.48 / 21 / 1 | 55 | 2 |
| War Axe | weapon | 12 atk | +6.5 atk | 0.34 / 0.60 / 26 / 1 | 60 | 2 |
| Mace | weapon | 9 atk | +5 atk | 0.26 / 0.50 / 20 / 1 | 45 | 1 |
| Spear | weapon | 8 atk | +4.5 atk | 0.24 / 0.50 / 19 / **2** | 46 | 2 |
| Club | weapon (wood/bone) | 6 atk | +3 atk | 0.22 / 0.44 / 16 / 1 | 10 | 1 |
| Buckler | offhand | 1 def, 35 block | +1 def, +5 block | — | 18 | 1 |
| Kite Shield | offhand | 2 def, 55 block | +1.5 def, +5 block | — | 38 | 2 |
| Tower Shield | offhand | 4 def, 70 block, −10 speed | +2 def, +4 block | — | 60 | 3 |
| Cap | head (hide/cloth) | 1 def | +1 def | — | 9 | 1 |
| Helm | head (metal) | 3 def | +2 def | — | 30 | 1 |
| Great Helm | head (metal) | 5 def, 5 hp | +2.5 def | — | 55 | 3 |
| Robe | body (cloth) | 1 def, 10 stamina | +1 def, +5 stamina | — | 18 | 1 |
| Jerkin | body (hide) | 3 def | +2 def | — | 24 | 1 |
| Hauberk | body (metal) | 6 def, −5 speed | +3 def | — | 55 | 2 |
| Plate Armor | body (metal) | 10 def, −10 speed, −10 stamina | +4 def | — | 92 | 4 |
| Gloves | hands (hide/cloth) | 1 def, 3 speed | +1 def | — | 12 | 1 |
| Gauntlets | hands (metal) | 2 def, 1 atk | +1.5 def, +0.5 atk | — | 28 | 2 |
| Band | ring (metal) | 1 crit | +1 crit | — | 24 | 1 |
| Pendant | amulet (metal) | 5 hp | +5 hp | — | 34 | 2 |

### Affixes

*File: `src/data/affixes.ts`* — value rolls between min and max plus `perLevel × item level`.

| Affix | Kind | Stat | Roll | Per level | Slots | From ilvl |
|---|---|---|---|---|---|---|
| Sharp | prefix | Attack | 1–3 | +0.5 | weapon | 1 |
| Brutal | prefix | Attack | 4–7 | +0.9 | weapon | 4 |
| Sturdy | prefix | Defense | 1–2 | +0.4 | armour | 1 |
| Bastioned | prefix | Defense | 3–5 | +0.7 | armour | 4 |
| Vital | prefix | Health | 4–8 | +1.5 | all | 1 |
| Tireless | prefix | Stamina | 6–12 | +1.5 | all | 1 |
| Lucky | prefix | Crit | 2–4 | +0.4 | all | 1 |
| Blazing | prefix | Fire | 2–4 | +0.8 | weapon, jewellery | 3 |
| Rimed | prefix | Frost | 2–4 | +0.8 | weapon, jewellery | 3 |
| Umbral | prefix | Shadow | 2–4 | +0.8 | weapon, jewellery | 5 |
| Blessed | prefix | Holy | 2–4 | +0.8 | weapon, jewellery | 2 |
| of the Bear | suffix | Health | 6–12 | +2 | all | 2 |
| of the Fox | suffix | Crit | 2–5 | +0.4 | all | 1 |
| of Swiftness | suffix | Speed | 4–8 | +0.6 | weapon, hands, jewellery | 1 |
| of the Leech | suffix | Leech | 2–4 | +0.3 | weapon, jewellery | 3 |
| of Plunder | suffix | Find | 6–12 | +1.2 | all | 1 |
| of the Wall | suffix | Block | 5–10 | +0.6 | offhand | 1 |
| of Endurance | suffix | Stamina | 8–14 | +1.5 | all | 2 |

At most 2 prefixes and 2 suffixes, never two affixes on the same stat.

### Consumables

| Item | Effect | Rarity | Value | Stack |
|---|---|---|---|---|
| Healing Draught | Restore 35% health | Common | 24 | 5 |
| Greater Healing | Restore 75% health | Rare | 70 | 5 |
| Stamina Tonic | Refill stamina | Common | 16 | 5 |
| Scroll of Identify | Identify one item in the pack | Uncommon | 30 | 10 |
| Scroll of Recall | 5s channel, then home | Rare | 95 | 5 |

---

## 10. Crafting

*Files: `src/systems/crafting.ts`, `src/data/recipes.ts`*

Every recipe has **material slots** — the first is the primary (it sets tier, colour and name), the rest are secondary, and most accept an optional **gem catalyst**.

- **Rarity** from the primary tier: tiers 1–2 → Common, 3 → Uncommon, 4 → Rare, 5 → Epic. A catalyst lifts it one step.
- **Item level** = `primary tier × 2 + catalyst tier`.
- **Catalyst** adds its affix (see the materials table).
- **Quality** = `0.92–1.12 + 6% per Master Smith level`. Master Smith 3 adds an extra random affix.
- Crafted items are always identified.

Known from the start: dagger, short sword, club, buckler, cap, jerkin, gloves, band. The rest come from blueprints found in the dungeon or bought (long sword 140, war axe 150, mace 110, spear 120, kite shield 120, tower shield 200, helm 100, great helm 190, robe 80, hauberk 180, plate 320, gauntlets 110, pendant 130).

---

## 11. The market

*File: `src/systems/market.ts`*

Prices are per commodity and move once per day:

```
supply  ×= 0.55                       (your dumping decays)
fair     = value × eventMultiplier / (1 + supply × 0.05)
price   += 0.38 × (fair − price) + price × volatility × gauss()
volatility = 0.06 + 0.015 × rarity
clamped to [0.25 × value, 4 × value]
```

- **Spread:** you buy at `price × 1.15`, sell at `price × 0.8`. Silver Tongue moves both by 4% per level.
- **Slippage:** every unit you sell drops the price by `1.2% × (1 + rarity)`, and buying pushes it up the same way. Dumping 20 silver visibly tanks silver.
- **Stock:** the merchant holds 40 common / 14 uncommon / 5 rare / 2 epic units, restocking 30–70% of that per day. Legendary materials are never stocked.
- **Gear prices** use a separate daily sentiment per category (weapons, armour, jewellery). You sell gear for `value × sentiment × 0.5` (0.6 for other kinds) and buy at `value × sentiment × 1.35`.
- **Wares:** 6 rolled items (60% Common, 30% Uncommon, 9% Rare, 1% Epic) plus 2 blueprints, refreshed daily.
- **History:** 30 days, shown as sparklines with Market Insider L1; L2 reveals tomorrow's event.

### Events

One or two run at a time, announced the day before as a rumour.

| Event | Effect | Days |
|---|---|---|
| Iron Shortage | all metals ×1.5 | 3–5 |
| Silver Glut | silver ×0.55, chalices ×0.7 | 3–4 |
| Collectors' Fair | valuables ×1.8 | 2–3 |
| War Drums | weapons ×1.45, armour ×1.3, iron ×1.25, leather ×1.3 | 3–5 |
| Harsh Winter | hides and cloth ×1.5 | 3–5 |
| Royal Wedding | gems ×1.6, gold ×1.5, jewellery ×1.5 | 2–4 |
| Temple Crusade | silver ×1.7, chalices ×1.6, bone idols ×0.5 | 3–4 |
| Adventurers Returned | weapons/armour ×0.7, jewellery ×0.75, valuables ×0.8 | 2–3 |
| Rat Plague | rat hide ×0.4, bone ×0.6 | 2–4 |
| Dragon Sighting | dragon scale ×2, wyrm leather ×1.5, flame shard ×1.4 | 3–5 |
| Arcane Study | tomes ×1.8, crystal ×1.6, moonstone ×1.4 | 3–4 |
| The Great Forge Burns | all wood ×1.7 | 2–4 |

---

## 12. Contracts

*File: `src/systems/contracts.ts`* — a board of 5, at most 3 accepted at once, 3–6 days to run (delve 4–7).

| Kind | Ask | Reward |
|---|---|---|
| Deliver | N of a material within your depth range | `value × qty × 1.5–2.1` gold, 1–3 renown |
| Gear | An item of a slot at a minimum rarity | `60 + 90 × rarity² + 20 × depth` gold, 1–4 renown |
| Slay | 3–7 of a monster (only counts once accepted) | `(hp × 0.9 + 8) × count` gold, 2 renown |
| Delve | Reach a depth (only counts once accepted) | `80 × depth` gold, `3 + depth` renown |

---

## 13. Renown and upgrades

*File: `src/systems/meta.ts`*

**Renown earned:** coming home gives `2 + 2 × deepest depth`, plus 25 for killing the boss — **unless you never went below depth 1, which pays nothing**. You start standing on floor 1's up-stairs, so without that rule a single step back into them banked 4 renown for no risk, and the whole upgrade tree could be farmed by tapping forward and back. Dying gives `depth − 1`.

| Upgrade | Effect per level | Costs |
|---|---|---|
| Pack Mule | +4 backpack slots | 4, 8, 14 |
| Toughness | +12 max health | 3, 6, 10, 15, 22 |
| Second Wind | +15 max stamina | 3, 7, 12 |
| Soul Pouch | Keep 3 backpack slots and 20% of carried gold on death | 5, 10, 16 |
| Silver Tongue | Merchants pay 4% more, charge 4% less | 4, 8, 13, 20 |
| Market Insider | L1 price history; L2 tomorrow's event | 5, 12 |
| Master Smith | +6% crafted quality; L3 an extra affix | 4, 9, 15 |
| Appraiser's Eye | L1 identify 40% cheaper; L2 Rare and lower drop identified | 5, 12 |
| Treasure Sense | +12% loot find | 5, 10, 16 |
| Supply Crate | Start each run with +1 Healing Draught | 3, 6, 10 |
| Lantern Wick | +1 unit of light radius (½ a tile). L1 also spots traps 3 tiles ahead instead of 2 | 3, 7, 12 |

---

## 14. Carrying, dying, extracting

*Files: `src/state/inventory.ts`, `src/systems/run.ts`*

- **Backpack:** 16 slots (+4 per Pack Mule). Materials stack 20 per slot, consumables 5–10, gear 1.
- **Packing before a delve:** the *Stash & Gear* tab has a **Pack** panel beside the stash. Anything you put in it goes down with you as your backpack. Clicking a stash item moves it into the pack; gear equips instead unless you flip the **Equip / Pack** switch. **Take potions** fills the pack with every consumable that fits. When a run is already open (you came home through a town portal) the panel is your actual backpack, so you can stash your haul and restock before going back.
- Anything packed that no longer fits when you descend — the pack shrank, or the Supply Crate took the slot — goes back to the stash rather than vanishing.
- **Stash:** unlimited, in town, and materials merge into single stacks.
- **Extracting** banks the whole backpack and the gold you carried.
- **Dying** loses the backpack and your carried gold. Soul Pouch saves the first `3 × level` slots and `20% × level` of the gold. **Equipped gear is always kept.**
- Coins and keys are picked up automatically; everything else goes through the loot window and needs space.

---

## 15. Saving

*Files: `src/state/persistence.ts`, `src/state/migrations.ts`* — one JSON blob in `localStorage` under `looting-simulator-save-v2`, written on every town action, on floor changes, every 15 seconds in a run, when the app goes to the background, and on close. A run in progress is saved too, so you can resume it. Loading strips affixes that no longer exist and blessings that were removed, so old saves survive rule changes.

### Changing the schema without eating someone's save

Two numbers, and they are not interchangeable:

| Number | Where | Meaning |
|---|---|---|
| `SAVE_VERSION` | `game-state.ts` | The format *family*. A save whose version doesn't match is **refused and the player starts over.** Only move it for a change that genuinely cannot be read. |
| `SAVE_REVISION` | `migrations.ts` | Additive schema steps inside a family. Mismatches are migrated forward, never discarded. |

**Adding a field — a new stat on an item, a new array on a floor, a new upgrade — is additive.** Make it optional in the type, add a step to `MIGRATIONS` that backfills it, bump `SAVE_REVISION`, and leave `SAVE_VERSION` alone. `MIGRATIONS[i]` takes a save at revision `i` to `i + 1`; saves written before revisions existed have no `revision` and run through every step. Steps must be idempotent, must tolerate a half-built state, and must not throw — someone is mid-run.

A save written by a *newer* build than the one loading it is left as it is rather than migrated backwards.

`src/__tests__/persistence.test.ts` runs a real save captured from the build of 2026-09-12 through the loader on every test run. If a schema change breaks that fixture, it would have broken a player's save; fix the migration, don't update the fixture.

---

## 16. Presentation

- **Renderer** (`src/render/`): Three.js at 240p with vertex snapping, affine texture warping, per-pixel torch lighting, distance fog and a 15-bit dither pass, upscaled with nearest sampling. You carry a whiter light than the wall torches so colours read true up close: **9.5 units of radius**, +1 per Lantern Wick level, against fog that runs from 4 to 18 — so even a full lantern leaves the corridor fading to black well before the end. Sprites are billboards; the weapon is drawn in screen space.
- **Art** (`src/art/`): every texture, sprite and icon is a palette-indexed character grid. Characters `1`–`4` are a ramp recoloured per material; colours ending in alpha `fa` glow in the dark. PNGs listed in `public/art/manifest.json` override the built-in art.
- **Audio** (`src/audio/sfx.ts`): all synthesised at runtime — no audio files. Effects are panned by direction and quietened by distance; each biome has its own drone. Everything suspends when the app is in the background.

---

## 17. Where to change things

| Want to change | File |
|---|---|
| Monster stats, drops, depth ranges | `src/data/enemies.ts` |
| Materials, tiers, values, catalysts | `src/data/materials.ts` |
| Weapon/armour bases and swing timings | `src/data/items.ts` |
| Affix pool and roll sizes | `src/data/affixes.ts` |
| Recipes and blueprint prices | `src/data/recipes.ts` |
| Biomes, depth count | `src/data/biomes.ts` |
| Damage formulas, difficulty multiplier | `src/systems/combat.ts` |
| Parry window, stun and reflect | `src/world/world.ts` (`PARRY_*`) |
| Movement, stamina, AI, interaction | `src/world/world.ts` |
| Layout generation, room and prop density | `src/systems/dungeon.ts` |
| Trap damage, salvage, spotting range | `src/world/world.ts` (`TRAPS`) |
| Drop tables and rarity odds | `src/systems/items.ts` |
| Price model and events | `src/systems/market.ts` |
| Contracts | `src/systems/contracts.ts` |
| Upgrades and renown | `src/systems/meta.ts` |

**Keep this file updated** whenever those change: the tables above are meant to be the single reference for balance discussions.
