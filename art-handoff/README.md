# Art handoff

Each PNG is exported at its native resolution with transparency. Edit at this size with nearest-neighbour scaling; keep the filename and canvas dimensions. The manifest maps every file to its in-game art ID. Enemy idle, attack, and block poses are separate files.

To use a finished image in the game, copy it to `public/art/<id>.png` (without the category folder), then add `"<id>"` to `public/art/manifest.json`. The original code art remains the fallback.

Recolorable icon PNGs retain the game's four-colour material ramp. Keep their exported ramp colors for pixels that should change with material; other colors stay fixed. Alpha 250 marks emissive pixels; preserve it when editing glowing details.

Keep layered editor project files alongside these PNGs if useful. Run `npm run art:export` again only when you want a fresh export from the built-in art; it replaces files in this folder.
