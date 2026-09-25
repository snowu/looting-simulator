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
| 5 | 7 | Robe icon, hide icons | The robe read as a castle, the hides as bats. → A hooded robe; a rolled hide tied with cord (a flat pelt read as a turtle). |
| 5 | 7 | Bones, dropped gold | Sticks and a yellow triangle. → Remains lying on the floor; a coin stack beside a heap. |
| 6 | 7 | Burrows and Sporegrove walls | One texture stamped down every corridor. → Five-way variant mixes like the Frost Vault's: new stones and claw-gouge faces for the Burrows, moss and bracket-fungus faces for the Sporegrove (fungus kept rare, about 1 face in 8). |

## Reworked, round 3

Re-scored against the bar the round-1 creatures set; a few sprites dropped a
point on a second look.

| Before | After | Sprite | What was wrong → what changed |
|---|---|---|---|
| 5 | 7 | Giant rat, Hoarder (`rat_*`, `hoarder_*`) | A wide face with no body: no tail, and ears lost in the outline. → Crouched, with the back humped behind a low head, round pink-lined ears, big eyes, whiskers, clawed paws and a bare tail curling out to one side. The bite opens across the whole snout. The Hoarder's sack rides on the hump. |
| 5 | 7 | Broken urn | A brown smear. → The lower half still standing, with big jagged shards for a rim, the dark hollow showing, and shards on the floor. |
| 5 | 7 | Iron door (and the locked and fog doors built on it) | Six grey panels that read as a wall plate. → A frame, plates, straps that run into hinges, a spy-grille, a pull ring and rust. The centre stays plain for the lock. |
| 4 | 6 | Big Toe icon and viewmodel | A lilac teardrop that floated above the hand. → Squat and bulbous, with the nail set below a cap of skin and knuckle creases. The stump is bound in cloth down into the fist. It still takes its material's colour (lilac in troll hide). |
| 5 | 6 | Sporegrove floor | The same puddled tile everywhere. → Five-way mix: mostly puddles, some bare earth, now and then a mossy tile with glowing sprouts. |

**Tried and dropped:** a timbered mine ceiling. The beams were removed on
purpose on 2026-09-13 (a beam over the player at every tile boundary), and a
test keeps them out. A rebuilt `DIRT_ROWS` was also dropped: it was busier
than the original but blotchier, not better.

## Reworked, round 4

| Before | After | Sprite | What was wrong → what changed |
|---|---|---|---|
| 6 | 7 | Bog Seraph | Striking up close, a spatter of red dots at range. → One bone halo ring, six fur wings radiating through it with gaps between (so the outline stays spiky), a bigger frog face, and two wing-eyes instead of ten. The halo ignites white on the attack. |
| 6 | 7 | Delver mole | The tell was small. → A pink snout with nostrils and buck teeth, three bold talons on each hand (five thin ones read as stripes), and a mouth that opens under the snout on the lunge. |
| 6 | 7 | Spore hunter | The tongue hung down all the time, so the attack only lengthened it. → At rest only the tongue's tip shows. On the lunge the gills flare and glowing spores puff out beside the body. The tongue stays: it came from the owner's reference. |
| 5 | 6 | Mines floor | One dirt tile everywhere. → About one tile in eight is spoil with copper chips (one glinting), rarer still a dropped pick. The shared `DIRT_ROWS` is untouched. |
| 5 | 7 | Material icons (`ic_ingot`, `ic_plank`, `ic_cloth`, `ic_bone`, `ic_scale`, new `ic_ore` and `ic_nugget`) | Flat bars, stripes and sticks, and ore drawn as a smelted bar. → Each one is a single object that fills the cell, like the rolled hide: a heavy 3/4-view ingot with a stamp, three boards bundled with cord, a folded length of cloth with the loose end hanging, a knobbed femur, one big keeled scale. Copper and iron ore are rock with metal veins, and the gold nugget is a raw lump. Gem, shard and essence were already fine. |
| 5 | 7 | Material colours (`src/data/materials.ts`) | Nine materials shared one placeholder lavender ramp from the crafting rework (ab0562d), and Jade/Emerald, Moonstone/Wardstone and Crystal/Frost were near twins. → Every material that shares an icon has its own colour; Jade and Moonstone got a cabochon (`ic_gem_cabochon`) and Emerald an emerald cut (`ic_gem_emerald`). The ingot became a stack of bars and the bone a thick double-knobbed femur. Gear crafted from these materials takes the new colours. |
| 5 | 7 | Consumable icons (new `ic_potion_greater`, `ic_tonic`, `ic_milk`, `ic_scroll_identify/flash/backstep/recall`; `ic_potion` redrawn, `ic_scroll` gone) | Four potions on one flask and four scrolls on one scroll, told apart only by colour. → One icon each: round flask, bigger gold-banded flask, slim vial, milk bottle; scrolls with an eye, a sunburst, a turning-back arrow and a house. The Flash Scroll's ramp went from white to sun gold so its mark shows on parchment. `ic_potion` is also the HUD's refillable flask. |
| 7 | 7 | Ossuary floor | Long flagstone corridors. → About one tile in eight is a grave lid with a cross cut in it, or an iron drain grate. |

The first draft of the floor tiles disappeared in the 3D view, so the ore got
copper on every chip and three glints, and the grave lid a lighter stone. 3D
shots: `docs/previews/art-rework-4/5-creatures-3d.png` and `6-floors-3d.png`.

**Not done, waiting on the owner:** the chest and the mine ceiling. Both have
proposal sheets in `docs/previews/art-rework-4/proposal-*.png` and are
described in [`ART.md`](ART.md#open-proposals). The catacombs floor was left
alone: it is under water, so a floor decal would barely show.

## Not reworked yet, lowest first

| Score | Sprite | Note |
|---|---|---|
| 5 | Cave and Burrows dirt (`DIRT_ROWS`) | Plain, but clean; a rebuild was busier, not better. The Mines and Sporegrove now break it up with variants. |
| 6 | Bare fist viewmodel (`vm_fist`) | Up close it holds up better than the sheet suggests. |
| 6 | Gravecaller, root cache, broken chest, mound | Solid; small readability wins possible. |
| 6 | Mines ceiling | Plain rubble; beams were rejected (see round 3). |
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
`docs/previews/art-rework-2/` (round 2), `docs/previews/art-rework-3/` (round 3) and
`docs/previews/art-rework-4/` (round 4, with the open proposals).
