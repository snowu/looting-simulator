# Contributing to Looting Simulator

This guide covers running the game locally, the dev tools built into it, the test suite, and the few rules that keep live players' saves safe.

## Prerequisites

- **Node.js 20.19+ or 22.12+** (Vite 8's minimum; CI builds on Node 20)
- **npm** (the lockfile is `package-lock.json`)
- **git**
- Optional: **ffmpeg**, only for `scripts/art-gif.mjs`

No backend is required. Cloud saves are the only networked feature, and the game hides them when they aren't configured.

## Setup

```bash
git clone https://github.com/snowu/looting-simulator.git
cd looting-simulator
npm install
npm run dev
```

Open **http://localhost:5173/looting-simulator/**. The trailing path matters: `vite.config.ts` sets `base: '/looting-simulator/'` to match GitHub Pages, so the site root returns nothing.

To test on a phone on the same network, run `npm run dev -- --host` and open the printed network URL. Touch controls switch on automatically.

### Cloud saves (optional)

Passwordless sign-in and cross-device sync use Supabase. To work on them:

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
```

Both values are public by design, since they ship in the browser bundle. **Never** put the service-role key in `.env` or in any `VITE_` variable. The table and row-level security live in `supabase/game_saves.sql`, the OTP email template is `supabase/email-otp-template.html`, and the design is in [docs/SUPABASE_SYNC.md](docs/SUPABASE_SYNC.md). Without a `.env`, the account UI stays hidden and everything else works.

## Dev shortcuts

All of these exist only under `npm run dev`. They sit behind `import.meta.env.DEV`, so none of them reach a production bundle.

| Shortcut | What it does |
|---|---|
| `?autostart=1` | Skip the title and open Bleakmere on your last slot |
| `?autostart=dungeon` | Go straight into a delve |
| `?autostart=lab` | **Combat lab**: every recipe at Rank 5, 999 of every material, one of every weapon, a cleared room, and a spawn console. Pick a biome, depth and seed, then spawn any enemy (already mid-swing if you like) |
| `?autostart=boss` | Depth-6 kit, standing in the throne room facing the Ashen King |
| `?autostart=archers` / `?autostart=melee` | Staged rooms for ranged and melee encounter tuning |
| `?art` or **F2** | In-game art sheet: every sprite, with enemy attack cadences animated |
| **F3** | Toggle the lab spawn console |
| `window.__game` | Live `state`, `world`, `mode`, plus `enterDungeon()`, `enterTown()`, `useSlot(n)` |

The title screen also shows a *Dev build only* row with buttons for the same destinations.

Lab, boss and staged rooms run on a **scratch game** that is never saved, and reloading gives you your slot back. Console scripts that hand out gear should call `__game.useSlot(2)` or `useSlot(3)` first. Slot 1 refuses on purpose, because that's where a real playthrough lives. `scripts/dev-materials.js` is a paste-into-console helper that gives the current character materials.

## Checks

Run these before you push:

```bash
npm test            # vitest suite (src/__tests__)
npm run build       # typecheck + production build (what CI runs)
npm run patches     # validate the in-game patch notes against git history
npm run art:check   # fail if public/art drifted from the code-drawn sprites
```

`npm run typecheck` runs `tsc --noEmit` on its own.

### Balance harnesses

Headless, seeded runs driven by a scripted bot (`scripts/playtest.ts`). They're slower than unit tests and live under a separate vitest config:

| Command | Reports |
|---|---|
| `npm run playtest` | Seeded delves played by four player profiles, from first-timer to best-in-slot (writes `playtest-report.txt`) |
| `npm run tables` | Static balance tables in seconds, cheap enough to run after every tweak (writes `balance-tables.txt`) |
| `npm run upgrades` | What each Warden upgrade is worth, maxed alone against none |
| `npm run find` | What loot find is worth, read straight off the loot tables |

Diff the reports before and after a balance change. Some tests pin generation with golden hashes (`src/__tests__/fixtures/`). If you change a drop table or floor generation on purpose, update the fixture in the same commit and say why.

## Project layout

```
src/
  main.ts          boot, game loop, mode switching (title / town / dungeon), input
  types.ts         shared types
  core/            rng, directions, ids, escaping: no game knowledge
  data/            content tables: biomes, enemies, items, materials, affixes,
                   recipes, relics (uniques), sigils (spells), difficulty, patch notes
  systems/         rules: combat, dungeon generation, items, crafting, market,
                   contracts, healing, meta (Warden upgrades), relics, run lifecycle
  world/world.ts   the live dungeon simulation: player, enemies, projectiles, events
  state/           GameState, inventory, save format, additive migrations, persistence
  render/          three.js PS1-style renderer, enemy poses, brightness, art cache
  art/             every sprite drawn in code, plus the registry that names them
  ui/              town, HUD, dungeon overlays, automap, settings, touch, gamepad
  audio/           WebAudio-synthesised sound effects (no audio files)
  cloud/           Supabase client, device id, save sync
  dev/             lab, boss arena, staged rooms, art sheets (dev only)
  __tests__/       vitest specs
scripts/           balance benches, art export/sync/sheets/GIFs, patch-note checker
public/art/        exported PNGs + manifest.json (generated by npm run art:sync)
docs/              MECHANICS.md (rules reference), design notes, screenshots, previews
supabase/          SQL schema and email template for cloud saves
```

## Rules that protect players

**Never break a save.** Real people have characters in `localStorage` and in the cloud.

- **Do not bump `SAVE_VERSION`** (`src/state/game-state.ts`). Changing it throws every existing save away.
- Any new field goes in as an **additive migration**: bump `SAVE_REVISION` in `src/state/migrations.ts` and append a step that backfills the field. Migrations must be safe on partial state and must never throw.
- Old items, floors and runs have to keep loading. `persistence.test.ts` and `save-format.test.ts` cover the round trip, so add a case when you add a field.

**Art has one source of truth.** Sprites are drawn in `src/art/`. After adding or changing one, run `npm run art:sync` (or `npm run art:sync -- --ids <id,...>` for just a few) to regenerate `public/art/` and its manifest. The game won't boot if the manifest misses an id. `npm run art:sheet` and `node scripts/art-gif.mjs` export sheets and GIFs for PRs into `docs/previews/`.

**Patch notes are curated.** Player-facing changes get an entry at the top of `src/data/patches.ts`, which is what the title-screen scroll shows. Commits that shouldn't become notes (docs, tooling, merges) get a skip reason in `scripts/check-patches.mjs`. `npm run patches` fails on a broken sequence or a bad hash and warns about commits that aren't covered.

**Play on a phone too.** Mobile is a first-class target. Check narrow and landscape layouts, not just desktop.

## Shipping

Every push to `master` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`). Open copies, installed ones included, check `version.json` and reload into the new build. Open a pull request against `master`. The PR description should include what you changed, how you verified it (tests, build, a real play of the feature), and screenshots or a GIF for anything visual.
