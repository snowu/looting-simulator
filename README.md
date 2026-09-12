# Looting Simulator

A first-person, grid-step dungeon crawler in the spirit of **King's Field** and **Shadow Tower**, where the real game is what you do with the loot back in town: speculate on the market, forge gear from the right materials, and fill guild contracts.

- **The dungeon:** six persistent floors across four biomes (Ossuary, Deep Mines, Glowing Warrens, Ashen Throne). There are locked vaults with keys, secret rooms behind chalk-marked walls, shrines in three colours that each want something different, traps of your own greed, chests that may bite back, and the Ashen King at the bottom.
- **The combat:** simple and real time. Enemies lean in and flash before they strike, so you step out of the tile or raise your shield. Raise it *just* as the blow lands and you parry instead: no damage, melee attackers reel and take double, and arrows fly back into whatever is behind them. Swings land harder with stamina above half. Damage types matter: bring a mace to the skeletons.
- **The loot:** base, material, rarity and affixes, from daggers and mining picks to star-iron plate. There are no Legendaries but the nine **relics**: hand-authored, found-only, each with one effect that changes how you play — a blade that never dulls, a shield that deals a parried blow back, a buckler that is a superb lamp and a terrible shield, armour that halves every drop of healing you will ever get. The Ashen King always gives up one you have never held. Uncommon-and-up drops arrive unidentified. Watch a chest's lid seam for two pale points: a mimic keeps the hoard, then sprouts legs and makes you fight for it. Everything in your pack is lost if you die. Equipped gear is kept.
- **Coming back:** a Scroll of Recall opens a two-way town portal. Step through to sell, stash and restock with the run still running, then step back where you left off. It closes behind you, so one scroll is one round trip.
- **Wear:** your weapon dulls on every blow that lands, your shield on every one you take on it, your armour when one gets through. Parrying costs the shield nothing. Broken gear keeps a quarter of its worth until the smith sees it, so a deep run means carrying a spare or going home to mend.
- **The town:** one run is one day. Commodity prices mean-revert with noise, dumping stock slips the price, and events move whole categories. The forge lets you pick the material for each recipe slot, with gem catalysts adding properties. The guild posts delivery, gear, slay and delve contracts. Renown buys permanent upgrades.

**Full mechanics reference:** [docs/MECHANICS.md](docs/MECHANICS.md) — every system, table and number.

**Designed, not built:** [docs/NEXT.md](docs/NEXT.md) — bespoke legendaries and the balance pass, both parked until the current systems have been played properly. [docs/SUPABASE_SYNC.md](docs/SUPABASE_SYNC.md) covers passwordless login and local-first cloud saves.

## Controls

| Key | Action |
|-----|--------|
| W / S | Step forward / back |
| A / D, ← / → | Turn |
| Q / E | Strafe |
| Space / left click | Attack |
| Shift / right click (hold) | Block — time the raise to parry |
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
