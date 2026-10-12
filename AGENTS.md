# Working rules for agents

Read [CONTRIBUTING.md](CONTRIBUTING.md) first: setup, tests, save rules and art rules all live there. The rules agents most often miss:

- **New art goes to the artist.** After adding or redrawing any sprite in `src/art/`, run `npm run art:sync -- --ids <new ids>` (never `--force`, never `--ids ic_...` for existing icons: it paints over hand-painted PNGs), then `npm run art:handoff`, and commit `public/art/` and `art-handoff/` (new PNGs, `manifest.json`, `TODO.md`) with the change. `art-handoff.test.ts` enforces it.
- **Never invalidate a save.** Additive fields only, migrated forward in `src/state/migrations.ts` with `SAVE_REVISION` bumped.
- **Patch notes** are hand-written in `src/data/patches.ts`, citing commit hashes; check with `npm run patches`.
- **MECHANICS.md** is the single reference for numbers that ship.
