# Weapon overhaul — integration map

Read-only code survey, branch `feat/weapon-overhaul`, HEAD `10ef6ff`, 2026-09-14.
Scope: two-handed weapon bases, thrown/recoverable ammo with an **R** recall key,
and a utility-spell system with kill-triggered cooldown reduction (renown talent +
item property + crafting hook). Nothing in the working tree was changed to produce
this report.

## Baseline (before any work)

```
npm test 2>&1 | tail -20
```
`src/__tests__/uniques.test.ts` — **1 failed / 39 in that file**, pre-existing and
unrelated to this feature:
```
FAIL  the effects > The Implication banks parries and loses them to an unblocked hit
AssertionError: expected 70 to be less than 70   (uniques.test.ts:295)
```
Totals: **Test Files 1 failed | 30 passed (31)**, **Tests 1 failed | 405 passed (406)**.

```
npm run build 2>&1 | tail -20
```
`tsc --noEmit && vite build` — **succeeds**. Output warns only about the 858 KB
main chunk exceeding the 500 KB advisory limit (pre-existing, not an error).

Anyone starting this work should expect exactly that one pre-existing uniques
failure and a clean build; any other new failure is this feature's doing.

---

## 1. Every read of `ItemBaseDef.swing`, `weaponClass`, `damageType`, or `slot === 'weapon'`

| path:line | What is there now | What must change |
|---|---|---|
| `src/types.ts:135` | `export type WeaponClass = 'blade' \| 'dagger' \| 'axe' \| 'blunt' \| 'spear' \| 'pick'` | Add new classes (e.g. a bow/thrown class) here first — everything below keys off this union. |
| `src/types.ts:161-169` | `ItemBaseDef.weaponClass?`, `.damageType?`, `.swing?: SwingProfile` all optional | A two-handed melee weapon fits as-is (has `swing`); a thrown/ranged weapon needs a decision — does it have a `SwingProfile` (windup/recovery/reach) or a new throw-specific timing shape? `SwingProfile.reach` is tiles-in-front, meaningless for a projectile. |
| `src/data/items.ts:6-44` | 8 weapon bases, each one row: `slot:'weapon', weaponClass, damageType, base/perTier stats, primary materials, swing, value, minDepth, weight` | New bases append here. **Also** must be added to `GEAR_LINES` (line 158) and get a matching `RecipeDef` in `src/data/recipes.ts` (see §9) — both are validated by `items.test.ts`. |
| `src/data/items.ts:203-211` | `viewmodelFor(weaponClass)` — a `switch` mapping `axe/pick/blunt/spear` to a `vm_*` id, **default falls through to `vm_blade`** | A new `weaponClass` that should render as anything other than a sword-in-hand needs an explicit `case`, or it silently renders as `vm_blade`. A two-handed weapon that should show a different viewmodel (e.g. gripped with both hands) needs a new `vm_*` id here **and** a matching `ArtDef` (§8). |
| `src/systems/player.ts:106-108,133-152` | `derivePlayer` reads `weapon.swing`, `weapon.damageType`, `weapon.weaponClass` to build `PlayerDerived` | Any new weapon shape (ranged windup, throw arc) that isn't a plain melee `SwingProfile` needs new fields on `PlayerDerived` and new logic here — this is the single place combat numbers are assembled from equipment. |
| `src/systems/combat.ts:54,68` | `e.resist[p.damageType]`, `dmg *= p.swing.critMult ?? DEFAULT_CRIT_MULT` | Reads `PlayerDerived`, not the item directly — fine as long as `derivePlayer` keeps populating `damageType`/`swing.critMult` for the new weapons. |
| `src/world/world.ts:920` | `itemBase(weapon.ref).weaponClass === 'pick'` — the 1% "Rock and Stone!" flavour roll, gated on pick specifically | Not weapon-overhaul-critical, but shows the pattern of hard-coding a `weaponClass` check inline; a thrown-weapon-specific flavour hook would look the same. |
| `src/world/world.ts:2322` | `return { id: viewmodelFor(itemBase(w.ref).weaponClass), materialId: w.materialId }` — enemy-mimic/monster viewmodel lookup (`weaponArt()` at :415 uses the equivalent for the player) | Same `viewmodelFor` dependency as above. |
| `src/ui/dom.ts:308,311-315` | Tooltip: `${SLOT_LABEL[base.slot]}${base.damageType ? … : ''}`, and if `base.swing` exists shows `Reach … · swing … · stamina …` | A thrown/ranged weapon without a melee `SwingProfile` will render this line as if it were the fist (line is skipped entirely when `swing` is absent — no reach/stamina text shows at all). Needs an explicit ranged-stat line. |
| `src/ui/dungeon-ui.ts:41` | `statSheet`: `['Attack', `${d.attack} ${d.damageType}`]` | Fine as long as `derived.damageType` stays populated for the new weapon type. |
| `src/ui/town.ts:1268` | Enemy detail panel: `` `${def.hp} HP · ${def.attack} attack · ${def.defense} defense · deals ${def.damageType} · ${def.behavior}` `` | Unaffected by player weapons; relevant only if new enemy ranged behaviour is added alongside. |
| `src/dev/art-sheets.ts:172-173,186-190` | `viewmodelCells`/`iconGroups` iterate `ITEM_BASES` filtering `b.slot === 'weapon'` and calling `viewmodelFor(b.weaponClass)` | Auto-updates for any new weapon base **as long as** `viewmodelFor` has a case for the new class — no manual sheet wiring needed otherwise. |
| `src/__tests__/art.test.ts:45` | `for (const b of ITEM_BASES) if (b.slot === 'weapon') needed.add(viewmodelFor(b.weaponClass))` then asserts `getArt(id)` exists for every needed id | **Will fail** the moment a new weapon base resolves to a `vm_*` id with no `ArtDef` registered. |
| `src/__tests__/items.test.ts:52,308` | `expect(base.damageType).toBe('pierce')` (mining pick), `expect(armed.damageType).toBe('blunt')` (unarmed) | Unaffected unless these specific bases change. |
| `src/__tests__/items.test.ts:195` | `` const key = itemBase(line[i]).slot === 'weapon' ? 'attack' : 'defense' `` inside the gear-line ordering test | New weapon lines are covered by this generically, as long as they're added to `GEAR_LINES`. |
| `src/__tests__/hard-golden.test.ts:72` | `for (const slot of ['weapon', 'head', 'chest', 'hands', 'legs', 'offhand'] …) rollEquipment(...)` | See §9 — new weapon bases change the weighted pool `rollEquipment` draws from, which moves this pinned hash. |
| `scripts/tables.ts:181,206-209` | Per-base cycle/swings-per-bar tables computed from `d.swing` | A weapon with no `SwingProfile` (pure ranged) will need either a synthetic swing-equivalent or a special-cased table row, or `tables.ts` throws/produces garbage for it (`d.swing.windup` on `undefined`). |
| `scripts/playtest.ts:310,324,498,531` | Bot policy reads `d.swing.staminaCost`/`.windup`/`.recovery` to decide when to attack | Same risk: a weapon whose `derived.swing` isn't a normal melee profile needs the bot's attack-decision logic touched, or it will misbehave (attack too often/never) once such a weapon enters `LADDER` gearing. |
| `scripts/mechanics.bench.ts:28,45` | Enemy table generator reads `e.projectile.damageType`/`e.damageType` — enemy-side, not player weapons | Only relevant if new player ammo reuses `ProjectileDef`. |

---

## 2. Offhand independence from the weapon slot

**Finding: there is currently no cross-slot invariant of any kind.** Equip/unequip
is purely per-slot; nothing prevents (or even notices) a weapon and an offhand
item being worn together. Two-handed weapons **must add this check from
scratch** — it doesn't exist to relax.

| path:line | What is there now | What must change |
|---|---|---|
| `src/systems/equip.ts:15-27` (`equipFrom`) | Looks up `target` slot, checks `slotOf(target) !== itemBase(item.ref).slot`, swaps the item in; **no check against any other slot** | Must reject (or auto-unequip) the offhand when equipping a two-handed weapon, and vice versa. This is the single choke point for equipping from both the dungeon overlay and the town stash (`equipFrom` is called from both `src/ui/dungeon-ui.ts:175` and `src/ui/town.ts:945`), so a fix here covers both UIs. |
| `src/systems/equip.ts:29-36` (`unequipTo`) | Only checks pack space (`canFit`) | No change needed for unequip itself, but the *equip* path must be able to call this internally to auto-bump the offhand (or refuse and return an error string, matching the existing `'Wrong slot.'`/`'No room in your pack.'` error convention). |
| `src/systems/player.ts:136,157` (`derivePlayer`) | `const hasShield = !!eq.offhand;` and `block: hasShield ? … : weapon ? 0.3 : 0.12` | Purely a function of `eq.offhand`; it will happily compute shield-block numbers for an offhand item worn alongside a two-handed weapon if `equip.ts` doesn't prevent that state from ever existing. Once equip-time enforcement exists, no change is needed here — but if enforcement is instead done only in UI (not in `equip.ts`), this function has no defence of its own and a bad save (e.g. hand-edited, or a bug) will silently compute stats for an illegal loadout. |
| `src/render/dungeon-renderer.ts:456-458` | `const offhand = world.state.equipment.offhand; sh.mesh.visible = !!offhand;` | Same as above — purely reactive to whatever is in `eq.offhand`. Will show a shield floating in the off hand of a two-handed grip unless equip-time enforcement keeps that combination from existing. No renderer-side check today. |
| `src/render/dungeon-renderer.ts:415` (`weaponArt()`) | Draws the main-hand viewmodel from `world.weaponArt()` | If a two-handed weapon viewmodel is meant to visually occupy both hand slots (e.g. no separate shield mesh at all), this is where that single combined viewmodel would be selected — currently it only ever draws one weapon mesh, independent of `offhand`. |
| `src/ui/dungeon-ui.ts:15-24` (`DOLL`) | Paper-doll grid: `weapon` at `2/1`, `offhand` at `2/3`, both always drawn as separate slots | No graying-out/disabling of the offhand slot when a two-handed weapon is worn — clicking it would call `unequipTo` on `null` (harmless, returns `null`) but there's no visual cue the slot is unusable. |
| `src/ui/dungeon-ui.ts:214,250-256,284,304` | `defaultSlot`/`equipFrom`/`unequipTo` calls in the pack grid, paper-doll click handler, and loot comparison | All funnel through `equip.ts`, so fixing `equipFrom`/`unequipTo` there is sufficient for this file; no independent logic to patch. |
| `src/ui/town.ts:410,669,925,935,945` | Same functions (`defaultSlot`, `equipFrom`, `unequipTo`) used for the town stash/equip flow | Same — covered by the `equip.ts` fix. |
| `scripts/playtest.ts:611` | `for (const slot of ['weapon', 'offhand', 'body', 'head', 'hands'] …)` — end-of-run broken-gear tally | Not an equip path (read-only), unaffected. |
| `scripts/playtest.ts` gearing (`geared`, `LADDER`, search for equip calls) | The bot's starting kits are built directly by constructing `Equipment` objects, **not** through `equipFrom` | If the harness ever gears a bot with a two-handed weapon *and* a shield, it will bypass whatever invariant is added to `equip.ts`, because the harness never calls `equip.ts` — it assigns `eq.weapon =`/`eq.offhand =` directly. `derivePlayer` (which the harness does call) is therefore the only enforcement point that actually reaches the playtest bots; relying solely on `equip.ts` leaves the harness able to construct illegal loadouts. |
| `src/dev/boss-arena.ts:30` | `for (const s of [...]) e[s] = null;` then presumably assigns endgame gear (only the clear loop was inspected) | Same risk as the harness: gear is assigned directly to the `Equipment` record, not through `equip.ts`. |
| `src/data/affixes.ts:4,6` | `ARMOR`/`ALL` slot lists include `'offhand'` for affix rolling | Unaffected — affixes still roll per-slot; a two-handed weapon simply never has an offhand item to roll affixes onto. |

**Net**: the cleanest single enforcement point is `equip.ts`, but it is not the
*only* place `Equipment` objects are constructed (playtest harness and boss-arena
dev tool build them by direct field assignment). A defence-in-depth choice —
enforce in `equip.ts` for real play, and also make `derivePlayer` ignore/zero an
illegal offhand when a two-handed weapon is present — would keep the playtest
harness and any hand-edited save from producing nonsensical stats even though
they never call `equip.ts`.

---

## 3. Full projectile lifecycle

| path:line | What is there now |
|---|---|
| `src/world/world.ts:68-86` | `interface Projectile { id, x, y, dx, dy, speed, damage, type, sprite, light?, tileX, tileY, source, sourceId?, reflected? }` — defined **in `world.ts`**, not `types.ts`. |
| `src/world/world.ts:325` | `projectiles: Projectile[] = []` — a plain runtime array on `World`, not on `RunState`. |
| `src/world/world.ts:2081-2097` (creation) | Only enemies create them, inside `enemyAttacks()`/similar: `useRanged = !!def.projectile && (behavior === 'ranged' \|\| …)`, then `this.projectiles.push({...})` per shot (supports volleys via `def.volley`). **There is currently no player-thrown-weapon creation path at all.** |
| `src/world/world.ts:2201-2236` (`updateProjectiles`) | Advances `pr.x/y` by `dx*speed*dt`; on crossing a tile boundary: if `blocksSight(f, tx, ty)` → `pr.speed = 0` (wall hit, plays `'break'` sfx) and the loop `continue`s; if `pr.reflected` → look for `enemyAt`, call `reflectedHit` and zero speed; otherwise if it reaches the player's tile → parry check or `damagePlayer`. |
| `src/world/world.ts:2235` | `this.projectiles = this.projectiles.filter((pr) => pr.speed > 0);` — **run once per tick after the loop above**, meaning a projectile that just had its speed zeroed (wall or player hit) is deleted on the very next filter pass. Nothing about a stopped projectile survives even one extra frame as a distinct object — there is no "projectile at rest" state today. |
| `src/world/world.ts:691` | `this.projectiles = [];` inside `changeFloor` — **all in-flight projectiles are discarded outright on every floor transition**, no exceptions. |
| `src/world/world.ts:1836` | `this.projectiles = this.projectiles.filter((pr) => pr.sourceId !== e.def);` — also purged when the enemy that owns them is despawned/killed under some circumstance (verify exact call site before relying on this; only the filter line itself was inspected). |
| `src/world/world.ts:2239-2255` (`reflect`) | A parried incoming bolt: flips `dx/dy`, sets `reflected = true`, `source = 'your own parry'`, repositions to the player's tile. This is the **only** existing mechanism by which a projectile ever becomes "friendly" (able to hurt enemies). |
| `src/world/world.ts:2277-2286` (`reflectedHit`) | Applies `pr.damage * def.resist[pr.type]` to an enemy, floors at 1 damage, records bestiary damage, floats text, plays `'hit'` sfx, kills on `hp <= 0`. This is the **only** existing "projectile damages a monster" code path. |
| `src/render/dungeon-renderer.ts:242,374` | Two render passes over `world.projectiles` (likely billboard sprite + light) — purely reads the live array each frame, no independent state. |
| `src/state/game-state.ts` (`RunState`, whole file) | **No `projectiles` field anywhere.** `RunState` persists `floors`, `player`, `backpack`, `gold`, `keys`, `blessing`, `curse`, `tonics`, `portal`, `stats`, `outcome` — nothing about in-flight or landed projectiles. |
| `src/state/save-format.ts`, `src/state/migrations.ts` | Neither file references `Projectile` or `projectiles` at all — confirmed by grep. |

**Consequence for thrown/recoverable ammo**: a `Projectile` is pure per-session
render/physics state that is unconditionally wiped on floor change and never
serialized. **A thrown weapon that should "land in the world and be picked up,
survive walking upstairs and back down" cannot be represented as a `Projectile`
at rest** — it must be converted into a `Pickup` (§4) the instant it stops
moving (wall hit, max range, or enemy hit), because `Pickup`s live on `Floor`,
which *is* persisted (`RunState.floors`). The natural hook is right where
`pr.speed = 0` is set on a wall hit (`world.ts:2211-2214`) and wherever a
player-thrown projectile would resolve against an enemy — both need a new
branch that calls something like `dropLoot(tileX, tileY, [thrownItem], 0)`
instead of (or in addition to) letting the projectile filter itself away one
frame later.

The **R** recall key then has nothing to "recall" in the projectile system
itself — it would need to look up nearby `Pickup`s created this way (or track
which `Pickup`s hold thrown-weapon items) and either teleport the item to the
player or walk it back, similar to how `Scroll of Recall`'s `anim.recall`
countdown works (`src/world/world.ts`, `ConsumableEffect` type `'recall'` in
`src/types.ts:180`) — **note the name collision**: the existing recall scroll
already uses `this.anim.recall` and the message "The recall is broken by the
blow." / "The recall fizzles." A second, unrelated "recall my thrown weapon"
feature reusing the word "recall" in logs/state risks confusing the two;
verify no shared field name is reused by accident.

---

## 4. `Pickup` and `Prop` — which fits a thrown weapon on the ground

| path:line | What is there now |
|---|---|
| `src/systems/dungeon.ts:106-113` | `interface Pickup { id, x, y, items: Item[], gold, keyId? }` — a bag of loot sitting on a tile. Lightweight, generic, holds arbitrary `Item[]`. |
| `src/systems/dungeon.ts:62-75` | `interface Prop { id, kind: PropKind, x, y, used, tier, blocking, mimic, shrine? }` — a *world-generation feature* (chest/urn/barrel/shrine/portal/town_portal), seeded and regenerated with the floor, with its own interaction verb per `kind` (open/smash/pray/step-through) and its own `used` flag that must not be re-rolled on load (see `migrations.ts:66-70` — mimic flag frozen at gen time). |
| `src/world/world.ts:1206-1219` (`dropLoot`) | **Already exactly the mechanism a thrown weapon landing needs**: finds-or-creates a `Pickup` at `(x, y)` on the current floor, pushes items onto it, merges gold, and if the player happens to already be standing there, immediately auto-collects it (`collectLoose`). Used today for enemy death drops, player `drop()`, and trap-disarm salvage. |
| `src/world/world.ts:1612-1628` (`drop`) | Player-initiated "put this pack item back on the ground" — calls `dropLoot(player.x, player.y, [it], 0)` (or pushes onto an already-open pile). **This is the closest existing analogue to "a weapon leaves your hand and lands on a tile."** |
| `src/world/world.ts:1573-1606` (`take`) | Moves items from a `Pickup` into the backpack; handles `lore` specially, tracks `stats.itemsFound`, prunes the pile if emptied. Generic over `Item.kind` — an equipment item (a thrown axe) needs no special-casing here. |
| `src/world/world.ts:652` (`collectLoose`) | Auto-pickup when standing on a pile (referenced from two call sites; body not read in this pass — treat as "auto-collects gold/whatever is on the player's own tile," consistent with the comment at `dropLoot:1217`). |
| `src/world/world.ts:1350-1357` (`pickupNear`) | Finds a `Pickup` either on the player's own tile or the tile directly ahead (blocked by `blocksSight`). A thrown weapon resting one tile away is found by this **only if the player is facing it** — no omnidirectional "loot nearby" query exists. |
| `src/world/world.ts:1234-1262` (`interactionHint`) | Returns `'Search'` when `pickupNear()` is truthy, after checking doors/secrets/traps/props/portal/stairs in priority order. A `Pickup` never wins over a `Prop` on the same tile — not relevant unless a thrown weapon can land on a prop tile, which is plausible (thrown into a chest's tile) and untested. |
| `src/world/world.ts:1268-1283` (`contextAction`) | One-button touch action: attacks first if an enemy is in reach, else defers to `interactionHint`, with a special case that a `'Search'` hint loses to an attack when `threatNear()`. A `Pickup`-based thrown weapon inherits this for free. |
| `src/systems/dungeon.ts:335` (`generateFloor`) | Regenerates `props`/`pickups`/etc from `(runSeed, depth)` — **but only when a floor doesn't already exist** (`world.ts:682`: `if (!run.floors[run.depth - 1]) run.floors[...] = generateFloor(...)`). Once generated, a floor's `pickups` array is mutated in place and persists in `RunState.floors` for the rest of the run (and across a save/reload, since `Floor` is fully serialized). |

**Verdict**: `Pickup` is unambiguously the right fit. It already has everything
needed — persistence via `Floor`, generic `Item[]` payload, an existing
find/take/interact code path, and an existing "drop from hand onto a tile"
call (`dropLoot`) that a thrown weapon's landing can reuse directly. `Prop` is
the wrong fit: it's tied to floor generation (seeded once, not spawned
mid-combat), carries fields (`tier`, `mimic`, `shrine`) meaningless to a
weapon, and its `used`/`blocking` semantics don't map onto "carry this away."

**Cost of the `Pickup` route**: a new call site (or a small helper) invoked
from the projectile-stop branches in `updateProjectiles` (§3) that builds an
`Item` for the thrown weapon and calls `dropLoot`; `pickupNear`'s
facing-only detection may feel wrong for a weapon that lands off to the side
after a miss (worth checking against the intended feel, though this report
does not judge design); and `interactionHint`/`contextAction`'s priority order
needs checking against thrown weapons landing on top of a `Prop` tile (chest,
shrine) — currently untested territory since only enemy/player drops create
`Pickup`s today and neither can land on a blocking prop tile in the first
place (props usually block movement, so a projectile flying over one would hit
it as a wall via `blocksSight`/`blocksMove` well before reaching the tile).

---

## 5. Input — every key-binding and controls-documentation site

| path:line | What is there | Goes stale when adding R / spell key? |
|---|---|---|
| `src/main.ts:662-666` (`MOVES`) | `w/arrowup→forward, s/arrowdown→back, a/arrowleft→turnLeft, d/arrowright→turnRight, q→left, e→right` | No — `r` and the spell key aren't movement, add new `case`s in the `switch` below instead. |
| `src/main.ts:668-718` (`keydown`) | `switch(k)`: `' '`→attack, `shift`→block, `f`/`enter`→interact, `i`/`tab`→inventory, `m`→map, `escape`/`h`→help, `1`-`4`→`quickUse` | Add `case 'r':` (recall thrown ammo) and a spell-key case here. `r` is currently unbound — confirmed no existing use of `'r'` in this switch or `MOVES`. |
| `src/main.ts:720-725` (`keyup`) | Only releases movement keys and `shift` (block) | A hold-to-something recall or spell would need a matching keyup case; a tap-to-fire one would not. |
| `src/main.ts:728-733` | Mouse: LMB → attack, RMB → block | Unaffected unless a spell/throw also wants a mouse binding. |
| `src/ui/touch.ts:10-19` (`TouchHandlers`) | Interface has exactly `move, tap, action, block, open` — **no slot for a third/fourth button action** | Needs new interface methods (`recall`? `spell`?) and `main.ts` must wire them to `world` calls, mirroring how `action`/`block` are wired today. |
| `src/ui/touch.ts:118-172` (`TouchControls`) | Buttons instantiated: drag pad, `main` (atk/interact, via `hold()`), `block` (shield), plus a 3-button `tmenu` (`Pack`/`Map`/`☰`). **Exactly two combat buttons exist on screen today.** | Adding recall + spell means **at least two new on-screen buttons**, which is a layout problem, not just a wiring one — see §6. |
| `src/ui/dungeon-ui.ts:388-409` (`help()`) | Two parallel `[string,string][]` tables — one for touch (`touchRows`), one for keyboard (`rows`) — rendered in the pause/help overlay | **Both arrays must gain a row.** Easy to update one and forget the other since they're separate literals with no shared source of truth. |
| `src/ui/dungeon-ui.ts:419-423` | Free-text paragraph explaining parry/guard mechanics in the same help overlay | Not strictly a key list, but likely where a one-paragraph explanation of the recall/spell mechanic would also want to live, for consistency with how parry is explained. |
| `src/ui/hud.ts:71` | `` h('div', { class: 'hint-keys' }, text: 'W/S step · A/D turn · Q/E strafe · Space/LMB attack · Shift/RMB block & parry · F interact · I pack · M map · 1–4 use · Esc menu' ) `` — one hard-coded string, always visible during play (hidden on touch via `body.touch .hint-keys { display: none; }`, `src/style.css:489`) | Must append `· R recall` and whatever the spell key is. |
| `README.md:28-41` | Markdown controls table: W/S, A/D, Q/E, Space/click, Shift/RMB, F, 1–4, I/Tab, M, Esc | Needs new rows for R and the spell key, plus the touch-controls paragraph at line 43 if a new on-screen button is added. |
| `docs/MECHANICS.md:82-88` (§3 Controls) | "See the README table. In short: …" then repeats the same key list in prose, plus the one-button-action explainer and the Mining Pick flavour-roll note | The inline "In short" list duplicates README and must be updated in step; a third place the same string effectively lives. |

**Every one of these six control-documentation strings (`main.ts` switch,
`touch.ts` interface + buttons, `dungeon-ui.ts` help touch rows, `dungeon-ui.ts`
help keyboard rows, `hud.ts` hint-keys string, `README.md` table,
`docs/MECHANICS.md` prose) is independently maintained** — there is no single
source of truth for "what does this key do" that the others derive from.
Missing any one of the seven leaves a stale control hint.

---

## 6. HUD real estate and mobile button layout

| path:line | What's drawn | Room for ammo/cooldowns |
|---|---|---|
| `src/ui/hud.ts:52-60,98-111` | `.bars` block, bottom-left: Health bar, Stamina bar, Recall bar (hidden unless `world.anim.recall !== null`) | A cooldown bar could reuse the same `.bar`/`i` pattern (see `style.css:176-182` — each `.bar > i` is just a width-animated div with a gradient background per modifier class), but there are already three vertically stacked bars in a `min(34vw, 340px)` column — a fourth is possible but tightens an already-narrow phone layout (`body.touch #hud .bars` at `style.css:493,561` shrinks this column further on small screens). |
| `src/ui/hud.ts:37,136-159` (`.quick`) | Exactly **4** quick-slots, bottom-right, auto-populated from "first four distinct consumable refs in the backpack" (`quickUse(slot)` in `world.ts:1711-1721` indexes the same way) | **Not a fixed/assignable slot system** — there's no concept of "slot 5" or "spell slot" today; quick-slots are entirely derived from pack contents each frame. An ammo counter is a different kind of readout (a count, not a slot) and would need its own small HUD element, not a fifth quick-slot. A spell system with 1-3 cooldowns doesn't fit the quick-slot model at all (spells presumably aren't consumable pack items) and needs new HUD state (`Hud` class fields) plus a new `update()` block. |
| `src/style.css:343-345` (`.pips`) | `.pips { display:flex; gap:3px } .pips i { width:12px;height:12px;background:#2a2430;border:1px solid #000 } .pips i.on { background: var(--gold) }` — currently used only in `src/ui/town.ts:1288` for renown-talent level dots | **Reusable as-is** for 1-3 cooldown-ready pips (`i.on` = ready), rendered as small squares rather than bars — a good fit for "1 to 3 cooldown pips" without inventing new CSS. |
| `src/ui/hud.ts:71` | `.hint-keys` bottom-center | Not a display surface for live values, just static text (see §5). |
| `src/ui/touch.ts:118-172`, `style.css:421-480` | Two absolutely-positioned circular buttons (`.tbtn.atk` 96px at `right:0;bottom:0`, `.tbtn.blk` 76×64 at `right:106px;bottom:6px`), each position **hand-tuned in pixels**, with a **second, separately hand-tuned set of overrides** for narrow screens (`style.css:542-549`, a `@media` block) | Every new touch button (recall, spell) needs its own absolutely-positioned rule **and** its own narrow-screen override — there is no flex/grid layout doing this automatically. This is the highest-risk spot for someone to add a button that overlaps the existing ones on a small phone, since the two breakpoints (`style.css:542-549` and `561-`) must both be updated to match. |
| `src/ui/touch.ts:167` (`tmenu`) | 3 small buttons: `Pack`, `Map`, `☰` (help) | Lowest-risk place to add a *non-real-time* affordance (e.g. a "spells" sub-panel opened like the pack), but a true action button (recall/cast) needs to be reachable without opening a menu, so it likely belongs with `main`/`block`, not `tmenu`. |
| `src/style.css:623,631` | `.tmenu` repositions itself again at yet another breakpoint (`top: 132px` at the narrowest) | A third layout dimension to keep in sync if the button count in this menu changes. |

---

## 7. Save format

| path:line | Role |
|---|---|
| `src/state/game-state.ts:18` | `export const SAVE_VERSION = 2;` — the format family. Bumping this **discards every existing save** (per the migrations.ts doc comment) and must not move for this feature. |
| `src/state/migrations.ts:24` | `export const SAVE_REVISION = 17;` — current revision. **Any new field on `RunState`, `Item`, or `MetaLevels` needs revision 18** plus a new entry appended to the `MIGRATIONS` array (index 17) that backfills the field with `??=` on existing saves, following the exact pattern of every prior entry (e.g. `16 → 17` at line 151-156). |
| `src/state/migrations.ts:166-178` (`normalizeFloor`) | Ensures every array a `Floor` needs exists (`rooms, doors, secrets, stairs, torches, props, pickups, enemies, keys, traps`) | If thrown-weapon `Pickup`s need no new `Floor`-level array (they're just ordinary `Item`s inside existing `pickups[].items`), **no change needed here**. If ammo instead needs a dedicated array (e.g. tracking "recallable" pickups separately from ordinary loot), this function must grow a new `??= []` line and a migration must backfill it on old floors. |
| `src/state/migrations.ts:185-199` (`migrateSave`) | Runs `MIGRATIONS[rev]` in a loop from the save's stored revision up to `SAVE_REVISION`, wrapped in a `try/catch` per step so one bad migration can't brick a save | New migration entries must follow this — never throw, always defensive (`??=`), matching the file's stated invariant that "a player mid-run is relying on it." |
| `src/state/save-format.ts:20-23,52-55` | `serializeSave` stamps `SAVE_REVISION` via `stampRevision` before writing; `stampRevision` takes `Math.max(written, SAVE_REVISION)` so a save from a newer build is never dated backwards | No change needed unless the serialization shape itself changes (it doesn't for additive fields — JSON just gains keys). |
| `src/state/save-format.ts:71-80` (`parseSave`) | Rejects (`return null`) if `parsed.version !== SAVE_VERSION`; otherwise runs `migrateSave` | Confirms additive fields are safe: `SAVE_VERSION` is untouched, only `SAVE_REVISION` moves. |
| `src/state/persistence.ts` (whole file) | Pure localStorage read/write keyed by slot (`looting-simulator-save-v2[-sN]`), delegates all format logic to `parseSave`/`serializeSave` — **has no schema awareness of its own** | No change needed for new fields; it's a transport. |
| `src/cloud/sync.ts:15` (comment) | States the sync job's contract: "World holds direct references to GameState and RunState" | Worth re-reading in full before wiring a live-during-run field (e.g. in-flight recall state) through cloud sync — a field that only makes sense transiently during a run (not worth persisting) should probably **not** be added to `RunState` at all, to avoid needing a migration for something that's really just `World` runtime state (compare: `projectiles` already sets this precedent, §3). |
| `src/cloud/cloud-save.ts`, `src/cloud/device.ts` | Not inspected in depth this pass; `device.ts` only touches `localStorage` for a device id, unrelated to `GameState` shape. `cloud-save.ts` should be checked for whether it re-implements any save-shape logic instead of delegating to `save-format.ts` — the module doc on `save-format.ts:6-14` claims cloud sync is "a transport bolted onto these, never a second set of rules," so it should require no changes for additive fields; verify this claim by reading `cloud-save.ts` before assuming it. |
| `src/__tests__/fixtures/save-legacy.json` | A **version 2, revision-less** (pre-revision-system) save, captured 2026-09-12: gear in `weapon`/`offhand`/`body` (short_sword/buckler/jerkin, all Common), a stash with materials + one Rare long sword, `knownRecipes` (old pre-recipe-rank field, since replaced by `recipeRanks` in migration 8→9), a full `market.commodities` table, **no `run` object at all** (in town). | This fixture's entire purpose (`persistence.test.ts:15`, `save-format.test.ts`) is to prove *all 17 migrations* run cleanly from revision 0 and land at `SAVE_REVISION`. **Adding fields to `RunState`/`Item`/`MetaLevels` does not require editing this fixture** (it has no `run`, and new `Item` fields are optional the same way `dur`/`uniqueId` are) as long as the new revision-N migration correctly backfills with `??=` the way every other one does. The fixture *would* need attention only if a migration is written that assumes a field exists that this fixture predates in some other way (unlikely, since this is exactly the oldest-shape case migrations are designed for). |
| `src/__tests__/persistence.test.ts:82,92` | Hardcodes `recent.revision = 9` / `= 10` to test partial-migration behaviour | Unaffected by adding revision 18 — these numbers test the *mechanism*, not a specific endpoint. |
| `src/__tests__/save-format.test.ts` | Tests revision stamping and future-save handling against `SAVE_REVISION` symbolically (`SAVE_REVISION + 5`, etc.) | Unaffected — these tests are revision-number-agnostic by design. |

**Bottom line**: adding fields to `RunState`/`Item`/`MetaLevels` for this
feature is safe and cheap **provided**: (1) `SAVE_REVISION` is bumped to 18
with one new migration function that backfills every new field with `??=`
defaults matching "this player hasn't done the new thing yet," and (2)
anything that is really just live `World` combat state (like `projectiles`
today) is kept off `RunState` entirely rather than persisted and migrated.

---

## 8. Art pipeline

| path:line | Role |
|---|---|
| `src/art/raster.ts:15-21` (`ArtDef`) | `{ id, palette: Record<char,color>, rows: string[], base? }` — hand-authored character-grid pixel art, `'.'` transparent, `'1'-'4'` a swappable material ramp. |
| `src/art/registry.ts:12` | `ALL_ART = [...TEXTURES, ...PROPS, ...ICONS, ...UI_ART, ...ENEMY_ART_A/B/VARIETY/ELEMENTAL, ...VIEWMODELS]` — a flat concatenation of every category array. **Measured today: 192 entries.** Adding an `ArtDef` to any existing category array (e.g. `icons.ts`, `viewmodels.ts`) needs **no change to `registry.ts`** — only a brand-new category file would. |
| `public/art/manifest.json` | **194 lines / 192 array entries — exactly 1:1 with `ALL_ART`.** Confirmed by running `registry.ts` standalone: `ALL_ART.length === 192`. |
| `src/render/art-cache.ts:21-58` (`loadArtOverrides`) | Called with a top-level `await` at **module init time** in `src/main.ts:51` (`const overrideCount = await loadArtOverrides();`) — i.e. **before the game can start at all**. It fetches `public/art/manifest.json`, builds `expected = new Set(ALL_ART ids)`, and **throws** if `missing.length \|\| unknown.length \|\| duplicates.length` where `missing` = any `ALL_ART` id absent from the manifest. It then `fetch`es a PNG per listed id and rejects the whole `Promise.all` if any single PNG 404s. | **This is the sharpest landmine in the whole feature.** Adding a new `ArtDef` (a new weapon-class viewmodel, a thrown-weapon icon, a spell icon, a projectile sprite) without *also* adding its id to `public/art/manifest.json` **and** dropping a real PNG at `public/art/<id>.png` means **the entire game fails to boot** in the browser (fatal `throw`/rejected promise before any UI renders) — not a missing sprite, a black screen. |
| `scripts/export-art.mjs:52-83` | `npm run art:export` — rasterizes every `ALL_ART` entry via the *code* renderer (not the PNG overrides) into `art-handoff/<folder>/<id>.png` plus `art-handoff/manifest.json` (id, file, width, height, base, `recolorable`). Throws on duplicate ids. This is the **handoff** pipeline (for an artist to repaint), separate from `public/art/manifest.json` (the **in-game override** pipeline). |
| `art-handoff/README.md` | States the workflow explicitly: edit/replace the exported PNG, then "copy it to `public/art/<id>.png`... then add `"<id>"` to `public/art/manifest.json`." Confirms the two manifests are separate and both must be touched to actually change what ships. |
| `scripts/art-sheet.mjs`, `src/dev/art-sheet.ts` | `npm run art:sheet` / in-game F2 (dev builds only, `src/main.ts:670-674`) both read `src/dev/art-sheets.ts` and render the **code-rasterized** art (not PNG overrides) as contact sheets. |
| `src/dev/art-sheets.ts:206-241` (`sheets()`) | Fixed list of sheet ids: `melee, ranged, guard, boss, biomes, props, icons, viewmodels`. `icons` (`iconGroups`, line 180-204) and `viewmodels` (`viewmodelCells`, line 170-178) are **auto-generated** from `ITEM_BASES`/`MATERIALS`/`CONSUMABLES`/`VIEWMODELS` — a new weapon base or new consumable icon needs **no manual edit here**, it appears automatically. A genuinely new `weaponClass` needs `viewmodelFor()` (`data/items.ts:203-211`) to map it to a `vm_*` id that has both a `VIEWMODELS` entry and an `ITEM_BASES` weapon resolving to it, or `viewmodelCells` labels it "Bare hands" (its fallback for an unmatched vm id). |
| `src/__tests__/art.test.ts:11-17` | Every `ArtDef` in `ALL_ART` must `validateArt` clean and rasterize to a non-empty canvas. |
| `src/__tests__/art.test.ts:19-22` | All `ALL_ART` ids must be unique. |
| `src/__tests__/art.test.ts:24-44` (`needed` set) | Cross-checks that **every** icon/viewmodel/wall/enemy-sprite/projectile-sprite referenced anywhere in the data tables (`MATERIALS`, `ITEM_BASES`, `CONSUMABLES`, `BIOMES`, `ENEMIES`, `KING_PHASES`) actually exists in `ALL_ART` via `getArt(id)`. A new item base, consumable, or enemy projectile with a typo'd or forgotten icon id fails this test immediately — **this is the fast, cheap check that should catch most art-wiring mistakes before `loadArtOverrides`'s much more expensive fatal-boot failure would.** |

**Exact steps to add a new sprite (e.g. a two-handed viewmodel, a thrown-weapon
projectile sprite, a spell icon) so it appears in-game, in the handoff folder,
and in the dev art sheet:**
1. Add the `ArtDef` (palette + rows) to the right `src/art/*.ts` array (or a new
   file + array, wired into `registry.ts` if it's a whole new category).
2. If it's a new `weaponClass`, add a `case` in `viewmodelFor()`
   (`src/data/items.ts:203-211`) mapping to the new `vm_*` id.
3. Run `npm run art:export` to regenerate `art-handoff/<folder>/<id>.png` and
   `art-handoff/manifest.json` (or hand-author the PNG directly).
4. Copy the finished PNG to `public/art/<id>.png`.
5. Add `"<id>"` to `public/art/manifest.json` (order doesn't matter — it's
   checked as a set — but it must be exactly the new id, no more, no less).
6. Run `npm test` — `art.test.ts`'s "everything the data references exists"
   check should now pass for the new id; run the app (`npm run dev`) to
   confirm `loadArtOverrides` doesn't throw.
7. Optionally `npm run art:sheet -- viewmodels` (or `icons`) to eyeball the new
   art in context — no manual wiring needed for the icon/viewmodel sheets
   specifically, per the auto-generation noted above.

---

## 9. Tests that will fail, and why

| Test file | Why it breaks | Right fix |
|---|---|---|
| `src/__tests__/hard-golden.test.ts` (see full read above) | **Pins four exact numeric fingerprints** against the pre-difficulty-levels commit: (a) a hash of 1,200 `generateFloor` outputs, (b) a hash of 1,800 rolled loot piles via `rollEnemyLoot`/`rollContainerLoot`, (c) an exact HP table per enemy id×depth, (d) an exact list of 60 `derivePlayer(...).maxHp` values from randomly-rolled gear. **(b) and (d) both call `rollEquipment`, which does `rng.weighted(ITEM_BASES.filter(b => b.minDepth <= depth).map(b => [b, b.weight]))`** (`src/systems/items.ts:535-538`) — a single weighted draw over the *entire current `ITEM_BASES` array*. Adding any new weapon base with `minDepth` at or below the depths this test exercises **changes the candidate pool and total weight**, which changes which base the same RNG draw sequence selects at many seeds, which changes the rolled item's stats, which changes both the loot hash and the player-HP list. **This will very likely fail as soon as a new weapon base is added to `ITEM_BASES`, regardless of whether the new weapon is ever equipped by the test.** | The comment at the top of the file explicitly frames this fixture as "frozen... the only check that still means something once this branch is master" — i.e. it is *meant* to never move for cosmetic/balance changes. But a genuinely new item base is a real change to the drop table, not noise, so the honest fix is deliberately regenerating **only** the affected sub-hashes (`lootHash`, `playerHp`) in `hard-golden.json` once the new content is final and reviewed — not silently deleting or loosening the assertions, and not touching `varietyFloorHash`/`enemyHp` unless the new content also touches floor generation or enemy stats (it shouldn't). |
| `src/__tests__/items.test.ts:222-233` ("orders every gear line...") | Iterates `GEAR_LINES`, asserting each successive base in a line has higher `minDepth`, lower `weight`, higher `value`, and a `recipeForBase(...).value` at least as high as its predecessor. | A new two-handed weapon that's a genuine upgrade over an existing line's top entry must either extend that line (with correctly-ordered `minDepth`/`weight`/`value`/recipe value) or start its own singleton line — either way this test enforces internal consistency for free once the data is correct; it fails only if the new base's numbers are out of order. |
| `src/__tests__/items.test.ts:235-243` ("places every item base on exactly one line") | Asserts `GEAR_LINES.flat()` has no duplicates, and that **every `RECIPES` entry's `baseId` appears in some line**, with `gearPredecessor`/`gearTier` agreeing with line position. | **Any new weapon base that gets a `RecipeDef` but is not also added to `GEAR_LINES`** (`src/data/items.ts:158-169`) fails this immediately (`expect(listed).toContain(r.baseId)`). This is the test most likely to catch a forgotten step, which is good — but it means `GEAR_LINES` is a mandatory edit, not optional. |
| `src/__tests__/items.test.ts:245-255` ("lets a fresh smith reach every blueprint by ranking up") | Simulates 4000 blueprint drops from `rollBlueprint` starting from starter recipes only, and asserts every recipe in `RECIPES` eventually reaches `MAX_RECIPE_RANK`. | A new recipe with `starter: false` must be reachable via the existing blueprint-drop weighting (`blueprintDropWeight` = `0.4 ** gearTier(baseId)` in `src/data/recipes.ts:105`) — if it's placed deep in a very long new line, this test's fixed 4000-iteration budget could in principle fail to reach it; unlikely but worth running after adding the recipe rather than assuming. |
| `src/__tests__/art.test.ts` (§8) | Fails if a new weapon's `viewmodelFor()` result, or any new icon/projectile sprite id, has no matching `ArtDef`. | Add the missing `ArtDef` (§8's steps) — never loosen this test, since it's the cheap early-warning for the expensive `loadArtOverrides` boot failure. |
| `src/__tests__/durability.test.ts` | Does not enumerate `ITEM_BASES`; only exercises specific named bases/materials directly (`weapon` from a constructed `World`, generic "worn gear" vs "jewellery" rules). | Should **not** break from adding new weapon bases, since durability rules are generic over `slot`/material, not over specific base ids — verify this holds for whatever "ammo has durability?" decision is made for thrown weapons (if thrown weapons wear down like other equipment, `durability.test.ts`'s generic assertions should cover them without new test code; if they behave specially — e.g. never wear, or break on landing — that's new behavior needing new tests, not a fix to existing ones). |
| `src/__tests__/economy.test.ts` | Crafting/market tests reference specific recipe/material ids directly, not all of `RECIPES`/`ITEM_BASES`. | Should not break from additions unless a new recipe's material categories or pricing interact with a specific assertion (e.g. `'orders forge materials by tier and value'`) — low risk, but re-run after adding new crafting hooks for the cooldown-reduction item property, since that property likely touches `buildCrafted`/affix rolling. |
| `src/__tests__/scaling.test.ts` | Uses `war_axe` in two spots (`:65,83`) as a fixed example weapon for scaling math — unaffected by additions unless `war_axe` itself changes. |
| `src/__tests__/slots.test.ts` | Tests save-slot (title-screen slot 1/2/3) mechanics, **unrelated to equipment slots** despite the name — confirmed by reading the file's `describe`/`it` list; no `ITEM_BASES`/`weaponClass` references at all. Will not be affected by this feature. |
| `src/__tests__/uniques.test.ts` | Currently has **one pre-existing failing test** unrelated to this feature (see Baseline). Uniques are `UniqueDef`s keyed to specific base ids/effects (`src/data/uniques.ts`) — a new weapon base needs no changes here unless a new bespoke legendary is planned for it (out of scope per the design brief). |
| `src/__tests__/biome-variety.test.ts:83`, `elemental-archers.test.ts:16-17` | Assert enemy `damageType`/`projectile.damageType` match their biome's element — unrelated to player weapons/ammo, listed here only because they were caught by the `damageType` grep in §1; no change needed. |

---

## 10. Headless harness (`scripts/`)

| Command (`package.json`) | Script | What it measures / outputs |
|---|---|---|
| `npm run playtest` | `vitest run --config vitest.playtest.config.ts scripts/balance.bench.ts` | Runs `RUNS` (env `PLAYTEST_RUNS`, default 24) seeded bot playthroughs across 4 profiles (fresh/no-parry, mid-gear, endgame ×2 policies) and writes a text report to `PLAYTEST_OUT` (default `playtest-report.txt`) via `writeFileSync` — vitest's default reporter swallows console output, hence the file. |
| `npm run tables` | `vitest run --config vitest.playtest.config.ts scripts/tables.bench.ts` | Fast (`allTables()` only, seconds not minutes) — writes `TABLES_OUT` (default `balance-tables.txt`); "the one to use between individual knobs" per its own comment and `docs/MECHANICS.md`. |
| `npm run upgrades` | `vitest run --config vitest.playtest.config.ts scripts/upgrades.bench.ts` | Re-runs the same seeded playtest with each `META_UPGRADES` entry maxed and alone (excluding town-side ones it flags `UNMEASURED`), reporting the delta vs. no upgrades — **relevant to the new renown talent**: it will automatically pick it up from `META_UPGRADES` and attempt to measure it, but will report it `UNMEASURED` if its effect (kill-triggered cooldown reduction) is invisible to the bot the same way `lantern`/town-side upgrades are (the bot doesn't cast spells today, so a cooldown-reduction talent is a de facto new `BLIND_SPOT` entry, `scripts/upgrades.bench.ts:29`, until the harness is taught to use spells at all). |
| `npm run find` | `vitest run --config vitest.playtest.config.ts scripts/find.bench.ts` | Not read in depth this pass; per its own comment, isolates loot-find's effect against value swings of hundreds of gold on a single Epic drop — likely unaffected unless the new weapon bases change item values materially. |
| — | `scripts/tables.ts` | Backing library for `allTables()` — per-base combat tables (`d.swing.windup/recovery`, `swingsPerBar = maxStamina / staminaCost`, `matchups:` ttk/ttd) driven directly by `derivePlayer` output. **A weapon whose `derived.swing` isn't a conventional melee profile (a pure-ranged/thrown weapon) will need `tables.ts` taught how to render or skip it**, since the current code unconditionally reads `d.swing.windup`/`.recovery`/`.staminaCost` (`scripts/tables.ts:181,206-209`) and would throw or produce nonsense on `undefined`. |
| — | `scripts/playtest.ts` | Backing library for the bot itself (`Policy`, `playtest()`, `LADDER` gear-by-depth table, `geared()` helper). The bot's attack decisions (`scripts/playtest.ts:310,324,498,531`) check `p.stamina >= d.swing.staminaCost` before calling `w.attack()` — **a new weapon class that isn't melee-swing-shaped needs new bot logic** (when to throw, when to recall, when to cast) or the bot will simply never use it, silently understating its value in every report. |
| — | `scripts/mechanics.bench.ts` | Generates the enemy stat/drop tables pasted into `docs/MECHANICS.md` §5 — run via `npx vitest run --config vitest.playtest.config.ts scripts/mechanics.bench.ts` per the doc's own instructions. Enemy-side only; relevant to this feature only if new enemy behavior (e.g. an enemy that also throws recoverable weapons) is added alongside. |

**What a new weapon class needs to be measured by this harness at all:**
1. `derivePlayer` must expose whatever numbers the new weapon type uses
   (§1) so `scripts/tables.ts` can render a row for it without crashing.
2. `scripts/playtest.ts`'s bot decision logic needs a branch for the new
   weapon type (when to use a thrown weapon / when to recall / when to cast a
   spell), or the harness will simply never exercise it.
3. If it's gated behind the new renown talent, `scripts/upgrades.bench.ts`
   needs either bot support for casting spells (to measure a real delta) or an
   explicit addition to its `BLIND_SPOT`/`TOWN_SIDE` sets so it reports
   `UNMEASURED` honestly instead of a misleading zero (the file's own header
   comment explains why this distinction matters).

---

## 11. Docs that must be updated

| Doc | Sections | What's there |
|---|---|---|
| `docs/MECHANICS.md` | §3 Controls (line 82-88) | Prose key list ("In short: ...") duplicating README — needs R + spell key. |
| | §9 Item bases (line 572-603) | The full weapon-base stat table; needs new rows for two-handed bases and thrown/ranged weapons, and the `GEAR_LINES` prose ("dagger → short sword → long sword, club → mace → mining pick → war axe...") needs the new lines described. |
| | §9 "Weapon handling" (line 603-627) | Describes the existing three-class feel (Blades/Haft/Reach) and the blunt/slash/pierce triangle — a new weapon class or a fourth damage-type interaction needs a new paragraph here, and the "Neither axis alone picks a weapon" DPS-ranking paragraph would need new numbers if new weapons enter the same comparison. |
| | §13 Renown and upgrades (line 764-798) | The `META_UPGRADES` table is **hand-transcribed** from `src/systems/meta.ts` (not generated) — the new cooldown-on-kill talent needs a new row here, and the "whole tree costs 333 renown" total needs recomputing once its costs are decided. |
| | §17 Where to change things (line 841-880) | A file-pointer table ("Want to change X → file Y"); should gain rows for the new systems (spell cooldowns, thrown-ammo pickups) once their home files exist, so it stays the stated "single reference for balance discussions." |
| | (general) | Explicitly generated content: the monster tables in §5 come from `scripts/mechanics.bench.ts` (line ~890) — do not hand-edit those; regenerate via the documented command instead. |
| `README.md` | Controls table (line 28-41) | New rows for R and the spell key; the touch-controls paragraph (line 43) if new on-screen buttons are added. |
| `src/data/patches.ts` / `scripts/check-patches.mjs` | Format, validated by `npm run patches` | Hand-curated array, newest entry first, strictly numbered `n: N..1` (verified: current top entry is **`n: 39`**, so the next entry is **`n: 40`**). Each entry: `{ n, hash (40-hex, full commit), short (7-hex prefix of hash), date, title, summary, tags: [...], also?: [...7-hex hashes...], details?: [...] }`. `check-patches.mjs` enforces: sequence is exactly `N..1` newest-first; every cited hash/short exists in git history; `hash` must start with `short`; no commit is cited by two entries; and (in a git checkout) every commit in the repo must be either cited, listed in the script's own `SKIP` map (with a reason), or touch only `NOTES_ONLY` files (`scripts/check-patches.mjs`, `src/data/patches.ts`) — otherwise it's a warning ("uncurated"), not a hard failure. **A weapon-overhaul commit that isn't curated into a patch entry or skipped will show up as a warning next time `npm run patches` runs**, though the script only hard-fails (`exit 1`) on the structural checks, not on missing curation. |
| `art-handoff/README.md` | Workflow doc, static | Already accurately describes the manifest-and-PNG handoff loop (§8) — no change needed unless the workflow itself changes; new sprites just flow through the existing instructions. |

---

## Landmines

1. **`loadArtOverrides` is a fatal, whole-game boot failure, not a missing-sprite warning** (`src/render/art-cache.ts:21-58`, called at top-level `await` in `src/main.ts:51`). Adding any new `ArtDef` (new weapon viewmodel, thrown-weapon sprite, spell icon, ammo icon) without also adding its id to `public/art/manifest.json` *and* dropping a real PNG at `public/art/<id>.png` takes down the entire app, not just the new feature. `art.test.ts`'s "everything the data references exists" check catches most of this cheaply *before* someone hits the fatal path in a browser — but it only checks ids referenced by data tables it knows to walk (`MATERIALS`, `ITEM_BASES`, `CONSUMABLES`, `BIOMES`, `ENEMIES`, `KING_PHASES`); a standalone icon (e.g. a HUD ammo icon or spell icon not attached to any `ItemBaseDef`/`ConsumableDef`) is invisible to that test and would only be caught by `loadArtOverrides` itself, at runtime.

2. **`hard-golden.test.ts` will very likely break from the mere existence of a new weapon base**, independent of whether it's ever equipped, because `rollEquipment`'s single weighted draw over all of `ITEM_BASES` (`src/systems/items.ts:535-538`) shifts what every other seed rolls too. Someone moving fast will see this failure, assume they broke loot generation, and either revert unrelated code or (worse) loosen the assertion instead of understanding it's an expected, one-time fixture regeneration for `lootHash`/`playerHp` specifically.

3. **Two-handed/offhand exclusion has zero existing enforcement, and there are two separate paths that construct an `Equipment` record**: real play always goes through `equipFrom`/`unequipTo` (`src/systems/equip.ts`), but `scripts/playtest.ts` and `src/dev/boss-arena.ts` build `Equipment` objects by direct field assignment. A fix placed only in `equip.ts` leaves the playtest harness (and any hand-crafted or corrupted save) able to hold an illegal weapon+shield combination that `derivePlayer` will happily compute stats for (`hasShield = !!eq.offhand`, `src/systems/player.ts:136`) — this can silently skew every balance number the harness reports without ever surfacing as a bug in normal play.

4. **A "recalled" thrown weapon and the existing Scroll of Recall (`ConsumableEffect: {type:'recall', seconds}`, `src/types.ts:180`, `this.anim.recall` in `world.ts`) are unrelated mechanics sharing an overloaded English word.** Naming new state/fields/messages around "recall" for the ammo-retrieval key risks colliding with or being confused for the existing town-portal recall countdown, its UI (`.bar.recall`, `src/ui/hud.ts:32-33,59,110-111`), and its player-facing log lines ("The recall is broken by the blow.", "The recall fizzles."). This is purely a naming/clarity risk, not a technical collision, but it's an easy one to walk into given the R-key feature is *also* conceptually "get something back."

5. **No projectile survives even one tick past `speed = 0`** (`this.projectiles = this.projectiles.filter((pr) => pr.speed > 0)`, `src/world/world.ts:2235`, run every frame right after the collision loop that sets `speed = 0`). Someone implementing "a thrown weapon lands and becomes lootable" by looking only at the `Projectile` type and its render/update code (§3) will reasonably conclude a landed projectile just needs to stop moving and be drawn as resting — but nothing in the current code path preserves a projectile past the frame it stops in, and nothing about `Projectile` is ever saved. The conversion to a `Pickup` (§4) has to happen synchronously at the exact moment `speed` would be set to 0, not as a follow-up step against a "resting projectile" object, because that object is deleted before the next frame.

---

## Order of operations

Sequenced so `npm test` and `npm run build` stay green (module the one
pre-existing `uniques.test.ts` failure) at every step:

1. **Data-only groundwork, no behavior change.** Extend `WeaponClass`
   (`types.ts`), add new `ItemBaseDef` rows to `data/items.ts`, add them to
   `GEAR_LINES`, add matching `RecipeDef`s to `data/recipes.ts`, extend
   `viewmodelFor()`. Run `items.test.ts` immediately — it's the cheapest,
   fastest feedback on data-table mistakes (gear-line ordering, orphaned
   recipes). Expect `hard-golden.test.ts` to fail here; that's the known,
   accepted breakage (§9/Landmine 2) — regenerate `hard-golden.json`'s
   `lootHash`/`playerHp` fields once these tables are final, and only those
   two fields.

2. **Art**, before anything renders the new weapons. Add `ArtDef`s, extend
   `public/art/manifest.json` and `public/art/`, run `art.test.ts`, run
   `npm run dev` once purely to confirm `loadArtOverrides` doesn't throw
   (Landmine 1). This unblocks every subsequent visual step.

3. **Two-handed/offhand exclusion** in `src/systems/equip.ts` (`equipFrom`
   auto-unequips or refuses the offhand; `unequipTo` unaffected), *and* a
   defensive normalize in `derivePlayer` for any `Equipment` record that
   somehow still has both (covers the playtest harness / boss-arena's direct
   assignment, Landmine 3). Add/update `slots.test.ts` or a new focused test
   for this — note the existing `slots.test.ts` is about save slots, not
   equip slots, so this probably wants its own test file or an addition to
   `items.test.ts`. Update the paper-doll UI (`dungeon-ui.ts`) to visually
   disable the offhand slot when a two-handed weapon is worn.

4. **Save schema**: bump `SAVE_REVISION` to 18, add the migration, add
   whatever new optional fields `RunState`/`Item`/`MetaLevels` need (thrown
   ammo tracking if not modeled purely as ordinary `Pickup` items; the new
   renown talent id needs no schema change at all, since `MetaLevels` is a
   plain `Record<string, number>` and `metaLevel()` already defaults missing
   keys to 0). Run `persistence.test.ts`/`save-format.test.ts`.

5. **Projectile-to-Pickup conversion** (§3/§4): hook the wall-hit and
   enemy-hit branches in `updateProjectiles` to call `dropLoot` with the
   thrown item instead of letting the projectile silently vanish. This is
   the mechanical core of "thrown weapons land and can be picked up" and can
   be built and tested (new tests around `World`, similar to
   `context-action.test.ts`/`dungeon.test.ts`) independently of input/HUD
   work.

6. **Player throw action**: a new `World` method (parallel to `attack()`)
   that consumes ammo from the pack/equipped slot and pushes a `Projectile`
   with `source`/ownership marked so it can damage enemies (reusing or
   forking `reflectedHit`'s enemy-damage logic, since that's currently the
   *only* code path where a projectile hurts a monster).

7. **Input wiring**: bind the throw action (if not folded into existing
   attack) and the **R** recall key in `main.ts`, add `TouchHandlers` methods
   and new buttons in `touch.ts` with matching `style.css` rules at both
   breakpoints, update the six documentation strings from §5 in the same
   commit (`dungeon-ui.ts` help ×2 arrays, `hud.ts` hint-keys, `README.md`,
   `docs/MECHANICS.md`).

8. **HUD**: ammo counter and cooldown pips in `hud.ts` (reuse `.pips` CSS for
   cooldowns, §6), wired to the new `World`/`PlayerDerived` state added in
   steps 5-6 and whatever the spell system adds.

9. **Spell system + renown talent + item property + crafting hook**: add the
   talent to `META_UPGRADES` (`systems/meta.ts`, no migration needed), decide
   and implement where the "cooldown reduced on kill" item property lives
   (a new optional `Item` field following the `dur`/`uniqueId` sparse-field
   precedent, or a new affix `StatKey`/`AffixDef` — both are additive, but an
   affix touches `STAT_KEYS`/`STAT_LABELS` in `types.ts` and the manual stat
   list in `dungeon-ui.ts`'s `statSheet`, so pick deliberately), and the
   crafting hook in `systems/crafting.ts`/`data/recipes.ts`. Run
   `economy.test.ts` and `durability.test.ts` after.

10. **Headless harness support** (§10): teach `scripts/playtest.ts`'s bot to
    use the new weapon type/spells (even minimally — e.g. "throw when an
    enemy is 2+ tiles away and ammo is available"), and either extend
    `scripts/tables.ts` to render the new weapon's stats or special-case it
    out. Run `npm run tables` (fast) before `npm run playtest` (slow) as the
    doc's own convention recommends.

11. **Docs and patch notes last**, once numbers are final: update
    `docs/MECHANICS.md` §9/§13/§17, `README.md`, and add patch entry `n: 40`
    to `src/data/patches.ts` citing the feature's commits, then run
    `npm run patches` to confirm the structural checks and see what, if
    anything, still needs curating.

Run the full baseline (`npm test`, `npm run build`) after every step above;
the only expected pre-existing failure throughout is the one named in
Baseline, and the only *expected new* failure at any point is
`hard-golden.test.ts` immediately after step 1, resolved by the deliberate
fixture regeneration described there.
