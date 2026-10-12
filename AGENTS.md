# Working rules for agents

Read [CONTRIBUTING.md](CONTRIBUTING.md) first: setup, tests, save rules and art rules all live there. The rules agents most often miss:

- **One copy of the art, and new art goes to the artist.** Every sprite's PNG lives at `public/art/<folder>/<id>.png` (what the game ships and what the artist paints over). After adding or changing a sprite in `src/art/`, run `npm run art:sync`: it writes new PNGs as placeholders (and refreshes untouched placeholders whose code art changed, since the game only shows the PNG), updates `public/art/manifest.json`, `src/art/placeholders.json` and `docs/art-groups.json`, and lists new sprites for the artist in `docs/art-todo.md`; commit all of it. Never `--force`, and never `--ids` a sprite that is already painted (`npm run art:status -- --list` names the placeholders): it paints over hand-painted PNGs. `art-files.test.ts` and `npm run art:check` enforce it.
- **Never invalidate a save.** Additive fields only, migrated forward in `src/state/migrations.ts` with `SAVE_REVISION` bumped.
- **Patch notes** are hand-written in `src/data/patches.ts`, citing commit hashes; check with `npm run patches`.
- **MECHANICS.md** is the single reference for numbers that ship.
