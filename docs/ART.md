# Art: ratings, thinking and how to carry on

A handoff for continuing the sprite rework in any session, local or cloud. It
covers where every sprite stands, why, what to do next, how the work is done,
and what the owner likes and rejects. The detailed per-round tables live in
[`art-review.md`](art-review.md). This file is the one to read first.

Last updated 2026-09-25, after three rounds.

## Where things stand

| Round | PR | State | What it covered |
|---|---|---|---|
| 1 | #51 | merged | Pasture herd, spider family, ceilings and crypt floor, catacombs water, the five shrines, barrel, fungus, sconce, loot bag, knight helm, club icon |
| 2 | #52 | merged | Traps, ghoul/slagborn/wretch heads, bats, throne floor, robe and hide icons, bones, gold pile, Burrows and Sporegrove wall variants (plus review fixes) |
| 3 | #59 | **open** | Giant rat and Hoarder, iron door (and the locked and fog doors built on it), Big Toe icon and viewmodel, broken urn, Sporegrove floor variants. Takes **Patch 85**. |

This file arrived with #59. If you are reading it on master, round 3 is
merged. If #59 is still open, branch round 4 off `art/rework-round3`, not
master. Check the patch number too: other agents may have claimed 85 in the
meantime.

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
| 5 | Mine and cave dirt (`DIRT_ROWS`: mine floor, cave floors, Burrows floor and walls) | Plain but clean. A rebuild with patches and cracks came out blotchy, so it was dropped. Improve it with variants (as the Sporegrove floor did), not by redrawing the shared grid. |
| 6 | Bog Seraph | Striking up close, but too busy to read at range. Worth a pass: fewer red eye dots, a clearer halo ring, and a face that holds at 1.0 scale. |
| 6 | Delver mole | Solid. The claws and the snout could be bigger for the tell. |
| 6 | Spore hunter | Reads as a mushroom creature. The pink tongue-worm is odd; the gills could carry the attack tell instead. |
| 6 | Gravecaller | Fine silhouette; the green eyes are small. |
| 6 | Root cache, broken chest, mound | Acceptable. The broken chest reads as a broken crate. |
| 6 | Bare fist viewmodel | Holds up full-screen better than the sheet suggests. |
| 6 | Mines ceiling | Plain rubble **on purpose** (see "Deliberate choices"). |
| 6 | Secret-wall marks, town portal, projectiles | Subtle by design. |
| 6 | Big Toe (round 3) | Much better, but still a joke weapon drawn straight. A second pass could add a hair or two and a better stump. |
| 7 | Skeleton family, goblins, archers, flame wraith, mimic, chests, most walls, wood and iron doors, viewmodels, gear, material and consumable icons | Good. Leave them unless something new sets a higher bar. |
| 7 | Round-1/2 redraws: herd, spiders, shrines, traps, ghouls, bats, props | Good. The owner liked the ghouls and the moss most. |
| 8 | Emberworks surfaces, wisps, the Ashen King | The reference set. |

## Suggested next targets

In rough order of payoff:

1. **Bog Seraph readability.** A depth 3–5 elite-feeling enemy that muddies at
   range.
2. **Floor variety elsewhere.** The Sporegrove floor mix worked. The Mines
   floor (`floor_mine`) could get the same: a rare tile with ore chips or a
   dropped pick. Keep decorations rare, about 1 in 5 to 1 in 8.
3. **Delver mole and Spore hunter tells.** Bigger claws; gills that open on
   the attack.
4. **Crypt and catacomb floor variants.** A rare tile with a grave slab or a
   drain grate, to break up long Ossuary corridors.
5. **A second look at the chest**, but only the top of the lid (rows 11–14).
   The lid seam (row 17) carries the mimic tell: the two pale "nail" pixels
   players learn to spot. Do not move it.

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

## Lessons from three rounds

- **Check history before redrawing something plain.** Run `git log -S<id>` on
  the art id and grep the tests. Some plainness is a decision.
- **Compare at zoom, side by side with the original,** before calling a
  redraw better. The small full sheet undersold the old rat, and the first
  redraw was worse until its eyes and bite were enlarged.
- **Dark palettes hide detail.** Preview textures brightened to judge the
  structure, then at true colour to confirm they stay as dark as the biome.
- **Chained shell steps should use `&&`,** so a failing test stops the commit.
