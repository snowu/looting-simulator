# Looting Simulator — Mechanics Reference

Every system, with the numbers that are actually in the code. Keep this updated when you change a data file or a formula; each section names the file it comes from.

Last synced with the build of 2026-09-12.

---

## 1. The loop

One run is one **day**.

1. **Town (Bleakmere).** Sell, buy, craft, take contracts, spend renown, equip.
2. **Descend.** Six floors, each generated from the run seed and kept for the whole run, so you can walk back up.
3. **Come home** by the stairs you came down (floor 1's up-stairs is the exit) or through the portal left by the boss. A **Scroll of Recall** instead opens a two-way town portal, which does *not* end the day.
4. **Day advances**: market prices move, events tick, contracts age, the board is topped up, the merchant restocks.

Dying ends the day too, but you lose the backpack.

**A delve that never went below depth 1 does not count.** No renown, and **the day does not turn** — you come back to the same prices and the same board. You start standing on floor 1's up-stairs, so without that rule an about-turn and one step was both a free 4 renown and a free button for rerolling the market. Your haul still banks; it just was not a delve.

*Files: `src/systems/run.ts`, `src/main.ts`*

---

## 2. The player

*Files: `src/systems/player.ts`, `src/systems/combat.ts`, `src/world/world.ts`*

| Property | Value |
|---|---|
| Base health | 70 (+12 per Toughness level, + item Health) |
| Base stamina | 100 (+15 per Second Wind level, + item Stamina) |
| Health regeneration | **None.** Potions, shrines and life leech only |
| Stamina regeneration | 22/s, starting 0.9s after your last swing; 30% of that while blocking |
| Unarmed | 3 attack, 0.14s windup, 0.30s recovery, 9 stamina, reach 1 |
| Step | 0.24s per tile; backwards ×1.25; ×1.2 more if Speed < −12 |
| Turn | 0.17s per 90°, then a 0.16s pause before a held turn repeats |

**Stat list:** Attack, Defense, Health, Stamina, Block %, Speed %, Crit %, Loot Find %, Spell Focus %, Life Leech %, and four elemental damage stats (Fire, Frost, Shadow, Holy). Speed divides weapon windup and recovery (`1 + speed/100`, floor 0.5).

### Damage

Mitigation is `attack × max(floor, 1 − defense/(defense + k))`. `k` is how much armour it takes to halve a blow; `floor` is the share that always gets through.

**Your hits:** `mitigate(attack, enemyDefense, k=45) × resistance` + each elemental stat through `mitigate` at **half** the monster's armour, × its resistance; then × stamina power × random 0.9–1.1. Elemental damage is armour-*piercing*, not armour-ignoring: it used to be added flat after mitigation, which was harmless while deep monsters had 9 defense and became an outright bypass once they had 40. Crits are `Crit %` (capped 60%) for the weapon's crit multiplier — ×1.6 for everything except the **Dagger**, which crits for ×2.4.

**Stamina power:** `0.4 + 0.6 × min(1, stamina / (maxStamina × 0.5))`. At or above half stamina you hit full strength; empty, you do 40%.

**Their hits:** `mitigate(attack × 1.15, defense, k=75, floor=0.34) × random 0.85–1.15`. Elemental attacks ignore half your armour. `ENEMY_DAMAGE_MULT = 1.15` is the global difficulty knob.

The wide `k` and the high floor are deliberate. At `k=25` with a 20% floor, plate did not reduce damage so much as switch it off — a Hollow Knight needed twenty-six swings to kill a player in moonsilver. Armour should be the difference between four hits and nine, never the difference between dying and not noticing, so **a third of every blow always gets through**.

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

**Against melee:** the attacker is staggered for **1 second** (never shorter than the recovery it would have had) and takes **double damage** for that whole second. You are immune for the next **0.75s on Hard or 1.25s on Normal**, and other adjacent enemies are staggered for at least **0.25s**, preventing a cluster of near-simultaneous attacks from landing through a successful parry. Bosses are not exempt — this is the only way to open the Ashen King up, since he cannot be staggered out of his wind-up.

**Against ranged:** the bolt is **reflected**, keeping its damage and element, and flies back the way it came. The reflection leaves a **0.75s follow-up window on Hard or 1.25s on Normal** that can parry one more projectile, protecting against arrows stacked almost on top of each other. A reflected bolt hits **the first monster in its path** — which is usually the archer that fired it, but is whatever is standing in between. Incoming bolts still pass through monsters, so an archer's escort only shields it *after* you turn one around. Damage uses the target's own resistance, so a Flame Wraith's bolt turned onto a Frost Wisp lands at ×2.

A volley can lose up to two closely stacked bolts to one timed parry; the follow-up is spent after the second reflection.

*Files: `src/world/world.ts` — `PARRY_WINDOW`, `PARRY_COOLDOWN`, `PARRY_GRACE`, `MELEE_PARRY_*`, `PARRY_STUN`, `PARRY_VULN_MULT`; `src/data/difficulty.ts` — `parryGrace`*

**Life leech:** heals `damage × leech%` on every hit that lands.

---

## 3. Controls

See the README table. In short: W/S step, A/D turn, Q/E strafe, Space attack, Shift block, F interact, R retrieve thrown stock, G or C cast your sigil, 1–4 consumables, I pack, M map, Esc pause. On touch: drag anywhere to walk and turn, tap or press the big button for the context action, hold the shield to block.

**The one-button action** (tap the view, or the big button) swings at anything in reach and otherwise does whatever **[F]** would. One exception: a loot pile **underfoot never steals the swing while something is alive within 2 tiles**, or within 4 and hunting you. Killing the first of two monsters drops loot on your tile, and without that rule every tap became the loot window instead of a hit on the second one. Doors, stairs and portals still win over the swing, because running is a legitimate answer to a fight. **[F]** is unaffected — looting on the keyboard is always deliberate.

Every Mining Pick swing, whether it hits or misses, has a **1%** chance to add **“Rock and Stone!”** to the log. Inputs that cannot start a swing because the player is busy do not roll. This uses a flavor-only random stream and cannot change combat, loot or dungeon generation.

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
| Secret room | `50% + 6% × depth`: a 3×3 room behind a pushable wall, marked with a faint local-stone arch and keystone |
| Shrine | 45% of floors |
| Pillars | Rooms of at least 6×5 get pillars, never blocking a route |
| Stairs | Carved as alcoves — up in the start room, down in the farthest room; the boss floor has no down stairs |
| Torches | Placed on room walls, at least 5 tiles apart, density per biome; always one at the arrival point |
| Props | See the room-by-room table under [Containers](#containers). Eight or nine lootable things per floor |
| Enemies | `3 + 1.2 × depth + rooms/4`, never within 7 tiles of the arrival point; 15% spawn wandering in corridors instead of rooms. About a third fewer than before: fights are three to seven swings now instead of one, so the old count turned a floor into a queue |
| Loose loot | `1 + ⌈depth/2⌉` piles: 55% coins (`2–5 × depth`), otherwise a material stack |
| Traps | `2 + 1.5 × depth`, 70% in corridors, at least 4 tiles apart, never within 3 of the arrival tile; 70% of treasure/vault/secret rooms also get one inside |

Every generated floor is checked: all walkable tiles reachable, keys reachable without their own vault, stairs present. Failed layouts are regenerated (up to 40 attempts).

**Fog of war:** tiles within 2 (line of sight) plus a corridor cone 8 tiles ahead are revealed as you walk. The minimap and the M map only show explored tiles.

### Biomes

| Depths | Name | Doors | Notes |
|---|---|---|---|
| 1–2 | The Ossuary | Wood | Stone brickwork, bone niches, warm torchlight |
| 3–4 | The Deep Mines | Wood | Rubble walls, timber supports, dirt floors |
| 1–3 | The Sunken Catacombs | Wood | Wet stone, shallow water that splashes underfoot, cold fungus, drowned dead |
| 1–3 | The Vermin Burrows | Wood | Packed earth, roots, vermin and stalkers |
| 3–5 | The Frost Vault | Iron | Blue stone, fractured ice, frostbound guards; frost creatures are favored and fire creatures do not spawn |
| 3–5 | The Emberworks | Iron | Soot-black masonry, hot seams, fire creatures; fire creatures are favored and frost creatures do not spawn |
| 3–5 | The Sporegrove | Wood | Green stone, luminous fungus, spore hunters |
| 6 | The Ashen Throne | Iron | Obsidian with glowing mortar, banners, the boss |

---

### Depth 6 — The Ashen Throne (the boss floor)

Depth 6 is the bottom (`FINAL_DEPTH = 6`); there are no stairs down, only the way you came. It is generated differently from the floors above:

- A **9×11 throne room** is placed first, and the rest of the floor (8 rooms instead of `9 + depth`) is fitted around it.
- The throne room is forced to be a **dead end**: it gets exactly one connection, no loop links, and its entrance is an **iron door**.
- You arrive in the room **farthest from the throne**, so there's a floor to cross before the fight.
- **The Ashen King** waits two tiles inside, flanked by **two Hollow Knights**. The floor also carries 3 more wanderers than the usual `3 + round(1.2 × depth) + floor(rooms/4)`.
- Only the deep roster spawns here: **Ghouls, Frost Wisps, Hollow Knights, Flame Wraiths**. Skeletons stop at depth 4, archers and spiders at 5.
- Vaults, secret rooms (86% chance at this depth) and shrines still generate as normal. The key here is the **Ashen Key**.
- The biome has the densest torches of the game, iron doors and obsidian walls whose mortar glows.

**The fight.** 420 HP, 24 attack, 12 defense. It swings when adjacent and fires a **three-bolt shadow volley** when you line up at range 2+. It is immune to shadow, resists pierce (×0.95), takes ×1.5 from holy, and **can never be staggered** out of its wind-up — step out of the tile it aims at, block, or **parry**, which is the one thing that does stagger it and opens a second of double damage. Its volley can be parried a bolt at a time, and the returned bolt is shadow, which it is immune to — so reflect it into the Hollow Knights beside it instead.

**On its death** it drops a guaranteed **Legendary and an Epic item plus a blueprint**, star iron, shadow essence, a jewelled skull, 50% a dragon scale and 150–300 gold — dropped on a tile *beside* the king, because a **portal** opens on the tile he fell on and would otherwise bury the hoard. Killing it is worth **+25 renown** on top of the usual extraction reward (so 39 for a depth-6 extraction).

There is nothing below. Each new run rolls a fresh seed, so depth 6 can be farmed.

### The King's three phases

*File: `src/data/enemies.ts` (`KING_PHASES`), `src/world/world.ts` (`checkBossPhase`)*

He was a very large trash mob: one telegraph, one volley, and thirty swings of
health. Now the fight asks a different question as it goes, and each question is
one the six floors above it already taught you.

| | health | what changes | what it asks |
|---|---|---|---|
| **The Throne** | 100–65% | nothing — the fight as it always was | can you read a telegraph? |
| **The Dark** | 65–30% | he puts out every torch in the throne room, and the guards you killed get back up at a third of their health | can you fight blind, with company? |
| **The Last Stand** | 30–0% | the crown splits; he is faster, and he raises a ward of shadow that turns blows the way a shieldbearer's guard does | can you parry under pressure? |

**He stays one creature.** The phases change his sprite family, his glow, his
wind-up, his recovery and whether he carries a guard — and nothing else. His id,
name, resistances, hoard and health are untouched, because the codex, the field
notes and the one guaranteed relic in the game are all keyed off them.
`enemyView(def, hp, maxHp)` folds the phase into a copy of the stat block, so the
guard rhythm, the sprite picker and the volley all read the fields they always
read and simply get a different answer on the last floor.

**Which phase he is in is derived from his health**, not stored — so it cannot
drift out of step with the bar. `EnemyState.phase` only remembers how far the
fight has been *announced*, so each turn lands once. A phase crossed and skipped
in a single big hit still happens: the loop steps through every stage between,
or a crit inside a parry window would mean the room never goes dark.

**The turn.** He reels for 1.2s and cannot act while the room changes around
you — the same grace beat the mimic gets when it unfolds, and what keeps a
transition from being a free hit. Deliberately *not* a `vuln` window: that
belongs to the parry, and giving it away would cheapen the thing the last phase
exists to teach. Anything he already had in the air is cleared when the lights
go, because losing the room and three unseen bolts in the same instant is the
one genuinely unfair combination here.

**The dark is permanent.** The torches are removed from the floor, not dimmed,
so they do not come back — and the renderer rebuilds its lights from that list
every frame, so it is the whole effect. Only the throne room's own sconces go;
the corridor you came down stays lit, so the way back is still readable. The
automap is untouched, because the map is a memory of where you have walked, not
eyesight. This is also the moment the Lantern Wick finally earns its renown.

**The risen pay nothing.** A guard the King stands back up is flagged `risen`,
and killing it again costs it no second hoard, no second tally and no second
contract credit — without that, the throne room would be the best place in the
game to farm a Hollow Knight's moonsilver. Only guards you actually killed rise,
so leaving them alive means there is nothing for him to call.

**Testing it.** `npm run dev` then `?autostart=boss` kits you out in the
depth-6 ladder gear and stands you at the back of the throne room. Dev builds
only — the helper is behind an `import.meta.env.DEV` guard and its module is
dropped from a production bundle.

**They are optional.** Phase advance is driven by the King's health alone, so
you can ignore the risen and burn him into his last phase — and carry two
knights into it. Racing him is about 23 swings at the gear depth 6 is meant to
be reached with; clearing everything is about 32. The old fight was a flat 30.

## 5. Monsters

*File: `src/data/enemies.ts`*

| Monster | Depths | HP | Atk | Def | Type | Resists / weaknesses | Behaviour | Windup | Recovery | Step | Sight |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Giant Rat | 1–3 | 14 | 5 | 0 | pierce | **slash ×1.4**, pierce ×1.3 | melee | 0.38 | 0.65 | 0.3 | 6 |
| Goblin Cutpurse | 1–4 | 28 | 8 | 2 | slash | **slash ×1.4**, pierce ×1.25 | skittish | 0.45 | 0.7 | 0.4 | 7 |
| Goblin Archer | 2–4 | 20 | 8 | 1 | pierce | **slash ×1.4**, pierce ×1.25 | ranged, pierce bolt, speed 6.5, range 4 | 0.7 | 1.3 | 0.35 | 8 |
| Goblin Shieldbearer | 2–4 | 40 | 8 | 6 | slash | **slash ×1.4**, pierce ×1.25 | melee, shield (blocks 75%) | 0.5 | 0.8 | 0.45 | 6 |
| Cave Bat | 1–3 | 16 | 6 | 0 | pierce | blunt ×0.85, **slash ×1.4**, pierce ×1.3 | melee, floats | 0.24 | 0.4 | 0.2 | 5 |
| Skeleton | 1–4 | 30 | 9 | 4 | slash | undead: **blunt ×1.5**, slash ×0.6, pierce ×0.55, **holy ×2**, shadow ×0.5 | melee | 0.55 | 0.9 | 0.55 | 7 |
| Skeleton Archer | 2–5 | 26 | 9 | 4 | pierce | undead: **blunt ×1.5**, slash ×0.6, pierce ×0.55, **holy ×2**, shadow ×0.5 | ranged, pierce bolt, speed 7, range 5 | 0.75 | 1.4 | 0.5 | 8 |
| Skeleton Shieldguard | 3–5 | 50 | 11 | 9 | slash | undead: **blunt ×1.5**, slash ×0.6, pierce ×0.55, **holy ×2**, shadow ×0.5 | melee, shield (blocks 75%) | 0.6 | 0.9 | 0.55 | 7 |
| Cave Spider | 3–5 | 36 | 11 | 3 | pierce | slash ×1.3, **pierce ×1.35**, **fire ×1.5** | melee | 0.42 | 0.8 | 0.28 | 5 |
| Ghoul | 3–6 | 72 | 16 | 8 | slash | undead: **slash ×1.35**, pierce ×1.3, fire ×1.3, **holy ×2**, shadow ×0.5 | melee | 0.65 | 1 | 0.75 | 6 |
| Ember Wisp | 3–5 | 30 | 11 | 2 | fire | blunt ×0.7, slash ×0.8, pierce ×0.6, fire ×0, **frost ×2** | ranged, fire bolt, speed 5.5, range 4, floats | 0.7 | 1.45 | 0.42 | 8 |
| Frost Wisp | 4–6 | 36 | 13 | 2 | frost | blunt ×0.7, slash ×0.8, pierce ×0.6, **fire ×2**, frost ×0 | ranged, frost bolt, speed 5, range 4, floats | 0.8 | 1.6 | 0.45 | 8 |
| Hollow Knight | 5–6 | 135 | 21 | 20 | slash | undead: blunt ×1.2, slash ×0.7, pierce ×1.25, **holy ×1.6**, shadow ×0.5 | melee, shield (blocks 75%) | 0.7 | 1 | 0.65 | 7 |
| Barrow Champion | 5–6 | 170 | 24 | 14 | blunt | undead: **blunt ×1.5**, slash ×0.55, pierce ×0.5, **holy ×2**, shadow ×0.5 | melee | 0.85 | 1.2 | 0.8 | 7 |
| Flame Wraith | 5–6 | 82 | 19 | 6 | fire | blunt ×0.7, slash ×0.8, pierce ×0.6, fire ×0, **frost ×2** | ranged, fire bolt, speed 5.5, range 4, floats | 0.75 | 1.4 | 0.5 | 8 |
| Mimic | any chest | 58 | 17 | 8 | pierce | blunt ×1.25, pierce ×1.1, **fire ×1.35** | melee | 0.52 | 0.8 | 0.32 | 8 |
| The Ashen King | 6 (boss) | 330 | 32 | 22 | shadow | undead: pierce ×0.95, **holy ×1.5**, shadow ×0 | boss, shadow bolt, speed 4.5, range 3 | 0.8 | 1 | 0.8 | 12 |

Spawn weights: Giant Rat 3, Goblin Cutpurse 3, Goblin Archer 2, Goblin Shieldbearer 1.5, Cave Bat 2.5, Skeleton 2, Skeleton Archer 2, Skeleton Shieldguard 1.5, Cave Spider 3, Ghoul 2, Ember Wisp 2, Frost Wisp 2, Hollow Knight 1.5, Barrow Champion 1.5, Flame Wraith 1.5. The Ember Wisp is the Frost Wisp's shallow counterpart, sharing its sprite rows under a warm palette — it puts the first elemental enemy on depth 3, which had none. Every floor holds at least five kinds, and each gives blunt, slash and pierce something it is good against — depth 6 without the Barrow Champion had no bone left to break, which left the club line with nothing to do on the final floor. Mimics never enter the ordinary spawn pool.

**Depth scaling.** The stat block above is what a monster is on the shallowest floor it appears on. Two multipliers stack on top, both in `depthPower()`:

- **Over-level**, `1 + 0.12 × (depth − minDepth)` — a monster standing below its own home floor is a veteran of its kind.
- **The floor itself**, `1 + 0.5 × (depth − 1)` — the player's gear tracks the *floor number*, because depth is what decides which materials drop, so the monsters have to track it too or the two curves never meet.

Their product is the **health** multiplier. Damage and armour are expressed as fractions of it rather than scaled again: `attackPower = 1 + 0.55 × (power − 1)` and `defensePower = 1 + 0.45 × (power − 1)`. Health climbs fastest on purpose — a deep floor should be a longer fight you can lose slowly, not a coin flip that removes you in two blows. A Hollow Knight on depth 6 is therefore 529 health, 55 attack and 46 defense, not the 135/21/20 in the table.

A monster lighter than **55 health** (`STAGGER_HP`) is knocked out of its wind-up when you land a blow, which is what makes trading with a rat different from trading with a ghoul. Bosses never stagger.

### Monster drops

| Monster | Materials | Gold | Gear chance |
|---|---|---|---|
| Giant Rat | rat hide 42% (1–2), bone 35% | 0–2 | — |
| Goblin Cutpurse | copper ore 35% (1–2), linen 28% (1–2), timber plank 21%, bone idol 14%, bone 35% | 3–12 | 5% |
| Goblin Archer | copper ore 28% (1–2), linen 21% (1–2), timber plank 21%, yew stave 14%, bone 35% | 2–8 | 3.5% |
| Goblin Shieldbearer | copper ore 35% (1–2), timber plank 28% (1–2), iron ore 17%, bone 35% | 3–10 | 4% |
| Cave Bat | bone 35%, leather 15% | 0–3 | 1.5% |
| Skeleton | bone 49% (1–3), iron ore 24% (1–2) | 0–6 | 4% |
| Skeleton Archer | bone 42% (1–2), yew stave 17%, timber plank 21% | 0–8 | 3.5% |
| Skeleton Shieldguard | bone 49% (1–3), iron ore 28% (1–2) | 2–8 | 4% |
| Cave Spider | spider silk 42% (1–2), crystal shard 6%, bone 35% | 0–4 | 2% |
| Ghoul | leather 35% (1–2), bone 42% (1–3), silver chalice 14% | 5–20 | 7% |
| Ember Wisp | flame shard 21%, crystal shard 24% (1–2), sunstone 6% | 0–5 | 3% |
| Frost Wisp | frost shard 32%, crystal shard 24% (1–2), moonstone 6% | 0–5 | 3% |
| Hollow Knight | iron ore 56% (2–3), silver ingot 28% (1–2), moonsilver 6%, gilded candelabra 7% | 10–40 | 16% |
| Barrow Champion | bone 63% (2–4), silver ingot 32% (1–2), moonsilver 8%, ancient tome 7% | 10–34 | 8% |
| Flame Wraith | flame shard 32%, gold nugget 14%, emerald 6%, shadow essence 4%, ancient tome 6% | 5–25 | 9% |
| Mimic | — | 0–0 | — |
| The Ashen King | star iron 100% (1–2), shadow essence 100% (1–2), dragon scale 50%, jeweled skull 100% | 150–300 | 100% |

Every kill also has a 2.5% chance of a Healing Draught and `0.6% × depth` of a blueprint. Loot find multiplies material chances by `1 + find/200` and gear chance by `1 + find/100`.

### Monster AI

*File: `src/world/world.ts`*

- **Idle / wander:** a step every 1.2–3.2s, staying within 3 tiles of where it spawned.
- **Noticing you:** needs line of sight within its sight range; walls, pillars and closed doors block it. Alert lasts 6 seconds after losing sight (8 if you hit it), during which it paths to where it last saw you.
- **Chasing:** breadth-first pathfinding, recomputed about 3 times a second, up to 18 tiles. Closed doors block monsters, so shutting one behind you works.
- **Attacking (the telegraph):** the monster commits to the tile you are standing in, leans in and flashes red for its windup, then strikes. **Step out of that tile and it misses.** Then it's in recovery and can't act.
- **Staggering:** hitting a monster with under 40 base HP during its windup interrupts it (0.5s recovery). Bosses never stagger.
- **Shields** (Shieldbearer, Shieldguard): while you are close the guard runs a rhythm you can read off the sprite — the shield sweeps center (**raise**, 0.25s), holds (**up**, 1.4s), drops (**down**, 1.6s). A frontal blow into the raise is answered with a shield-bash: your guard drops, you are **stunned for 1 second**, and the bearer starts a swing you cannot dodge. A frontal blow into the hold is **absorbed for 75%** with no stagger; three chips running sag the guard and drop it early. Blows from behind, mid-swing, while reeling, or into the dropped guard land full — and break the chip count. Flank them, meet their swing, or time the drop.
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
| Masonry-marked wall | Push it aside to open a secret room |
| Chest | Opens into the loot window; gold goes straight to your purse. 12% are mimics: two pale points in the lid seam are the quiet tell |
| Urn / barrel | Smash by attacking or interacting; small loot |
| Shrine | One of three flavours — see below. The prompt names it before you touch it |
| Stairs | Walk into the alcove. Floor 1's up-stairs leaves the dungeon |
| Portal | Appears when the boss dies; steps you home and ends the run |
| Town portal | Opened by a Scroll of Recall; steps you to Bleakmere with the run still going |
| Loot pile | Coins and keys are picked up automatically; items open the loot window |

### Shrines

A shrine serves one of three gods, fixed per floor and rolled from its own seed stream. **You can tell which before you pray**: the flame, the orb and the light it throws across the room are a different colour, and the prompt names it. Praying is a decision, not a coin toss. Weights are font 4, idol 4, stone 3.

| | Colour | Prompt | What it does |
|---|---|---|---|
| **Font of Mending** | cold blue | *Drink at the font* | **60% of your health** and all of your stamina, and **lifts a curse**. Never harms you |
| **Hollow Idol** | violet | *Pray at the hollow idol* | **60%**: the same mend and a blessing. **40%**: a curse for the rest of the run |
| **Offering Stone** | gold | *Offer N gold at the stone* | Costs `30 + 25 × depth` carried gold for the same mend and a blessing. Too poor? It stays unused — come back with the coin |

No shrine restores you outright any more. A font that refills the bar is a save point, and a save point every other floor is the end of attrition as a mechanic — so it is a large, welcome, *partial* mend, and it does not undo the delve.

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

- Stepping through puts you in **Bleakmere with the run still open** — the day does not advance, the market does not move, contracts do not age, and the dungeon is exactly as you left it.
- The coin you were carrying is **banked into your purse** on arrival, so you can spend what you found. It is no longer at risk if the rest of the delve goes badly.
- In town the Descend button becomes **Step back through the portal**. It drops you on the portal's own tile, at the depth you left from, and the portal **closes behind you**.
- **One at a time.** Reading a second scroll collapses the first portal and opens a new one where you stand.
- The portal is part of the save, so closing the browser in the middle of a portal trip and coming back still works.


---

## 6a. Traps

*Files: `src/systems/dungeon.ts` (placement), `src/world/world.ts` (`TRAPS`, spotting, springing)*

Every trap starts **hidden and armed**. You spot one by looking at it: the tiles ahead down a clear line (**two**, or **three** with Lantern Wick) and the four tiles beside you are checked on every step and every turn. Spotting is not a dice roll — it is whether you were looking. A held W down a corridor gives you one step of warning, which is the whole point.

A spotted trap is drawn as a floor decal — cold iron against warm stone, so it reads by hue and value if you are looking at the floor, without glowing or being labelled. It stays marked on the automap (orange armed, grey spent) and can be disarmed with **[F]** from the tile in front. When sprung, the mechanism gives one short settling pulse and remains permanently visible at full value as distinct wreckage: a crossed dart plate, collapsed spikes, or a broken ward. It never fades out.

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

**Rarity roll** (weights, `f = 1 + find/100`, floored at 0.1): Common `100 / f`, Uncommon `(18 + 4×depth) × f`, Rare `(4 + 1.8×depth) × f`, Epic `(0.5 + 0.6×depth) × f`, Legendary `(0.06 + 0.16×depth) × f`. Natural Rare, Epic, and Legendary drops unlock at depths **3, 5 and 6**; guaranteed boss rewards can exceed these gates. A Rare on the second floor made the first two floors' worth of Commons pointless the moment you saw one.

**Item level** = `depth × 2 + 0–2`. It sets affix strength. **Quality** = `0.86–1.08 + 0.04 × rarity`, a multiplier on the base stats.

**Material tier** drives the stat scaling: `base + perTier × (tier − 1)`, times quality, plus the material's own bonuses. Secondary recipe materials provide a structural bonus by category (Metal → Defense, Wood → Speed, Hide → Health, Cloth → Stamina, Bone → Attack), scaled by tier, plus their full material-specific modifiers. Crafted recipe mastery multiplies positive base and per-tier stats after quality; it does not multiply penalties, material bonuses, or affixes.

Natural equipment materials are gated by both tier and rarity, then weighted down by material rarity. First floor per tier is `1, 1, 2, 4, 5, 6` (`TIER_DEPTH`), and Rare, Epic and Legendary materials cannot appear before depths 3, 5 and 6. Tier 3 — silver, gold, ironwood — used to be reachable in the first chest you opened on floor one, which is most of why the power curve ran away: the gear ladder was three rungs ahead of the floor ladder by depth 2. The metal you are wearing should say how deep you have been. A visible consequence: **the day-one market does not stock iron**, because a day-one delver could not have brought any back.

The tier a floor aims for is `1 + 0.55 × (depth − 1)`, plus `−0.7 … +0.8` of spread, weighted by `e^(−1.6 × |tier − target|)`.

**Identification:** Common drops are identified; Uncommon and better arrive unknown, showing the base but hiding affixes, which **do not apply** until identified. Identify with a Scroll of Identify or pay the appraiser `10 + 12% of value` (Appraiser's Eye L1 makes that 40% cheaper; L2 identifies Rare and lower on the spot). Unidentified gear sells for 45% of its price.

**Item value** = `(baseValue × (1 + 0.9 × (tier − 1)) + materialValue × 1.5 + 4 × affix values) × quality × rarity multiplier`.

**Salvage** (at the forge) returns half the recipe's primary material, 50% of the secondary, and `20% × rarity` chance of a gem.

### Durability

Only the gear that takes the blows wears out. **Rings and amulets never degrade** — a ring that needs repairing is book-keeping, not a decision.

| Slot | Pool at tier 1 | At tier 5 |
|---|---|---|
| Weapon | 110 | 198 |
| Offhand | 130 | 234 |
| Body | 150 | 270 |
| Head | 120 | 216 |
| Hands | 110 | 198 |

The pool is `slotBase × (0.8 + 0.2 × material tier)`, so better metal lasts longer as well as hitting harder. Crafted recipe mastery also multiplies this pool.

**What costs a point:**

| | |
|---|---|
| Weapon | every blow that **lands** on a monster. Swinging at air is free. A two-hander's cleave costs **2** when it catches anything, and a thrown weapon costs one per shaft that hits and one per shaft retrieved |
| Offhand | every hit you **absorb** on the shield. A **parry costs nothing** — one more reason to meet the swing instead of hiding behind it |
| Armour | one worn piece, picked at random, each time a hit **gets through** unblocked |

**Breaking** is not a cliff you fall off blind: gear says so once when it drops under 25% ("close to failing") and once when it goes. Broken gear stays equipped and still gives **25% of its stats** — crippled, not naked.

**Repairs** are at the forge, in the *Repairs* pane: `ceil(value × 0.3 × (1 − condition))` gold per piece, broken gear listed first, with a *Mend all*. Repair cost uses the item's **sound** value, so letting something rot is never the cheaper play. Buyers can see wear, though: worn gear sells for `0.45 + 0.55 × condition` of its price.

A 6-floor delve runs 150–350 landed blows, so a weapon that starts the run at full will not always finish it. That is what the pack loadout and the town portal are for: carry a spare, or go home and mend.

### Relics: the bespoke legendaries

*Files: `src/data/uniques.ts`, `src/systems/relics.ts`*

**There are no Legendaries but these.** A Legendary roll no longer produces a
Rare with four affixes and a generated name — it is diverted into one of nine
hand-authored relics, each a fixed base in a fixed material with one effect that
hooks a system the game already runs. A relic still takes **two** ordinary
affixes for texture (never four), rolls quality 1.08–1.26, and arrives
**unidentified** like any Rare+ drop: the name lands at the appraiser, and the
effect does nothing until you know what you are holding.

An affix may never roll on a stat a relic deliberately spends, so a Bright Error
cannot roll back the Block it gives up.

**Two registers, and a key to switch between them.** Every relic says what it
does twice: `rule` is plain words, which is what a tooltip shows by default and
what makes it feel like an object rather than a row in a spreadsheet; `detail`
is the same effect with every number in it. **Hold Shift** on a keyboard, or
**tap the tooltip** on a touchscreen, and the tooltip swaps register — durability
changes from `Condition 62%` to `Condition 74 / 120`, and item level, quality and
base value appear. Neither register is the real one; some decisions want the
sentence and some want the figure. **The codex reads the same way** — plain words
by default, numbers on Shift, with a *Numbers* button standing in for Shift on a
touchscreen. The swap is done in CSS off a `detail-mode` class on `<body>`, so a
screen that is already open changes register without being rebuilt and never
loses its scroll position or its selection.

Every figure in `detail` is locked to the constant it came from by
`src/__tests__/uniques.test.ts` — a tuning change that turns a rule into a lie
fails the suite rather than reaching a player.

| Relic | Base | Effect |
|---|---|---|
| An Entirely Ordinary Sword | Star-Iron Long Sword | +8 Attack; 0 durability lost per blow, ever, so no repair bill |
| The Implication | Moonsilver Dagger | +25% damage per banked parry, stacking to 3 (+75%). An unblocked hit drops it to 0; a blocked one keeps it |
| Champion of the Sun | Silver Mace | +70% damage to the undead, nothing against the living |
| Riggs' Answer | Moonsilver Kite Shield | A parried melee blow deals 100% of the attacker's damage back, at its own type, on top of the stun and doubled damage |
| Bergholt's Bright Error | Gold Buckler | +4 light radius (9.5 → 13.5); −42 Block %, absorbing 7–15% where a plain gold buckler takes 45% |
| Eulogy Plate | Star-Iron Plate | +14 Defense, +20 Health; **all** healing at exactly 50% |
| Charlie Work | Silver Band | +2 tiles of trap-reading: 4 ahead instead of 2 |
| Kitten Mittens | Shadow-Silk Gloves | −2 tiles off every creature's sight; a skeleton's 7 becomes 5 |
| Fight Milk | *Legendary draught* | Drunk: stamina regen 22/s → 37.4/s, −20 max stamina, rest of the delve |

**Depth.** Legendary only becomes available at depth 6 (`rarityAvailableAtDepth`),
so relics are a bottom-of-the-dungeon thing by construction. Each also carries
its own `minDepth`.

**The King's promise.** The Ashen King's guaranteed Legendary is always one this
playthrough has **never held**, until the whole set has dropped; after that it is
any of them. Elsewhere an unseen relic is weighted ×6 against one you have.

**Two records, because holding is not knowing.**

| | Field | Written when | Drives |
|---|---|---|---|
| Held | `lifetime.uniquesSeen` | it enters your **pack** | the King's "never held" promise |
| Named | `lifetime.uniquesKnown` | it is **identified** | the codex entry |

A relic left on the floor or lost with the run was never held. A relic in your
pack that the appraiser has not seen shows in the codex as *unappraised* — a
shape you are carrying and nothing more. The name is supposed to land at the
appraiser, and a codex that opened on pickup would hand you the identification
for free.

**Fight Milk** is the one Legendary you drink. It is never stocked by a merchant
and never craftable: `0.8% × depthFactor` in a chest, `3% × depthFactor` in a
vault or secret chest, where `depthFactor` runs 0 at depth 1 to 1 at depth 5.
Delve-long draughts live in `run.tonics`, deliberately separate from `blessing`
so finding one never costs you a shrine's favour, and drinking a second bottle of
something already in you does nothing and keeps the bottle.

**The codex** (Bestiary → Relics) lists all nine, locked to a silhouette until
found. Under `vite dev` each has an Unlock/Relock bench, the same as the creature
animation bench, so a new icon and a new effect can be read without a lucky drop.

### Containers

Each newly generated chest has a deterministic **12% chance to be a mimic**. It looks almost right: two pale points interrupt the lid seam, visible to someone who has learned to check without announcing the trick to a first-time player. Opening one makes it split into a maw and unfold eight wooden legs, with a brief moment to react before this unusually tough, fast monster attacks. Killing it releases the same tier of hoard the chest would have contained, including vault and secret-chest rewards.

| Source | Contents |
|---|---|
| Urn / barrel | 40% a material (1–2), 30% gold `2 – (6 + 3×depth)`, 3% potion, 5% valuable |
| Chest | `10–22 × depth` gold, 1–2 material stacks, 17% gear, 12% potion, 18% valuable, 10% gem, 7% identify scroll, 5% blueprint, 0.8%×depth Fight Milk. Loot find scales the gear, valuable and gem rolls |
| Vault / secret chest | `40–75 × depth` gold, an Uncommon+ item (Rare+ from depth 4; 25% a second Uncommon+), a valuable, a gem, 35%/70% blueprint, 35% a good consumable, 3%×depth Fight Milk |

Vault rooms contain one premium chest. Special chests roll at the current depth rather than advancing every reward table by one floor.

**Most urns are nothing**, which is what makes the one with a gem in it worth the swing, and a chest's gear chance is less than half what it was — a chest that hands you a weapon every other time is a vending machine, and you stop reading the room it is standing in. Vaults and secret chests are deliberately left generous: they are behind a key and behind a wall you had to read, and they are the two places in the dungeon that are supposed to pay.

**How many are on a floor** (`src/systems/dungeon.ts`):

| Room | Contents |
|---|---|
| Start | 25% one urn |
| Ordinary / stairs room | 12% a chest, 45% an urn, 15% a second urn, 50% a bone pile |
| Treasure | a chest, 15% a second, 1–2 urns |
| Vault | the vault chest and a bone pile |
| Secret | the secret chest |
| Shrine | the shrine, 40% an urn |
| Throne | 2 urns, 2 bone piles |

Plus `1 + ⌈depth/2⌉` loose piles on the floor, each 55% a little gold (`2–5 × depth`) and otherwise a material stack. That comes to eight or nine lootable things on a floor against a sixteen-slot pack. It used to be nineteen, and if every room pays then no room is worth remembering.

---

## 8. Materials and commodities

*File: `src/data/materials.ts`* — 30 tradeable goods. Tier drives crafted stats; value is the market's fair price.

| Material | Category | Tier | Rarity | Value | Bonus as primary / catalyst |
|---|---|---|---|---|---|
| Copper Ore | metal | 1 | Common | 8 | — |
| Iron Ore | metal | 2 | Common | 15 | — |
| Silver Ingot | metal | 3 | Uncommon | 42 | +3 Holy |
| Gold Nugget | metal | 3 | Rare | 75 | +3 Crit, +6 Find |
| Moonsilver | metal | 4 | Epic | 190 | +6 Frost, +4 Crit |
| Star Iron | metal | 5 | Legendary | 460 | +10 Shadow, +6 Attack, +5 Crit |
| Timber Plank | wood | 1 | Common | 5 | — |
| Yew Stave | wood | 2 | Uncommon | 22 | +3 Speed |
| Ironwood | wood | 3 | Rare | 64 | +2 Attack, +1 Defense |
| Rat Hide | hide | 1 | Common | 4 | — |
| Leather | hide | 2 | Common | 13 | — |
| Wyrm Leather | hide | 4 | Epic | 170 | +18 Health, +3 Defense |
| Dragon Scale | hide | 5 | Legendary | 520 | +10 Fire, +30 Health, +4 Defense |
| Linen | cloth | 1 | Common | 6 | — |
| Spider Silk | cloth | 3 | Uncommon | 36 | +4 Speed |
| Shadow Silk | cloth | 4 | Epic | 155 | +7 Shadow, +4 Crit, +4 Speed |
| Bone | bone | 1 | Common | 3 | — |
| Jade | gem | 2 | Uncommon | 46 | catalyst → Vital (+Health) |
| Crystal Shard | gem | 2 | Uncommon | 40 | catalyst → Tireless (+Stamina) |
| Moonstone | gem | 3 | Rare | 92 | catalyst → Lucky (+Crit) |
| Emerald | gem | 3 | Rare | 110 | catalyst → of Plunder (+Loot Find) |
| Frost Shard | gem | 3 | Rare | 96 | catalyst → Rimed (+Frost) |
| Sunstone | gem | 3 | Rare | 104 | catalyst → Blessed (+Holy) |
| Wardstone | gem | 3 | Rare | 98 | catalyst → of the Vigil (+Spell Focus) |
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

Bases are arranged into **gear lines** (`GEAR_LINES`), each running from the crudest piece to the strongest: dagger → short sword → long sword, club → mace → mining pick → war axe, buckler → kite → tower, cap → helm → great helm, jerkin → hauberk → plate, gloves → gauntlets, with spear, robe, band and pendant standing alone. Every step up a line is tuned to **beat the step below it forged two material tiers better** — a copper long sword edges out a silver short sword — so upgrading the base is always worth more than upgrading the metal. Each step also starts dropping one depth later and is proportionally scarcer in the drop table. Nothing is gated: a line is a power ordering, not an unlock chain.

| Base | Slot | Stats (tier 1) | Per tier | Windup / recovery / stamina / reach | Value | From depth |
|---|---|---|---|---|---|---|
| Dagger | weapon | 5 atk, 5 crit | +3 atk, +1.5 crit | 0.12 / 0.26 / 10 / 1 (crits ×2.4) | 18 | 1 |
| Short Sword | weapon | 12 atk | +4 atk | 0.18 / 0.36 / 16 / 1 | 28 | 2 |
| Long Sword | weapon | 21 atk | +5.5 atk | 0.26 / 0.48 / 24 / 1 | 55 | 3 |
| War Axe | weapon | 36 atk | +3.5 atk | 0.36 / 0.62 / 22 / 1 | 60 | 4 |
| Mining Pick | weapon | 26 atk, 2 crit | +4 atk | 0.30 / 0.54 / 20 / 1 | 52 | 3 |
| Mace | weapon | 15 atk | +4.5 atk | 0.28 / 0.52 / 17 / 1 | 45 | 2 |
| Spear | weapon | 19 atk | +4.5 atk | 0.24 / 0.56 / 17 / **2** | 48 | 2 |
| Club | weapon (wood/bone) | 6 atk | +4 atk | 0.22 / 0.44 / 16 / 1 | 10 | 1 |
| Halberd | weapon **2H** | 28 atk | +5.5 atk | 0.34 / 0.66 / 22 / **2** **cleave** | 92 | 3 |
| Great Maul | weapon **2H** | 32 atk | +6.5 atk | 0.46 / 0.74 / 23 / 1 **cleave** | 96 | 4 |
| Greatsword | weapon **2H** | 30 atk | +6 atk | 0.38 / 0.60 / 24 / 1 **cleave** | 130 | 5 |
| Throwing Knives | weapon *thrown* | 5 atk | +1.4 atk | 0.14 / 0.30 / 8 / 1 in the hand | 26 | 2 |
| Throwing Axes | weapon *thrown* | 12 atk | +2.8 atk | 0.20 / 0.42 / 13 / 1 in the hand | 58 | 3 |
| Javelins | weapon *thrown* | 17 atk | +2.9 atk | 0.26 / 0.56 / 17 / **2** in the hand | 88 | 4 |
| Buckler | offhand | 1 def, 35 block | +1 def, +5 block | — | 18 | 1 |
| Kite Shield | offhand | 4 def, 55 block | +1.5 def, +5 block | — | 38 | 2 |
| Tower Shield | offhand | 8 def, 74 block, −10 speed | +2 def, +4 block | — | 60 | 3 |
| Cap | head (hide/cloth) | 1 def | +1 def | — | 9 | 1 |
| Helm | head (metal) | 4 def | +2 def | — | 30 | 2 |
| Great Helm | head (metal) | 9 def, 5 hp | +2.5 def | — | 55 | 3 |
| Robe | body (cloth) | 1 def, 10 stamina | +1 def, +5 stamina | — | 18 | 1 |
| Jerkin | body (hide) | 3 def | +2 def | — | 24 | 1 |
| Hauberk | body (metal) | 8 def, −5 speed | +3 def | — | 55 | 2 |
| Plate Armor | body (metal) | 15 def, −10 speed, −10 stamina | +4 def | — | 92 | 4 |
| Gloves | hands (hide/cloth) | 1 def, 3 speed | +1 def | — | 12 | 1 |
| Gauntlets | hands (metal) | 4 def, 1 atk | +1.5 def, +0.5 atk | — | 28 | 2 |
| Band | ring (metal) | 1 crit | +1 crit | — | 24 | 1 |
| Pendant | amulet (metal) | 5 hp | +5 hp | — | 34 | 2 |

### Weapon handling

Stamina does **not** regenerate mid-combo (`world.ts` gates regen on `attack === 'idle'` plus a 0.5s gap), so the axis that separates weapons is **how long one full bar lets you keep swinging, and what that bar buys**. Three classes:

| Class | Weapons | Feel |
|---|---|---|
| Blades | dagger, short sword, long sword | Highest DPS (45–58), smallest hits, shortest windup, shortest window (3.1–3.8s), worst damage per stamina (1.70–1.79) |
| Haft | club, mace, mining pick, war axe | Biggest hits (up to 50), longest windup (to 0.36s — you are committed), longest windows (4.5–5.5s), best damage per stamina (1.83–2.27) |
| Reach | spear, halberd | Reach 2; mid DPS, strong efficiency, hits from outside most enemies' range |
| Two-handed | greatsword, great maul, halberd | Best damage per stamina bar, a cleave that spills into the rank behind, two guard chips — bought with the whole offhand slot. See below |
| Thrown | throwing knives, throwing axes, javelins | A finite stock thrown at range, and a poor short weapon once it is gone. See below |

The **Dagger** is the crit weapon and the one build-scaling weapon. It carries its own Crit % (5, +1.5 per material tier) and crits for ×2.4 instead of ×1.6, so the same Crit % ring is worth more than twice as much on a dagger as on anything else. Bare it is an ordinary entry weapon (50 effective DPS, below a Short Sword); with +20 Crit % from gear it is second only to a Long Sword, and a build that stacks Crit % to the 60% cap makes it the strongest weapon in the game on both burst and damage per stamina bar. `lucky` and `fox` roll on every slot, and a tier-5 Band carries 5 on its own, so the cap is reachable if you commit to it.

A swing must be **paid for in full**: below its stamina cost the attack is refused. How tired you are still shows in the damage through `staminaPower` (down to a 40% floor), but a spent bar buys nothing. Holding attack on a fresh bar gives a burst — six swings with a short sword — then throttles to roughly one swing per second as regen trickles back.

Damage type is the second axis, and it is a **triangle**, not a ladder:

- **Blunt** crushes bone and rigid things — 1.5× on skeletons, 1.25× on the mimic, 1.2× on the Hollow Knight's plate.
- **Slash** opens unarmoured flesh — 1.4× on rats and goblins, 1.3× on spiders, 1.25× on ghouls; it skates off bone (0.6×) and plate (0.7×).
- **Pierce** punches through armour and hide — 1.25–1.35× on soft living things and 1.25× through the Hollow Knight's plate, but it finds nothing vital in a skeleton (0.55×) or a wraith (0.6×).

Averaged over the bestiary that lands at blunt ×1.13, slash ×0.99, pierce ×0.97, and every type now has four to six enemies weak to it. Blunt stays marginally ahead because the dungeon is undead-heavy, which is the point of the club line.

Neither axis alone picks a weapon. Ranked by burst the Long Sword leads (57 effective DPS); ranked by damage from one full stamina bar the order inverts and the War Axe leads (224 against the Long Sword's 177). Short fights favour blades, long ones favour haft.

Those two figures are a Rare kit with affixes. For a like-for-like comparison of the *bases* alone, `npm run tables` now prints a **weapon roster**: every base forged at tier 3 with no affixes, its average hit taken over the whole bestiary at each monster's home depth, and its DPS and damage-per-bar side by side. That is the table to read when placing a new weapon, and it is what the two-handed and thrown sections below are measured against.


### Two-handed weapons

Three bases take both hands: **Halberd**, **Great Maul**, **Greatsword**. Wearing one empties the offhand — `equipFrom` sends the shield back to whatever container the weapon came from, and refuses the swap outright if there is no room for it rather than eating the shield. `derivePlayer` applies the same rule a second time, independently, because the playtest harness and the boss arena build `Equipment` records by direct assignment and never call `equipFrom`; without it they would measure a maul *and* a tower shield and every number they print would be a build the game cannot produce.

| | With a shield | Two-handed | One-handed, no offhand |
|---|---|---|---|
| Block absorption | `stats.block`, 35–90% | **20%** | 30% |
| Parry | Unchanged | **Unchanged** | Unchanged |

The offhand is the most valuable slot in the game — a silver Tower Shield is +12 Defense and 82% block for a −10 speed tax — so the roster is held to a rule: **no two-hander may lead the weapon table on DPS.** `npm run tables` prints every base on one ladder, forged at tier 3 and averaged over the whole bestiary, which is where that gets checked:

| Base | DPS | Damage per stamina bar |
|---|---|---|
| War Axe | 38.5 | 172 |
| Long Sword | 38.0 | 117 |
| **Greatsword** | 37.8 | 154 |
| **Great Maul** | 35.2 | **184** — the highest in the game |
| **Halberd** | 33.0 | 150 |
| Spear | 29.6 | 139 |

The rule holds — the War Axe still leads and the Greatsword is a tenth of a point behind the Long Sword — but **the honest reading is that the two-handers win the long fight**. The Great Maul buys 57% more damage out of one bar than the Long Sword does, and the Halberd is the Spear with a bigger everything. What that costs is not in the table, because the table cannot see an empty offhand: 20% absorption instead of 82%, and none of the Defense. The trade is *survivability for sustain*, and it is meant to be a real choice in both directions rather than a strictly worse option with a consolation prize.

Each pays the shield back in something a shield cannot buy:

- **Cleave**, on all three, at **25%** of the blow. It is centred on **the thing you hit, not on you**: every one of the eight tiles touching the target takes a quarter — beside it, diagonally, and *behind* it. Your own tile is excluded, because a swing that wrapped back around would be free damage on whatever had already closed, which is precisely the position a two-hander is meant to be bad in; the main target is excluded because it already took the blow in full. A cleave that catches anything wears the weapon twice.

  That centring is the whole difference between the cleave and a shield. A guard only ever covers the tile you face; the cleave covers the rank *behind* the tile you face, which nothing else in the game reaches. With a halberd, whose target is two tiles out, the cleave lands three tiles deep into a corridor.

  Each cleaved blow is **glancing**: one guard chip, never the two a full two-handed swing is worth, and it never bashes a shield open. Walking a two-hander into a line of shieldbearers is not a shortcut through their guards.

  It is deliberately a spill rather than a second swing. Against three bodies packed around the one you hit, a tier-3 Great Maul does about 42 into the target and 10 into each of the others — 72 across the group in one 1.2s cycle for 23 stamina, against a Long Sword's 28 into one of them. Better, and not remotely a reason to go looking for a crowd: it is what makes being caught by one survivable, not what makes starting one correct.
- **Stagger** adds seconds to a struck enemy's attack cooldown — 0.5s for the halberd, 0.3s for the other two. It buys time; it does not cancel a wind-up, because cancelling wind-ups is the parry's job and stays the parry's job. Weapons with an explicit `stagger` no longer get the light-enemy wind-up interrupt, so it replaces that rather than stacking with it.
- **Two guard chips** instead of one, so a shielded enemy's guard breaks in two blows rather than three.
- The **halberd** keeps reach 2, the spear's trick, without a free hand for a shield.

They are **lines of one** in `GEAR_LINES`, like the spear. A line *step* is required to beat the step below it forged two material tiers better on its own stats, and a two-hander's compensation is paid in a slot that comparison cannot see; appending one to the blade or haft line would force it to be strictly better than everything under it. Each is tuned laterally against the whole ladder instead.

### Thrown weapons

Three bases are thrown rather than swung: **Throwing Knives**, **Throwing Axes**, **Javelins**. They are one-handed and keep a shield.

| Base | Stock (tier 1) | Per tier | Windup / recovery / stamina | Speed | Range | Power | Thrown DPS | A full stock is worth |
|---|---|---|---|---|---|---|---|---|
| Throwing Knives | 6 | +0.5 | 0.16 / 0.34 / 9 | 9 tiles/s | 4 | ×1.8 | 24.4 | 85 damage |
| Throwing Axes | 4 | +0.5 | 0.24 / 0.46 / 15 | 7 tiles/s | 5 | ×1.42 | 32.1 | 112 damage |
| Javelins | 2 | +0.5 | 0.32 / 0.58 / 19 | 8 tiles/s | 7 | ×1.54 | 33.3 | 90 damage |

DPS and stock value are measured at tier 3, averaged over the whole bestiary, by the weapon roster in `npm run tables`. Thrown, a javelin is the fourth-best weapon in the game at 33.3 DPS; in the hand it is 23.7, below a Mace. Read down the melee half of the same table and all three sit at the bottom — that gap is the weapon.

The `attack` on the base is the **melee** number — what the weapon is worth once the stock is gone — and `thrown.power` scales it up to what a throw actually does. Affixes and material ride along, which keeps thrown weapons inside the power ladder rather than beside it. Every one is deliberately worse in the hand than the cheapest melee weapon of its era, so a thrown weapon is a positioning tool you pay for, never a free upgrade.

**The stock is finite and per-delve.** It is filled once — the first time you carry that base into a delve — and nothing refills it afterwards: not descending a floor, not sleeping in town. A spent shaft flies, and where it stops — wall, enemy, or the end of its range — it lands on the floor as a marker on `Floor.thrown`, which persists with the floor: walk upstairs and back down and it is still lying where it fell. Walking over it collects it. **[R]** retrieves *every* landed shaft of the equipped base on the current floor from anywhere, and costs:

| | |
|---|---|
| Stamina | 60% of one throw's cost, per shaft recovered |
| Durability | One point of weapon wear per shaft recovered |
| Cooldown | 6s |
| Refused when | Busy, moving, stunned, mid-cast, or short of the stamina |

So running dry is a real event with a real cost to undo, and the loop is throw, run dry, and go and get them back — the weapon is a resource you manage across a room rather than a button you hold. Stock is tracked per *base*, not per item, so a second set of javelins in the pack is not a second magazine.

A landed shaft is a `Pickup`, never a resting `Projectile`: `updateProjectiles` deletes anything whose speed reaches zero on the same tick, and `changeFloor` discards the whole projectile array outright, so the conversion happens synchronously in the branch that stops the shaft.

---

## 9a. Sigils

*Files: `src/data/spells.ts`, `src/systems/spells.ts`, `src/world/world.ts` — `castSigil`, `resolveSigil`, `refundSigil`*

Five sigils exist and **you carry exactly one**, chosen in Bleakmere before you descend. That single constraint is the whole design: you can never hold both the escape and the control, so a fight is played with the tool you guessed at upstairs.

**There is no mana bar.** A mana bar makes the cost fungible — you top it up in town and the spell is free in the moment it matters. Instead each sigil has its own long cooldown and the cast is paid in **stamina**, out of the same bar that swings and blocks.

| Sigil | Cast | Stamina | Cooldown | What it does |
|---|---|---|---|---|
| Wardcry | 0.35s | 30 | 70s | Shoves the enemy you face back one tile and leaves it reeling: `recover` for 1.2s, attack cooldown +1.4s, guard dropped. Against a wall it takes 10% of its max health as blunt instead, capped at 25. A boss only eats the 0.5s attack delay. **It shouts** — every enemy within 8 tiles is alerted to your position, through walls |
| Snuff | 0.5s | 25 | 90s | Every enemy within 12 tiles that is not already mid-wind-up loses your trail and drops out of `chase`. Then you are in the dark for 8s, and unseeable for the first 3 |
| Sounding | 0.8s | 20 | 45s | Reveals every tile within 6, finds the traps in it, and calls the bearing of any secret door in range |
| Threshold | 0.5s | 25 | 80s | Consecrates the tile you stand on for 8s: the parry window is **doubled** (0.44s) and the parry cooldown drops to 0.45s. Step off it and it is gone |
| Temper | 1.2s | 15 | 90s | Mends the most worn thing you are wearing by 25% of its maximum durability |

**Wardcry grants no vulnerability.** A parry pays a second of doubled damage; the push pays nothing. That is what makes the spell strictly worse than a parry whenever a parry is available, which is the safety property that keeps it from replacing the guard. The push costing you the floor's attention is the second half of the same bargain.

**The cooldown runs at half speed while you are hunted** — any living enemy alerted within 8 tiles — so it recovers on the walk between fights and barely moves during one. Kills are the only thing that meaningfully shortens it mid-fight.

**A hit during the cast interrupts it** ("The sigil cast is broken by the blow.") and the cooldown does **not** start — the stamina is spent, the effect is not, and you may try again immediately.

### Cooldown on kill

Every kill takes time off the sigil, through `killEnemy`, so the sigil is a reward for fighting rather than a timer you wait out.

```
refund   = (2 + 8 × min(1, enemy.hp / 140)) × (1 + 0.25 × Warden's Vigil + Focus%/100)
applied  = min(refund, base cooldown × 0.20)
```

**20% of base cooldown is a hard per-kill cap**, so no build at any investment resets a sigil in fewer than five kills. Without the cap the maxed build resets Wardcry on three Hollow Knights and the throne room becomes a charge farm. A King-raised corpse pays once, not twice — `killEnemy` returns early on `e.risen`.

**Spell Focus %** is the item side of the same knob: it rolls as an affix and can be forged in, and it adds to the same multiplier as Warden's Vigil before the cap applies.

### Getting them

Sigil stones drop only where nothing else can carry them:

| Source | Chance |
|---|---|
| The Ashen King | Guaranteed, while any remain undiscovered |
| Vault and secret chests | 22% |
| Ordinary chests and chest mimics | 3%, scaled in from depth 1 to depth 5 |

The roll never offers a sigil you already know or are already carrying anywhere — stash, loadout, backpack or lying in a pickup on any floor of the current delve — so a run can never hand you a duplicate. It uses its own hashed stream (`sigil:<seed>:<depth>:<stream>`), so adding it did not reshuffle any floor that already existed.

A stone is **inscribed at the forge**, which consumes it permanently into `state.spells`, and **attuned** from the same bench. Attunement cannot change mid-delve unless a town portal is open — the same rule that governs restocking.

## The bestiary codex

*Files: `src/systems/bestiary.ts`, the Bestiary tab in `src/ui/town.ts`*

Every creature has a codex entry in three states:

| State | Shown |
|---|---|
| Unrecorded | A black silhouette and `???` |
| Met (killed at least once) | Silhouette, name, kill count, "notes needed" |
| Recorded (field notes read) | Full sprite, description, stats, **resistances**, and the animation bench |

**Field notes** drop from the creature they describe — `14%` a kill, guaranteed from the Ashen King — and only while that entry is unread, so the codex fills steadily and then stops costing drops. They are read where they lie: they never enter the pack, so a bad run cannot cost you the page and a full pack cannot block it.

The resistance row is the point. It is what tells you a Barrow Champion takes ×1.5 from blunt and shrugs off blades, which is the information the damage triangle is built around.

A recorded entry shows four tallies — **slain**, **deaths to it**, **best hit** landed on it and **worst taken** from it — alongside its own stats. All four accumulate from the first encounter whether or not the entry is read, so the numbers are already waiting the moment the notes are found. The same two extremes are kept lifetime-wide and shown in the Warden's Chronicle.

**The animation bench is a development tool and ships only in `vite dev`.** It hangs off `import.meta.env.DEV`, which Vite replaces at build time, so the whole block is dead-code eliminated from a production bundle — verified by grepping `dist` for its strings. It reproduces every state the dungeon renderer can put a creature in: both frames (played or held), the hurt, wind-up and death tints and the float hover, next to the sprite id, scale and swing timings, so a new sprite can be checked without hunting one down on a floor. It also carries an **Unlock / Relock** toggle for flipping an entry between the locked and recorded presentations. Its frame and tint controls stay disabled while an entry is unrecorded, so the locked view stays honest — a tint would otherwise paint the silhouette back in, and the attack frame's outline gives the shape away.

Stored as `state.bestiary`, added additively at save revision 12; an older save simply starts with an empty codex, and entries written before a field existed read as zero rather than breaking.

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
| Graven | prefix | Spell Focus | 3–6 | +0.5 | head, ring, amulet | 4 |
| of the Bear | suffix | Health | 6–12 | +2 | all | 2 |
| of the Fox | suffix | Crit | 2–5 | +0.4 | all | 1 |
| of Swiftness | suffix | Speed | 4–8 | +0.6 | weapon, hands, jewellery | 1 |
| of the Leech | suffix | Leech | 2–4 | +0.3 | weapon, jewellery | 3 |
| of Plunder | suffix | Find | 6–12 | +1.2 | all | 1 |
| of the Wall | suffix | Block | 5–10 | +0.6 | offhand | 1 |
| of Endurance | suffix | Stamina | 8–14 | +1.5 | all | 2 |
| of the Vigil | suffix | Spell Focus | 4–8 | +0.6 | head, ring, amulet | 3 |

At most 2 prefixes and 2 suffixes, never two affixes on the same stat.

### Consumables

| Item | Effect | Rarity | Value | Stack |
|---|---|---|---|---|
| Healing Draught | Restore 25% health | Common | 24 | 5 |
| Greater Healing | Restore 55% health | Rare | 70 | 5 |
| Stamina Tonic | Refill stamina | Common | 16 | 5 |
| Scroll of Identify | Identify one item in the pack | Uncommon | 30 | 10 |
| Scroll of Recall | 5s channel, then a two-way town portal | Rare | 95 | 5 |

---

## 10. Crafting

*Files: `src/systems/crafting.ts`, `src/data/recipes.ts`*

Every recipe has **material slots** — the first is the primary (it sets tier, colour and name), the rest are secondary, and most accept an optional **gem catalyst**.

- **Rarity** from the primary tier: tiers 1–2 → Common, 3 → Uncommon, 4 → Rare, 5 → Epic. A catalyst lifts it one step.
- **Item level** = `primary tier × 2 + catalyst tier`.
- **Affixes** are filled to match the item's rarity; a catalyst reserves one of those slots for its chosen affix (see the materials table).
- **Catalyst strength:** Tier 3 catalysts add +2 and Tier 4 catalysts add +5 to their guaranteed affix roll, making scarce gems meaningfully stronger than Jade and Crystal.
- **Quality** = `0.92–1.12 + 6% per Master Smith level`. Master Smith 3 adds an extra random affix, raising rarity when possible.
- **Recipe mastery:** the first blueprint unlocks a recipe at Rank 1. Advancing to Ranks 2, 3, 4, and 5 costs 2, 3, 4, and 5 duplicate blueprints respectively. Ranks 1–5 grant `0% / 8% / 16% / 26% / 40%` positive core stats and maximum durability.
- A craft records the recipe rank used to make it. Later mastery does not retroactively improve existing equipment, and old crafted gear without a recorded rank counts as Rank 1.
- Crafted items are always identified.

Blueprint rewards are one weighted draw over every depth-appropriate recipe. A recipe is weighted `0.4 ^ (position in its gear line)`, so a tier-1 blueprint is 2.5× scarcer than the line's entry piece and a tier-2 one 6.25× scarcer; an unknown recipe is worth **3×** its weight, and a Rank 5 one is worth nothing. Depth is the only gate — a recipe is never locked behind another recipe's mastery. Multiple blueprints rolled together avoid duplicates when alternatives exist. A capped recipe appears only when every eligible recipe is capped; extra copies can still be sold.

Known from the start: dagger, short sword, club, buckler, cap, jerkin, gloves, band. The rest come from blueprints found in the dungeon or bought (long sword 140, war axe 150, mining pick 115, mace 110, spear 120, kite shield 120, tower shield 200, helm 100, great helm 190, robe 80, hauberk 180, plate 320, gauntlets 110, pendant 130).

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
- **Stock:** the merchant holds 40 common / 14 uncommon / 5 rare / 2 epic units once that material's tier and rarity have been reached in the delve, restocking 30–70% per day. Legendary materials are never stocked.
- **Gear prices** use a separate daily sentiment per category (weapons, armour, jewellery). You sell gear for `value × sentiment × 0.5` (0.6 for other kinds) and buy at `value × sentiment × 1.35`.
- **Wares:** 6 rolled items (60% Common, 30% Uncommon, 9% Rare, 1% Epic before depth gates) plus 2 depth-appropriate blueprints, refreshed daily.
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

**Renown earned:** coming home gives `2 + 2 × deepest depth`, plus 25 for killing the boss — **unless you never went below depth 1, which pays nothing and does not turn the day either** (see section 1). Dying gives `depth − 1`.

| Upgrade | Effect per level | Costs |
|---|---|---|
| Pack Mule | +4 backpack slots | 3, 6, 11 |
| Toughness | +12 max health | 3, 6, 10, 15, 22 |
| Second Wind | +15 max stamina | 3, 7, 12 |
| Soul Pouch | Keep 3 backpack slots and 20% of carried gold on death | 5, 10, 16 |
| Silver Tongue | Merchants pay 4% more, charge 4% less | 4, 8, 13, 20 |
| Market Insider | L1 price history; L2 tomorrow's event | 5, 12 |
| Master Smith | +6% crafted quality; L3 an extra affix | 4, 9, 15 |
| Appraiser's Eye | L1 identify 40% cheaper; L2 Rare and lower drop identified | 5, 12 |
| Treasure Sense | +20% loot find | 6, 13, 22 |
| Supply Crate | Start each run with +1 Healing Draught | 5, 11, 18 |
| Lantern Wick | +1 unit of light radius (½ a tile). L1 also spots traps 3 tiles ahead instead of 2 | 3, 7, 12 |
| Warden's Vigil | +25% off your sigil's cooldown per kill, capped at a fifth of it | 6, 12, 20 |

The whole tree costs **371 renown** — 30 to 40 delves for a competent player, against 8 to 14 before the balance pass. The renown *payout* is unchanged: ordinary scripted profiles simply earn less, because they turn back or die sooner. `npm run playtest` reports renown per run against this total; it does not simulate buying the whole tree across many runs.

What did change is the tree's internal shape, because the dungeon moved under it. `scripts/upgrades.bench.ts` runs the same seeds with each upgrade maxed and alone, against no upgrades at all:

| | before | after | why |
|---|---|---|---|
| Pack Mule | 4, 8, 14 | 3, 6, 11 | Measured at **exactly zero** on depth, survival and haul: with a 16-slot pack and the new loot rates it never filled. Its job came back when the base pack dropped to 12, and the price came down to match an upgrade that is now situational rather than universal. |
| Supply Crate | 3, 6, 10 | 5, 11, 18 | The best buy in the tree by a distance — healing supply is what actually binds a deep delve, and three free draughts a run answered that for 19 renown. Still the best depth-per-renown in the tree at 34. |
| Treasure Sense | +12%, 5/10/16 | +20%, 6/13/22 | +36% find on drop rates that had themselves been halved measured as close to nothing — and what it *did* add was almost entirely Common, because the Common band's flat weight of 100 anchored the roll. Find now divides that weight as well as multiplying the good bands, so it moves quality and not just quantity: at +60 it is +22% gear pieces and **+85% more Uncommons**. Dearer accordingly. |

Five upgrades were **not** repriced, because the harness cannot see them and a number it cannot see is not evidence. Silver Tongue, Market Insider, Master Smith and Appraiser's Eye are entirely town-side, and the scripted bot never visits town. Second Wind measures at zero as well, but only because a slow weapon's stamina regeneration roughly matches its cost per swing — it binds for fast weapons, which the bot does not carry.

---

## 14. Carrying, dying, extracting

*Files: `src/state/inventory.ts`, `src/systems/run.ts`*

- **Backpack:** 12 slots (+4 per Pack Mule). Materials stack 20 per slot, consumables 5–10, gear 1. It was 16, sized against a dungeon that handed you forty items a floor; with loot cut by about sixty percent a deep delve peaks around nineteen slots, so 16 never filled and Pack Mule was worth measurably nothing.
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

- **Renderer** (`src/render/`): Three.js at 240p with vertex snapping, affine texture warping, per-pixel torch lighting, distance fog and a 15-bit dither pass, upscaled with nearest sampling. You carry a whiter light than the wall torches so colours read true up close: **9.5 units of radius**, +1 per Lantern Wick level, +4 for Bergholt's Bright Error, against fog that runs from 4 to 18 — so even a full lantern leaves the corridor fading to black well before the end. Sprites are billboards; the weapon is drawn in screen space.
- **Art** (`src/art/`): every texture, sprite and icon is a palette-indexed character grid. Characters `1`–`4` are a ramp recoloured per material; colours ending in alpha `fa` glow in the dark. PNGs listed in `public/art/manifest.json` override the built-in art.
- **Audio** (`src/audio/sfx.ts`): all synthesised at runtime — no audio files. Effects are panned by direction and quietened by distance; each biome has its own drone. Everything suspends when the app is in the background.

---

## 17. Where to change things

| Want to change | File |
|---|---|
| Monster stats, drops, depth ranges | `src/data/enemies.ts` |
| How monsters scale with the floor | `src/systems/dungeon.ts` (`depthPower`, `attackPower`, `defensePower`) |
| Relics: names, effects, flavour, depths | `src/data/uniques.ts` |
| Delve-long draught effects | `TONICS` in `src/world/world.ts` |
| Materials, tiers, values, catalysts | `src/data/materials.ts` |
| Weapon/armour bases and swing timings | `src/data/items.ts` |
| Affix pool and roll sizes | `src/data/affixes.ts` |
| Recipes and blueprint prices | `src/data/recipes.ts` |
| Durability pools, wear and repair cost | `src/systems/items.ts` |
| Biomes, depth count | `src/data/biomes.ts` |
| Damage formulas, difficulty multiplier | `src/systems/combat.ts` |
| Parry window, stun and reflect | `src/world/world.ts` (`PARRY_*`) |
| Sigil effects, cast times and cooldowns | `src/data/spells.ts`, `src/world/world.ts` (`resolveSigil`) |
| Cooldown-on-kill refund and its cap | `src/world/world.ts` (`refundSigil`) |
| Two-handed rule, cleave and stagger | `src/systems/equip.ts`, `src/systems/player.ts`, `src/data/items.ts` (`CLEAVE`), `src/world/world.ts` (`cleave`) |
| Thrown stock, flight and retrieval | `src/data/items.ts` (`thrown`), `src/world/world.ts` (`RETRIEVE_*`) |
| Movement, stamina, AI, interaction | `src/world/world.ts` |
| Layout generation, room and prop density | `src/systems/dungeon.ts` |
| Trap damage, salvage, spotting range | `src/world/world.ts` (`TRAPS`) |
| Drop tables and rarity odds | `src/systems/items.ts` |
| Price model and events | `src/systems/market.ts` |
| Contracts | `src/systems/contracts.ts` |
| Upgrades and renown | `src/systems/meta.ts` |
| Shrine flavours, blessings and curses | `src/world/world.ts` (`BLESSINGS`, `CURSES`), `src/systems/dungeon.ts` (`shrineKindFor`) |
| Mimic odds | `src/systems/dungeon.ts` (`chestIsMimic`) |
| Light radius and lantern levels | `src/systems/meta.ts` |

**Keep this file updated** whenever those change: the tables above are meant to be the single reference for balance discussions. The monster stat and drop tables in section 5 are *generated* — run

```sh
npx vitest run --config vitest.playtest.config.ts scripts/mechanics.bench.ts
```

and paste the result in, rather than editing seventeen rows by hand and getting one of them wrong.

**Measuring a change:** `npm run playtest` writes a full report — the ladder (each floor against the gear it is meant to be reached with), floor composition, loot yield, every matchup, and scripted runs for fresh, mid-gear, endgame and prepared characters under several policies. It takes a couple of minutes. `npm run tables` alone runs in seconds and is the one to use between individual knobs.

Work that is designed but not built lives in [NEXT.md](NEXT.md); the account-sync brief is in [SUPABASE_SYNC.md](SUPABASE_SYNC.md).
