# Art review: every sprite, ranked

A pass over all 321 sprites (the code art in `src/art/`, rasterised to
`public/art/`) and how they sit in the 3D view. Each one is scored 1–10 on two
questions together: **does it read as what it is at game distance**, and **does
it belong with the rest** (outline, 3–4 tone ramps lit from the top left, the
PS1 grade). Families that share rows are scored once.

The target, from the project vision, is King's Field / Shadow Tower: dark,
heavy and legible. The best sprites here already manage it: the Ashen King, the
wisps, the Emberworks surfaces. The worst were drawn as placeholders and never
came back.

Round 1 redrew everything that scored 5 or below. Round 2 took the next tier,
plus the wall repetition in the Burrows and the Sporegrove. The "after" column
is the same judgement applied to the new art.

## Reworked, round 1

| Before | After | Sprite | What was wrong → what changed |
|---|---|---|---|
| 2 | 7 | Calf, Wandering Heifer, Bull, Prize Bull (`cow_*`, `bull_*`, `prizebull_*`) | A mirrored box on a box: no legs, no ears, eyes where the forehead is; read as a totem or a die. → Tapered skull, ears out to the sides, eyes on the edges of the head, flared muzzle, shoulders behind the face, two planted legs. Patches go on after the mirror. The bull adds horns and a nose ring; the charge lowers the head, reddens the eyes and snorts. |
| 3 | 7 | Cave spider, Ceiling crawler (`spider_*`) | Black legs on a black floor, flat slab body; in the dark it was two red dots. → Domed abdomen behind a carapace, eight eyes, bone fangs, jointed legs a shade lighter than the body. |
| 4 | 6 | Tunnel stalker (`stalker_*`) | Crest pasted over the old slab. → Crest now rides the new abdomen like a ridge. |
| 4 | 7 | Emberback (`emberback_*`) | Glowing seams covered its eyes. → Seams moved onto the abdomen; eyes glow through. |
| 3 | 6 | Catacombs water (`water_catacombs`) | A uniform lattice of dots. → Broken ripple crests with troughs and glints. It is a 16% film, so structure is all that shows. |
| 4 | 6 | Ceilings: crypt, catacombs, sporegrove, throne, burrows (`ceil_*`) | Two blank slabs. → Bevelled, mottled, pitted, cracked stone. Same palettes, same darkness. |
| 5 | 7 | Crypt flagstones (`floor_crypt`) | Flat stones with lone specks. → Same stone treatment as the ceilings. |
| 4 | 7 | Shrines ×5 and their spent states (`shrine_*`) | One skull-in-a-box tinted five ways. → Shared plinth, but each god has its own object and glyph: font, idol, coffer, blood bowl, ember brazier. Spent shrines snuff and grey out. |
| 4 | 7 | Barrel, broken barrel | A plank grid that read as a crate. → Bulge, rounded stave shading, lit hoops. |
| 3 | 6 | Fungus | A few stray pixels. → Three glowing caps on a mossy foot. |
| 3 | 6 | Sconce | A grey nub. → A torch head in an iron wall bracket. |
| 4 | 6 | Loot bag (`pickup_bag`) | A brown blob. → Gathered neck, drawstring, lit side. |
| 5 | 7 | Hollow Knight / Your Shade (`knight_*`) | A box helmet with a face-sized hole. → Domed great helm, one visor slit, centre ridge, breath holes. |
| 4 | 6 | Club icon (`ic_club`) | A flat slab that read as a cleaver. → Knotted cudgel on a wrapped grip. |

## Reworked, round 2

| Before | After | Sprite | What was wrong → what changed |
|---|---|---|---|
| 4 | 7 | Traps: dart, spikes, alarm, and their sprung states | Flat UI tiles. → Set into the floor: a pressure plate with a groove and rivets, an iron board of lit spike tips, a rune scored inside a broken ring. When sprung, the plate sinks under a snapped dart, the spikes lie broken, and the rune is scored through and dark. |
| 6 | 7 | Ghoul, Slagborn, Frozen Wretch | Flat box head. → Rounded crown, heavy brow, hollow cheeks, nose slit, narrowing jaw. |
| 5 | 7 | Cave bat, Hoarfrost bat | One-tone wings, mud at small scale. → Finger bones fan from the wrist, and the leading edge is lit. |
| 5 | 7 | Throne floor | A spotless checker. → Worn, scorched, cracked, one tile chipped, and an ember crack across a row. |
| 5 | 7 | Robe icon, hide icons | The robe read as a castle, the hides as bats. → A hooded robe; a stretched pelt. |
| 5 | 7 | Bones, dropped gold | Sticks and a yellow triangle. → Remains lying on the floor; a coin stack beside a heap. |
| 6 | 7 | Burrows and Sporegrove walls | One texture stamped down every corridor. → Five-way variant mixes like the Frost Vault's: new stones and claw-gouge faces for the Burrows, moss and bracket-fungus faces for the Sporegrove. |

## Not reworked yet, lowest first

| Score | Sprite | Note |
|---|---|---|
| 5 | Big toe icon | Reads as a lilac blob. |
| 5 | Urn (broken) | Fine intact; the broken one is a brown smear. |
| 5 | Floor: sunken/sporegrove (`floor_cave`) | Puddles are good; the dirt under them is flat. |
| 6 | Iron door | Fine, but plain next to the wood door. |
| 6 | Bare fist viewmodel (`vm_fist`) | Up close it holds up better than the sheet suggests. |
| 6 | Bog Seraph | Striking, but too busy to read at range. |
| 6 | Delver mole, Hoarder, Spore hunter, Giant rat, Gravecaller | Solid; small readability wins possible. |
| 6 | Secret wall marks, town portal, projectiles | Subtle by design; fine. |
| 7 | Skeleton family (skeleton, archer, shieldguard, drowned, scorched, rimebound, cinder guard, ice guard, barrow champion) | Consistent and readable; the elemental skins are good. |
| 7 | Goblins (cutpurse, archer, shieldbearer, glacier, quartermaster) | Good faces, good silhouettes. |
| 7 | Archers (ember, rime, gloom, dawn), Flame wraith, Mimic, chests | Good. |
| 7 | Crypt, mines, throne and frost walls; wood door; icicles; ossuary niches; throne banner | Good. |
| 7 | Viewmodels (blades, axes, polearms, shields, sigil) | Clean and chunky; they hold up full-screen. |
| 7 | Gear, material and consumable icons | Consistent ramp; they recolour well. |
| 8 | Emberworks walls, lava floors and ceilings | The strongest set of surfaces in the game. |
| 8 | Ember and Frost wisps | Instantly readable, great tell. |
| 8 | The Ashen King (all phases) | The best sprite in the game; each phase is distinct. |

## How the redraws were made

Every sprite is still a palette-indexed character grid in `src/art/`, so it
stays diffable, recolourable and editable by hand. For the ones with curves
(the spider's legs, the barrel's bulge, the stone and water textures), a small
shape painter produced the grid first (lines, ellipses, an automatic outline
pass, tileable noise), then the grid was tuned by hand. Overlays that other
sprites stamp onto a redrawn base (the stalker crest, the emberback shell, the
knight's shield and sword) were checked and moved where they needed to.

Before/after sheets are in `docs/previews/art-rework/` (round 1) and
`docs/previews/art-rework-2/` (round 2).
