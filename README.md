# Looting Simulator

A first-person, grid-step dungeon crawler in the spirit of **King's Field** and **Shadow Tower**, where the real game is what you do with the loot back in town: speculate on the market, forge gear from the right materials, and fill guild contracts.

- **The dungeon:** six persistent floors across four biomes (Ossuary, Deep Mines, Glowing Warrens, Ashen Throne). There are locked vaults with keys, secret rooms behind chalk-marked walls, shrines, traps of your own greed, and the Ashen King at the bottom.
- **The combat:** simple and real time. Enemies lean in and flash before they strike, so you step out of the tile or raise your shield. Swings land harder with stamina above half. Damage types matter: bring a mace to the skeletons.
- **The loot:** base, material, rarity and affixes. Uncommon-and-up drops arrive unidentified. Everything in your pack is lost if you die. Equipped gear is kept.
- **The town:** one run is one day. Commodity prices mean-revert with noise, dumping stock slips the price, and events move whole categories. The forge lets you pick the material for each recipe slot, with gem catalysts adding properties. The guild posts delivery, gear, slay and delve contracts. Renown buys permanent upgrades.

## Controls

| Key | Action |
|-----|--------|
| W / S | Step forward / back |
| A / D, ← / → | Turn |
| Q / E | Strafe |
| Space / left click | Attack |
| Shift / right click (hold) | Block |
| F | Interact: doors, chests, loot, shrines, marked walls, stairs |
| 1–4 | Quick-use consumables |
| I / Tab | Pack & gear |
| M | Map |
| Esc | Pause & help |

On phones and tablets: press and drag anywhere on the view — up/down walks, left/right turns, and holding keeps going like a held key. A quick tap (or the big button) swings at enemies, urns and empty air, or loots/opens/prays when you face something. Hold the shield to block. The corner button toggles fullscreen and locks landscape where the browser allows.

## Development

```sh
npm install
npm run dev      # http://localhost:5173/looting-simulator/
npm test         # vitest: generator invariants, combat, economy, crafting, world sim
npm run build
```

Dev-only helpers: `?autostart=1` skips the title screen, `?autostart=dungeon` drops you straight into a run, and `window.__game` exposes state for debugging.

## Architecture

```
src/
  core/        seeded RNG, directions
  data/        materials, item bases, affixes, recipes, enemies, biomes
  systems/     dungeon generator, items & loot, combat maths, crafting,
               market, contracts, meta upgrades, run lifecycle, equipment
  world/       real-time simulation (movement, AI, projectiles, interaction)
  render/      Three.js PS1 renderer: level meshes, sprites, viewmodel, post pass
  art/         hand-drawn pixel art as palette-indexed character grids
  ui/          HUD, dungeon overlays, town screens
  audio/       procedural WebAudio sound effects and ambience
```

Everything random goes through a seeded generator, so any floor can be reproduced from the run's seed.

## Art

All art is hand-drawn pixel art, written as character grids in `src/art/*.ts`. Each character is one pixel, `.` is transparent, and characters `1`–`4` form a colour ramp that is recoloured per material (so a star-iron sword really is violet). Palette colours ending in alpha `fa` are emissive and glow in the dark.

To replace any piece with your own PNG, drop `public/art/<id>.png` in and add the id to `public/art/manifest.json`, e.g. `["wall_crypt", "rat_0"]`. The art ids are listed in `src/art/`.
