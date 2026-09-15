# Elemental biome pass — Emberworks, Frost Vault, and thematic residents

*Design spec. Phases 1–4 implemented. Companion to [MECHANICS.md](../MECHANICS.md) and
[NEXT.md](../NEXT.md). Touches `src/art/textures.ts`, `src/data/biomes.ts`,
`src/render/ps1.ts`, `src/render/level-mesh.ts`, `src/render/dungeon-renderer.ts`,
`src/systems/dungeon.ts`, `src/data/enemies.ts`.*

Four pieces of work, in the order they should land:

1. **The Emberworks should look molten**, not like brick wearing a lightning decal.
2. **The Frost Vault gets the same treatment in ice**, plus a rock-and-ice floor
   and icicles hanging off the roof.
3. **The Burrows get moles**, because the Burrows are currently the crypt in brown.
4. **Elemental reskins of base enemies** on the elemental floors — new skin, new
   resistances, *identical* base stats and scaling.

---

## 0. Standing constraints

Inherited from [NEXT.md](../NEXT.md); every proposal below is written to obey them.

- **Never invalidate a save.** Nothing here adds a required save field. Floor
  layouts live in `run.floors`, so an in-progress delve keeps the floor it has.
  `SAVE_VERSION` does not move.
- **Reproducible from the seed, and new rolls do not reshuffle old ones.**
  Anything new that rolls during generation gets its own hashed stream —
  `createRng(hashString("icicles:" + seed + ":" + depth))`, the pattern
  `extra-urn` already uses at `src/systems/dungeon.ts:772`. Drawing from the
  floor's shared `rng` would shift every enemy, pickup, key and trap roll after
  it for every future floor on every existing seed.
- **Same stats means same stats.** The enemy reskins in §4 change skin,
  resistances and damage type. `hp`, `attack`, `defense`, `step`, `windup`,
  `recovery`, `sight`, `scale`, `minDepth`, `maxDepth`, `gold`, `itemChance`
  stay byte-identical to the base, enforced by a test, so the balance tables in
  MECHANICS §9 stay true without being re-derived.
- **The art sheet is the review surface.** `npm run art:sheet` writes
  `docs/previews`. Every phase below ends with a regenerated sheet, and the
  acceptance criteria are written as things you can see on it.

---

## 1. Why the Emberworks wall reads wrong

Three separate causes, all visible in a single sheet strip.

### 1.1 One tile, repeated, at a fixed offset

`level-mesh.ts` gives every 2m wall face UV `0..1` of a single 32×32 texture, and
picks between exactly two of them:

```ts
const tex = hash3(nx, ny, d) < 12 ? biome.wallAlt : biome.wall;   // level-mesh.ts
```

So **88% of wall faces in the Emberworks are byte-identical**, and the lava is
stamped at two fixed coordinates inside that tile:

```ts
const EMBER_WALL_ROWS = stamp(BRICK_ROWS, EMBER_SEAM, 8, 9);       // textures.ts
```

Every face carries the same two marks in the same two places. Walk down a
corridor and you see the same decal march past you at 2m intervals. That is the
"repeating strike pattern" — it is not the drawing, it is the repetition rate.

### 1.2 The seam is drawn as a bolt, not as lava

`EMBER_SEAM` is an 11-row zigzag, 1–2px wide, one flat emissive orange
(`#ef6626fa`) inside a hard dark outline (`r: '#190e0c'`). Two things make that
read as a lightning strike rather than as molten rock:

- **No ramp.** One bright value against one dark value is a *drawn line*. Heat
  seen through a crack is a gradient — white-hot core, orange body, dull red
  rim, then scorch bleeding into the stone.
- **It cuts diagonally across intact bricks.** Real heat comes through the
  structure: along mortar joints, out of broken brick faces, pooling at the
  bottom course. A diagonal that ignores the masonry reads as something drawn
  *on* the wall.
- **It runs off the tile edge.** An element that touches the edge of a repeating
  tile advertises the repeat. Marks that die inside the tile do not.

### 1.3 The plaque

`FURNACE_VENT` is a 14×8 rounded rectangle with a uniform outline and a smaller
inner rectangle — a perfect two-tone rect with a highlight band, which is why it
reads as a cigarette pack. It is also the *only* difference between `wall` and
`wall_alt`, so the 12% variant band is "the wall, plus a label", appearing about
once every eight faces. That cadence is exactly regular enough to notice.

---

## 2. The Emberworks rework

Three layers. Each is independently useful; together they do the job.

### 2.1 Layer A — a variant set instead of wall + alt

Add an optional field to `BiomeDef`:

```ts
/** Wall textures cycled by position hash. Falls back to [wall, wallAlt]. */
wallVariants?: string[];
```

and in `level-mesh.ts`:

```ts
const set = biome.wallVariants;
const tex = set ? set[hash3(nx, ny, d) % set.length]
                : (hash3(nx, ny, d) < 12 ? biome.wallAlt : biome.wall);
```

Purely additive, no save impact (textures are never persisted), and every biome
without the field behaves exactly as today. `hash3` is a pure position hash, not
an RNG draw, so extending it costs nothing in seed stability.

**Four Emberworks wall textures across five hash slots**, and the important part
is that they differ in *where the heat is*, not in carrying a different sticker:

| id | Content | Share |
|---|---|---|
| `wall_emberworks` | Soot-black brick, **no glow at all**, faint heat-scorch bloom | 2/5 |
| `wall_emberworks_seam` | One vertical mortar joint split open, tapering, dead-ending mid-tile | 1/5 |
| `wall_emberworks_pool` | Bottom course glowing, molten spilling toward the floor line | 1/5 |
| `wall_emberworks_grate` | Iron grille, bars **silhouetted against** the light behind them | 1/5 |

The share column is achieved by listing the unlit id twice in the array —
`wallVariants` is indexed by `hash3 % length`, so repetition *is* the weighting,
and no separate weight table is needed.

Two of five faces carrying **no glow whatsoever** is what makes the glowing ones
read as events rather than as wallpaper. A room where every wall is hot has no
hot walls in it.

Cost: four merged geometries and four materials for walls instead of two. The
level already builds ~10 builders; this is not a budget concern.

### 2.2 Layer B — draw lava as lava

Craft rules for the redraw, all of which are what `EMBER_SEAM` is missing:

- **Follow the masonry.** Cracks run *along* mortar joints and *out of* broken
  brick faces. Never a free diagonal across an intact brick.
- **Four-value ramp**, not one colour:

  | Role | Value | Emissive | Width |
  |---|---|---|---|
  | core | `#fff0c0` | `fa` | 1px, only at the widest point |
  | body | `#ff8a20` | `fa` | 1–3px |
  | rim | `#b03a10` | `98` | 1px |
  | scorch | `#3a1a10` | opaque, alpha-blended over brick | 2–3px halo |

  The existing `rasterize` already alpha-blends anything under `0xff` over the
  base layer (`raster.ts:98`), so the scorch halo and the rim cost nothing new.
- **Taper and dead-end.** 3px at the middle, 1px at the ends, terminating inside
  the tile. Nothing touches the tile border.
- **Pool low, soot high.** Molten rock runs down. A wall whose bottom course
  glows and whose top course is dead black is legible as a lava level from
  across a room, and it is the single cheapest silhouette win available.

**Retire `FURNACE_VENT`.** Replace it with the grate: vertical iron bars drawn
*over* a glowing field, so the light is occluded by the bars. Bars in front of
light is unambiguous, it is the only non-brick object on the wall, and it tells
the biome's story — this is a *works*, a foundry, not a cave that happens to be
warm.

### 2.3 Layer C — make it pulse

The renderer already has everything except a clock. `ps1.ts` computes a binary
emissive flag per fragment:

```glsl
float emissive = (tex.a > 0.96 && tex.a < 0.99) ? 1.0 : 0.0;
vec3 col = tex.rgb * mix(min(light, vec3(1.3)), vec3(1.0), emissive);
```

Add two uniforms — `uTime` (shared, advanced once per frame in
`DungeonRenderer.render`, which already keeps `this.time`) and `uPulse`
(per-material `vec2(amplitude, speed)`, default `vec2(0.0)`):

```glsl
float phase = uTime * uPulse.y + dot(vWorld.xz, vec2(0.7, 1.3));
float glow  = 1.0 + uPulse.x * (sin(phase) * 0.5 + 0.5);
vec3 col = tex.rgb * mix(min(light, vec3(1.3)), vec3(glow), emissive);
```

Three things to notice about this:

- **Only emissive texels move.** The brick does not strobe. That is why the
  amplitude can be generous without the wall flickering like a broken bulb.
- **`vWorld.xz` in the phase makes adjacent faces breathe out of sync.** This is
  the biggest anti-repetition win in the whole document: two byte-identical
  tiles stop looking identical because they are at different points in the
  cycle. It also means Layer C partly rescues Layer A even before the variants
  are drawn.
- **Default `vec2(0.0)` is a no-op**, so every other material in the game —
  enemies, props, viewmodels, every other biome — renders exactly as today.

Wire it through `ps1Material(shared, map, { pulse: [amp, speed] })` and set it on
the ember and frost wall/floor/ceiling materials only.

| Surface | amplitude | speed (rad/s) | reads as |
|---|---|---|---|
| Emberworks wall / floor / ceiling | 0.35 | 3.8 (~0.6 Hz) | breathing heat |
| Frost Vault wall / floor | 0.15 | 1.1 (~0.18 Hz) | light shifting in ice |

**Second pulse channel: the ambient.** `dungeon-renderer.ts` already writes
`uAmbient` per frame and already has `flick(seed)` for torches. Lerp the
Emberworks ambient ±8% at 0.4 Hz, out of phase with the wall pulse. One uniform
write per frame, and it makes the whole room feel like it is standing next to
something molten rather than looking at a hot picture. The Frost Vault gets the
same at ±4%, slower — or not at all, if it reads as instability.

### 2.4 Acceptance

On `npm run art:sheet`, the Emberworks strip shows four visibly different walls,
one of them with no glow at all. In game, walking a corridor no longer shows
the same mark at a fixed interval, and standing still in a lit room the glow
visibly breathes.

---

## 3. The Frost Vault

### 3.1 The walls — same three layers, inverted

Today the frost wall is the crypt wall with a blue wash at `0x98` alpha plus two
stamps (`textures.ts:89`). It is the thinnest art in the biome set, and it has
the identical repetition problem.

Same **variant array**, five entries:

| id | Content |
|---|---|
| `wall_frostvault` | Bare rimed brick, frost in the joints, no ice mass |
| `wall_frostvault_glaze` | A clear ice sheet over two courses — brick still legible **through** it |
| `wall_frostvault_fall` | A frozen cascade down from the top course, widest at the top |
| `wall_frostvault_split` | Wall cracked open, blue-white core in the gap |
| `wall_frostvault_grate` | An ice-choked grille, answering the ember grate |

The glaze variant is the one that sells the biome, and the existing alpha blend
gives it away for free: a pale blue at `0x60`–`0x80` over the base rows lets the
masonry read through the ice, which is the whole visual idea of a glaze.

**Ice is specular, not emissive.** This is the one rule that separates ice from
blue lava. The frost palette should spend its budget on a 1px near-white
highlight along the **top-left edge of every ice mass** and a darker, more
saturated blue in the mass body. Only deep-core cracks get `fa`, and only at the
low amplitude in the table above. Make ice glow the way lava glows and you have
built a second lava level in a different hue.

### 3.2 The floor — rock and ice, not blue flagstones

Today: `FROST_FLOOR_ROWS = stamp(stamp(FLAG_ROWS, ICE_FISSURE, …))` — the crypt's
clean flagstone grid, recoloured, with two hairline fissures. A regular stone
grid is the opposite of a frozen cave floor, and the floor tiles repeat far more
visibly than the walls because the player is looking down at them constantly.

Rebuild the substrate from broken rock (the `DIRT_ROWS` / `RUBBLE_ROWS` cadence,
not `FLAG_ROWS`), then glaze it. Three bands authored into one 32×32 tile:

1. **Broken rock base** — dark blue-grey, irregular chunk edges, no grid. This
   alone kills the flagstone read.
2. **Ice sheet patches** — pale blue at `0x60`–`0x80` over the rock in irregular
   blobs, so the rock shows through, each with a 1px bright rim where the sheet
   has an edge.
3. **Rime and cracks** — frost speckle along the ice/rock boundary, plus a few
   open cracks with a faint blue core.

Author **two** floor ids and alternate them by position hash the same way the
walls do — `floor_frostvault` (mostly rock) and `floor_frostvault_ice` (mostly
glazed). This needs the same `floorVariants?: string[]` treatment in
`level-mesh.ts` as §2.1; it is the same three-line change.

### 3.3 The ceiling — icicles

The Frost Vault currently borrows `ceil_crypt`. It needs its own roof and it
needs things hanging off it.

**Options considered:**

| Approach | Verdict |
|---|---|
| Draw spikes into the ceiling texture only | **Rejected as primary.** A ceiling is seen at a grazing angle; flat-drawn spikes read as blue smears. |
| Billboarded prop sprites | **Chosen.** Nearly free, and the billboard cheat is *invisible* here — a hanging icicle is roughly rotationally symmetric, unlike a wall-mounted object. |
| Real cone geometry in `level-mesh` | Most correct, most work, needs collision thinking. Park it. |

**Do the sprite and the texture together**: a redrawn `ceil_frostvault` carrying
frozen seams and stubby icicle *roots*, so the sprites look attached rather than
floating in mid-air. That pairing is what makes the cheap option look deliberate.

**Mechanically** this is the `biome.glow` fungus scatter with a different sprite
and a Y offset. Prop kind `'icicle'`; `dungeon-renderer` places it with the
existing `place()` at `y = WALL_H - height`, billboarding like every other
sprite; the sprite carries a low-emissive core highlight so it reads in the dark,
and takes the biome torch colour through `uTint` the way the threshold ward pulse
already does (`dungeon-renderer.ts:455`).

**Do not give icicles a light.** `MAX_LIGHTS` is 12 and torches already compete
for those slots; a scatter of icicle lights would push wall torches out of the
list and make the room *darker*.

**Placement is the whole feel.** A flat 4% scatter reads as noise. Cluster
instead: pick 8–14 seed tiles per floor, and around each seed place 2–5 icicles
on neighbouring ceiling tiles at jittered sub-tile offsets with varied heights
(0.35–0.9m), from a 3-sprite set (stub, spike, long fang). A dense clump over a
doorway and bare ceiling elsewhere is a *place*. Uniform scatter is a *texture*.

**Seed safety.** Roll icicles from a dedicated stream —
`createRng(hashString("icicles:" + seed + ":" + depth))` — never the floor's shared
`rng`. Drawing from the shared stream would reshuffle every enemy, pickup, key
and trap roll after it on every future floor of every existing seed, and would
move `biome-variety.test.ts` and the playtest harness with it.

**Two gameplay hooks, deliberately parked.** Icicles as a telegraphed falling
hazard (a new trap kind plus a save field), and tall clusters as line-of-sight
breakers (free with geometry, impossible with billboards). Both are good. Both
are a different piece of work, and the ask here is how the place looks.

### 3.4 Acceptance

The Frost Vault strip on the art sheet shows five walls, two floors and its own
ceiling, none of them a recoloured crypt. In game, looking down shows broken
rock under ice rather than a tile grid, and looking up shows icicles in clumps
with bare stretches between them.

---

## 4. Residents

### 4.1 Moles for the Burrows

The Burrows favour `rat, bat, spider, goblin, tunnel_stalker` — every one of
which also appears elsewhere. Nothing in the Burrows is *of* the Burrows.

The slot the biome is missing is a **burrower**. Proposal is two creatures, split
by cost so one lands immediately:

**`mole` — Delver Mole.** Depths 1–3, blunt, `behavior: 'skittish'`, slow step,
heavy windup. The trick: it leads with its digging claws, so it is **armoured
from the front and soft from behind** — and that already exists as the `shield`
field (`{ block: 0.55, stun: 0.6 }`), which implements frontal absorption plus a
bash on every second consecutive block. The counter is the flanking the player
already learned from shieldbearers, on a creature that carries no shield.
Resistances: blunt-resistant (it is built for hitting rock), soft to pierce and
slash. Loot `rat_hide`, `bone`, and `copper` — it eats through ore. **Pure data
plus art; no new systems.**

**`mole_tunneller` — Tunneller.** Depths 2–4. Submerges and is untargetable while
moving, resurfacing adjacent to the player, telegraphed by a mound decal on the
floor (`placeFlat` already does floor decals — `dungeon-renderer.ts:147`).
Needs a new `behavior: 'burrow'` in `combat.ts`. **Second pass.** It is the one
enemy that would make the Burrows feel like burrows, which is exactly why it
should not be rushed in behind the cheap one.

**While in there:** the Burrows' container prop is `urn` — crypt furniture in a
dirt tunnel. `dungeon.ts:753` already picks `barrel` for the mines, caverns and
Sporegrove. Give the Burrows a **root cache / spoil heap** of its own. One line
and one sprite, and it is precisely the sort of detail whose absence adds up to
a build that feels off.

### 4.2 Elemental reskins

The rule set by the ask — *same base stats and scaling, change skin and
resistances* — is the right constraint, because it means MECHANICS §9 stays true
without re-deriving a single number.

**The precedent already exists.** `ENEMY_ART_ELEMENTAL` generates four distinct
archers from one row set by swapping a palette (`enemies-elemental.ts:163`).
Generalise that into a variant factory in `src/data/enemies.ts`:

```ts
elementalVariant(base, {
  id: 'skeleton_ember', name: 'Scorched Bones', sprite: 'skelember',
  element: 'fire', damageType: 'fire',
  resist: { ...UNDEAD_RESIST, fire: 0.45, frost: 1.6 },
  loot: swapOne(base.loot, 'flame_shard'),
  glow: '#ff6a28',
  description: '…',
});
```

spreading the base and overriding **only** that list. Everything else — `hp`,
`attack`, `defense`, `scale`, `step`, `windup`, `recovery`, `sight`,
`minDepth`, `maxDepth`, `gold`, `itemChance`, `shield`, `behavior` — comes
through untouched.

**Back it with a test.** `elementalVariant` promises parity; a test that asserts
every field outside the override list equals the base's is ten lines and keeps
the promise honest the first time someone tunes a base.

#### Spawn behaviour comes out right for free

`dungeon.ts:848` already excludes any enemy whose `element` mismatches the
biome's, so **a fire variant can never appear on a frost floor, or on any
non-elemental floor** — no new filtering. And `ELEMENTAL_ENEMY_WEIGHT = 4`
already multiplies aligned creatures up on-theme.

**One real risk:** eight new variants at full weight would make the elemental
floors *almost entirely* variants, stripping out the neutral rats and goblins
that give those floors texture. `biome-variety.test.ts` would still pass (it only
asserts `aligned > neutral`), so the test will not catch it.

**Therefore:** give each variant `weight = base.weight × 0.5`, so the existing ×4
lands them at 2× a neutral spawn rather than 4×. And do **not** add variants to
`favoredEnemies` — that stacks to ×16 and crowds the floor out entirely.

#### The roster

Bases chosen for silhouettes that survive a palette swap and fantasies that bend.

**Emberworks** — `resist: { fire: 0.45, frost: 1.6 }`, `damageType: 'fire'`:

| Base | Variant | Read |
|---|---|---|
| `skeleton` | **Scorched Bones** | charred black bone, coal-red glow inside the ribcage |
| `skeleton_shield` | **Cinder Guard** | shield glowing at the boss — answers the Icebound Guard |
| `spider` | **Emberback** | cracked carapace, heat between the plates |
| `ghoul` | **Slagborn** | half-melted, dripping |

**Frost Vault** — `resist: { frost: 0.45, fire: 1.6 }`, `damageType: 'frost'`:

| Base | Variant | Read |
|---|---|---|
| `skeleton` | **Rimebound** | frost-white bone, blue eye glow |
| `bat` | **Hoarfrost Bat** | pale, trailing frost |
| `ghoul` | **Frozen Wretch** | blue-grey, ice crusted on the shoulders |
| `goblin_shield` | **Glacier Goblin** | answers Cinder Guard across the pair |

**Not the Sporegrove, and not the Catacombs.** Neither declares an `element`, and
giving them one would mean a new element *and* a new damage type — which breaks
the "same stats" simplicity that makes this whole item cheap. The Sporegrove
already has the Spore Hunter and its fungus light; the Catacombs have the
Drowned Bones. Leave them.

#### Art cost — the honest number

Each variant wants `${sprite}_0`, `${sprite}_1`, `${sprite}_atk`. The cheap path
is to export the base's `rows` arrays and re-emit them under a new id with a new
palette: **zero new pixel authoring, about four lines per variant.** Then hand-add
**one** deliberate distinguishing stamp each — the glowing ribcage, the ice on
the shoulders — so a variant is not merely a hue shift. That is the right effort
split: cheap mechanism, one expensive detail.

**The actual implementation risk** is that not every base's palette is shaped for
a swap. The archers work because `ARCHER_PAL` reserves `c/d/e/G/H/P` for exactly
this. Some enemy art in `enemies-a.ts` / `enemies-b.ts` / `enemies-variety.ts`
may hard-code colours inline. Expect a small per-base palette refactor, and check
this before committing to the full roster of eight.

#### Bestiary cost

Every variant is a `BESTIARY_ORDER` row and a codex page: 25 entries becomes 33.
Each needs a real `description`, and since the codex already spills resistances,
the description must not simply restate them. Work, not a blocker.

---

## 5. Phasing

Each phase is independently shippable and independently playable.

| # | Phase | Contents | Acceptance |
|---|---|---|---|
| 1 | **Ember walls** | `uTime`/`uPulse` in `ps1.ts`; `wallVariants` in `BiomeDef` + `level-mesh`; four ember walls redrawn; `FURNACE_VENT` retired for the grate | Sheet shows four distinct walls, one of them unlit; glow visibly breathes in game |
| 2 | **Frost Vault** | Five frost walls; rock-and-ice floor ×2 + `floorVariants`; `ceil_frostvault`; icicle prop kind, art ×3, clustered placement on its own RNG stream | Sheet shows the vault with no crypt art left in it; icicles hang in clumps |
| 3 | **Burrows** | `mole` (data + art); Burrows spoil-heap container | Mole spawns in the Burrows and punishes a frontal trade |
| 4 | **Reskins** | `elementalVariant` factory + parity test; 8 variants; palettes; bestiary entries | Parity test green; elemental floors read as themed without losing neutral spawns |
| — | *Parked* | `mole_tunneller` burrow behaviour; icicles as a falling hazard; icicles as LoS breakers | — |

Run after each phase: `npm test`, `npm run typecheck`, `npm run art:sheet`.
`biome-variety.test.ts` should be extended in phase 1 to assert the variant
count and that the variants rasterise differently, in the same shape as the
existing "visibly different floors" test.

## Implementation progress — 2026-09-15

Phase 1 now has four Emberworks wall textures (soot, mortar seam, molten lower
course, iron grate), with soot occupying two of five position-hash slots. Pillars
use the same set. The old alternate texture ID remains as a grate alias.
Emissive surface pixels pulse at amplitude 0.35 and 3.8 rad/s, offset by world
position; ambient light varies ±8% at 0.4 Hz. Other materials default to zero
pulse. No generation rolls or save fields changed.

The biome review sheet includes all distinct wall choices. Shipped PNGs and
manifest must be regenerated with the source art. Automated checks cover distinct
rasters, weighting, the unlit wall, opaque masonry, and registered art references.
Browser review covers the three environments, roof attachment and live heat pulse;
see [the review gallery](../previews/elemental-biomes.md).


Phases 2–4 now include the five frost walls, two glazed rock floors, dedicated
roof, three icicle sprites, Delver Mole and root cache, plus all eight elemental
relatives with inherited-stat tests and bestiary entries. The active numerical
reference is MECHANICS.md, under Elemental surfaces and residents.

Corrections discovered against the original survey:

- The existing spawn filter only rejects opposite elements on elemental floors;
  it does not exclude elemental creatures from neutral floors. The new eight
  variants explicitly require their matching biome. Legacy spawn rules remain.
- The existing guard now uses a raise/hold/drop rhythm and a guard-break counter,
  not an unconditional bash on every second block. The mole inherits that live
  behavior, with its own 55% absorption and 0.6-second stun.
- Enemy animation uses idle/attack and, where applicable, guard frames. All new
  residents have those poses; an unused `_1` idle frame was not added.
- Icicle metadata is optional on props, with no required save field or migration.
  Their IDs and RNG stream are separate; a regression test compares complete
  generated floors with decoration enabled and disabled, ignoring item UIDs.
- The old floor snapshot remains in the fixture; `elementalFloorHash` pins the
  intentional new content. Original monster HP, loot and player-kit checks stay.

Parked work remains parked: tunnelling AI, falling icicles, and icicle collision.

Validation: 475 tests, production build and static balance tables pass. The
8-run-per-profile playtest completes 56 delves without timeouts; all eight
prepared expeditions reach depth 6. Headless Chromium reports no runtime or
WebGL errors during the three-biome capture.


## Spec audit and subsequent art refinements

All four planned phases are implemented. The Delver Mole, root cache, eight
variants, bestiary entries, inherited-stat tests, weighted biome spawns, separate
icicle RNG, frozen surfaces and clustered ceiling sprites are present. Saves
keep their schema. The idle/attack/guard poses follow the live animation system;
an unused second idle frame was not added. The mole follows the current timed
guard rules. The explicitly parked tunneller, falling-icicle hazard and icicle
line-of-sight mechanics remain unimplemented.

Later visual feedback extends the original Emberworks scope: four lava-crust
floor and ceiling layouts, independent pulse rates, heavy hanging lava beads,
and harmless floor bubbles/bursts. The ceiling has a dimmer palette and gentler
pulse than the floor. Recessed furnace openings have chipped masonry and bent
bars, and a deterministic spacing rule leaves at least two ordinary wall panels
between them; pillars use solid soot brick. A warped iron door glows along its
sagging lower edge, including a matching locked variant. The root cache is a
low mound of earth with branching roots and an exposed buried shard. None of
these visual refinements change loot, damage or generation RNG.
