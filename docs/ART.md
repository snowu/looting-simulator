# Art: ratings, thinking and how to carry on

A handoff for continuing the sprite rework in any session, local or cloud. It
covers where every sprite stands, why, what to do next, how the work is done,
and what the owner likes and rejects. The detailed per-round tables live in
[`art-review.md`](art-review.md). This file is the one to read first.

Last updated 2026-09-25, after four rounds.

## Where things stand

| Round | PR | State | What it covered |
|---|---|---|---|
| 1 | #51 | merged | Pasture herd, spider family, ceilings and crypt floor, catacombs water, the five shrines, barrel, fungus, sconce, loot bag, knight helm, club icon |
| 2 | #52 | merged | Traps, ghoul/slagborn/wretch heads, bats, throne floor, robe and hide icons, bones, gold pile, Burrows and Sporegrove wall variants (plus review fixes) |
| 3 | #59 | **open** | Giant rat and Hoarder, iron door (and the locked and fog doors built on it), Big Toe icon and viewmodel, broken urn, Sporegrove floor variants. Takes **Patch 85**. |
| 4 | #63 | **open** | Bog Seraph, Delver mole and Spore hunter tells, Mines and Ossuary floor variants, material icons. Proposals for the chest, the mimic tell and the mine ceiling. Takes **Patch 86**. Built on round 3. |

This file arrived with #59. If you are reading it on master, round 3 is
merged. Round 4 (#63) is stacked on round 3 and carries its commits: merge #59 first, or merge #63 and close #59. Check the patch
numbers too: other agents may have claimed 85 or 86 in the meantime.

## How sprites are scored

Each sprite gets 1–10 on two questions at once:

1. **Does it read as what it is at game distance?** Enemies are drawn at 0.45–1.4
   scale in a dark, fogged, PS1-graded 3D view, so silhouette and a couple of
   bright tells (eyes, teeth, glow) do most of the work.
2. **Does it belong with the rest?** A black outline, 3–4 tone ramps lit
   from the top left, chunky pixels, and colour saved for things that matter.

The target is King's Field / Shadow Tower: dark, heavy, legible. The Ashen
King, the wisps and the Emberworks surfaces (all 8) set the bar.

## Current ratings, lowest first

Everything not listed here scored 7 or better after a rework.

| Score | Sprite | Thoughts |
|---|---|---|
| 5 | Cave and Burrows dirt (`DIRT_ROWS`: cave floors, Burrows floor and walls) | Plain but clean. A rebuild with patches and cracks came out blotchy, so it was dropped. Improve it with variants (as the Sporegrove and Mines floors did), not by redrawing the shared grid. |
| 6 | Mines floor (round 4) | Variants help, but most tiles are still the plain dirt. |
| 6 | Gravecaller | Fine silhouette; the green eyes are small. |
| 6 | Root cache, broken chest, mound | Acceptable. The broken chest reads as a broken crate. |
| 6 | Bare fist viewmodel | Holds up full-screen better than the sheet suggests. |
| 6 | Mines ceiling | Plain rubble **on purpose** (see "Deliberate choices"). A timber-set proposal is open (below). |
| 6 | Secret-wall marks, town portal, projectiles | Subtle by design. |
| 6 | Big Toe (round 3) | Much better, but still a joke weapon drawn straight. A second pass could add a hair or two and a better stump. |
| 7 | Skeleton family, goblins, archers, flame wraith, mimic, chests, most walls, wood and iron doors, viewmodels, gear, material and consumable icons | Good. Leave them unless something new sets a higher bar. |
| 7 | Round-1/2 redraws: herd, spiders, shrines, traps, ghouls, bats, props | Good. The owner liked the ghouls and the moss most. |
| 7 | Round-4 redraws: Bog Seraph, Delver mole, Spore hunter, Ossuary floor variants, material icons (ore, nugget, ingot, plank, cloth, bone, scale) | Checked in the 3D lab from three tiles away (`docs/previews/art-rework-4/5-creatures-3d.png`, `6-floors-3d.png`). The mole was only seen in its block pose there. |
| 8 | Emberworks surfaces, wisps, the Ashen King | The reference set. |

## Open proposals

These wait on the owner's pick. Don't ship either until one is chosen.

**Chest and mimic tell** (`docs/previews/art-rework-4/proposal-chest-bodies.png`,
`proposal-mimic-tells.png`). Every body keeps the lid seam on row 17, so any
tell works on any body.

- Bodies: **A strapped** (two riveted iron straps over lid and body, same
  outline), **B domed** (a barrel-top lid two rows taller, straps over it),
  **C gilt corners** (today's chest with gold corner fittings).
- Tells, subtle to loud: **T0 nails** (today: two pale pixels beside the lock),
  **T3 gap** (the lid sits proud: a black line along the seam), **T1 teeth**
  (a row of pale teeth either side of the lock; matches the mimic's face),
  **T2 tongue** (a tongue tip hanging out of the seam), **T4 keyhole eye** (a
  red emissive keyhole; loud in the dark, could be a Normal-only tell).
- Whichever body is picked, `CHEST_OPEN`, `CHEST_BROKEN` and the mimic frames
  (built on `CHEST_OPEN`) need the same restyle.

**Mine ceiling** (`proposal-mine-ceiling-3d.png` in the lab, and
`proposal-mine-ceiling-tiles.png`). The old lintel put a frame over every tile
boundary; that stays rejected.

- **M1 timber sets (recommended).** In straight corridors, every fourth tile
  gets a set: a post up the middle of both side walls (`wall_mine_set`) and a
  cap beam across the middle of the ceiling tile, oriented across the
  corridor. It reads as a mine and comes round rarely. Needs a small rule in
  `src/render/level-mesh.ts` (corridor detection plus two cap textures, one
  per orientation). The existing test keeps passing because `ceil_mine`
  itself stays plain rock. The prototype diff and draft art were kept out of
  the repo.
- **M2 lagging** (short bolted boards) and **M3 ore seam** are plain ceiling
  variants with no renderer change, but the lab showed the ceiling is seen at
  such a glancing angle that flat detail up there barely registers.

## Suggested next targets

In rough order of payoff:

1. **The chest and the mine ceiling,** once the proposals above are picked.
2. **Gravecaller eyes.** Fine silhouette; the green eyes are small.
3. **Broken chest.** It reads as a broken crate; redraw it with whichever
   chest body wins.
4. **Big Toe, second pass.** A hair or two and a better stump.
5. **Root cache and mound.** Acceptable, but plain next to the round-1 props.

Don't start on the UI frames (`src/art/ui.ts`). Other agents own the UI.

## How the work is done

Every sprite is a palette-indexed character grid in `src/art/*.ts`: one
character per pixel, `.` transparent, and `1`–`4` a material ramp that
recolours per material. Colours ending in `fa` are emissive (drawn full-bright).

**Look at the art**

- `npm run art:sheet` renders every sheet to `docs/previews/`. The same sheets
  appear in-game with F2 on a dev build.
- `npm run art:sheet -- --ids a,b,c --out <dir> --zoom 6` renders an ad-hoc
  sheet. Use it for before/after pictures (run it once on master and once on
  your branch).
- `npm run art:sheet -- viewmodels --material troll_hide` renders held weapons
  in one material. `--ids` ignores `--material`.

**Draw.** `scripts/pixel_painter.py` (pure Python, no dependencies) gives you
lines, ellipses with a shading callback, an auto-outline pass, tileable
`vnoise`, and a `preview()` that writes a PNG. The workflow:

1. Paint a draft, preview it, and look at it.
2. Fix what reads wrong. Every round-1–3 sprite took two to four passes.
3. Paste the rows into the `.ts` file with a comment on what the sprite is
   doing.

**Ship**

- `npm run art:sync -- --ids a,b,c` rewrites only those PNGs in `public/art/`.
  Never combine `--force` with `--ids`: `--force` rewrites all 300+ PNGs.
  New ids are added to the manifest automatically.
- `npm run art:check` must report "in sync".
- `npx vitest run src/__tests__/art.test.ts` runs the art tests. They include
  one requiring each attack frame to change at least 8% of pixels (the tell
  has to read) and one keeping the mine ceiling beam-free.
- Then run `npm run build` and the full `npx vitest run`.
- Patch notes: add a `patch_notes.md` entry on top, and a `src/data/patches.ts`
  entry with the next `n` in a follow-up commit citing the art commits. Add a
  skip reason in `scripts/check-patches.mjs` for the docs/sheets commit.
  `npm run patches` must exit 0; its 8 old warnings are pre-existing.
- PR: commit before/after PNGs under `docs/previews/art-rework-N/` and embed
  them with raw URLs pinned to the pushed commit
  (`https://raw.githubusercontent.com/snowu/looting-simulator/<sha>/docs/...`).
  Use the **7-character short sha**: image URLs longer than about 148
  characters get wrapped in backticks when the PR body is saved, and then
  don't render. Re-read the body after saving to check.
  Never show ASCII grids in the PR.

**Seeing it in 3D.** Run `npx vite`, open `?autostart=lab`, then drive the lab
from the console:

```js
const lab = await import('/looting-simulator/src/dev/lab-room.ts');
const w = window.__game.world;
lab.loadLabLevel(w, 'sporegrove', 3, 2);          // biome, depth, seed
lab.spawnLabMob(w, 'spider', { count: 1, spacing: 'ranged' });
// hold mobs still so you can look at them:
setInterval(() => { for (const e of w.floor.enemies) { e.ai = 'idle'; e.alert = 0; } w.player.hp = w.derived.maxHp; }, 50);
```

Click the page before each screenshot, because a backgrounded tab stops
rendering. F3 hides the lab panel.

## What the owner likes and rejects

From reviews of rounds 1–2:

- **Liked:** the ghoul heads ("banging"), the Sporegrove moss wall, the coin
  pile, and the round-1 creatures overall.
- **Rejected or fixed on review:**
  - traps drawn off-centre and looking "scuffed", fixed by drawing symmetric
    decals from mirrored halves
  - a flat pelt icon that read as a "silver turtle", now a rolled hide
  - a bone pile drawn bigger than the old one
  - bracket fungus on the walls coming up so often it stacked
- **Rules that follow:**
  - Keep a redraw's footprint close to the original.
  - Keep decorative variants rare, with plain faces in the majority.
  - Don't draw materials as top-down animal silhouettes.
  - Check icons and viewmodels in their real material colours, not just iron.
  - An icon is one object that fills the cell (the rolled hide set the pattern).
    If materials of different kinds share an icon, split it: ore and nuggets
    got their own after being drawn as smelted bars.

## Deliberate choices, don't undo

- **No timber beams on the mine ceiling.** Removed in ddbdca5 (2026-09-13),
  because they put a beam over the player at every tile boundary. A test
  guards it. Round 3 re-added them by mistake and backed out.
- **The mimic tell** is two pale pixels in the chest's lid seam. The chest
  and the mimic share rows.
- **Shrines share one plinth and a per-god colour.** The colour is the tell
  from across a room, and the object on top is the tell up close.
- **Overlays stamp onto base sprites** at fixed coordinates: the stalker
  crest and the emberback shell on the spider, the Hoarder's sack on the rat,
  the knight's shield and sword, the ghoul's elemental chest plates, the lock
  and fog on the iron door. When a base is redrawn, re-check every overlay
  on it (`grep -n "frame('\|base: '" src/art/*.ts`).

## Lessons from four rounds

- **Check history before redrawing something plain.** Run `git log -S<id>` on
  the art id and grep the tests. Some plainness is a decision.
- **Compare at zoom, side by side with the original,** before calling a
  redraw better. The small full sheet undersold the old rat, and the first
  redraw was worse until its eyes and bite were enlarged.
- **Dark palettes hide detail.** Preview textures brightened to judge the
  structure, then at true colour to confirm they stay as dark as the biome.
- **Chained shell steps should use `&&`,** so a failing test stops the commit.
- **Check references before cutting a detail.** The Spore hunter's tongue
  looked odd, but it came from the owner's own reference, so round 4 moved the
  tell to the gills and kept the tongue.
- **Floor decals need more contrast than the sheet suggests.** The first
  ore and grave tiles looked fine on the sheet and vanished in the lab. Give
  a floor decal a lighter stone or an emissive glint, and check it in 3D.
- **Fewer, bolder details beat many thin ones.** The mole's five one-pixel
  talons read as stripes; three two-pixel talons with gaps read as claws.
- **Ceilings are seen edge-on.** Only things with depth (posts, beams) read
  up there; flat ceiling decals barely register in the lab.
- **Lab screenshots of a given tile:** `loadLabLevel`, then find a tile whose
  variant is the one you want (`tileHash(x, y, 4) % 100 % floorVariants.length`)
  with two open tiles behind it, `placePlayer` there facing it, and hide the
  HUD with CSS before the screenshot. Pin a spawned enemy to a tile by
  resetting its `x`/`y` in the same interval that keeps it idle.
- **Previewing unshipped art in 3D:** register draft ids temporarily
  (`art:sync -- --ids` them so the manifest check passes), then revert both
  `public/art` and the registry before committing.
