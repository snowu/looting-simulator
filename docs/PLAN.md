# Looting Simulator — Overhaul Plan

A first-person, grid-step dungeon crawler in the spirit of King's Field / Shadow Tower,
where the real game is what you do with the loot: trade it, craft with it, fill contracts.

## Locked decisions

| Topic      | Decision |
|------------|----------|
| Movement   | Grid steps, smoothly animated (step ≈ 0.22s, turn ≈ 0.18s), strafing allowed |
| Combat     | Real-time, King's Field / Morrowind simple: swing in front, stamina scales damage, block with shield, dodge telegraphed attacks by stepping away |
| Core loop  | Market + crafting are the core: dungeon feeds materials/items, town turns them into gold, gear and contract rewards |
| Art        | Hand-drawn pixel art. Authored as palette-indexed grids in `src/art/`; any PNG in `public/art/<id>.png` overrides the built-in art at load |

## Core loop

1. **Town (hub)** — each run is one *day*. Market prices move, contracts post and expire.
2. **Prepare** — equip gear, buy potions/scrolls, pick contracts.
3. **Descend** — floors persist within a run; stairs up/down. Floor 1's stairs up = extract.
   Deeper floors are richer but the walk back is longer. Death loses the backpack.
4. **Return** — sell, speculate, craft, identify, turn in contracts, buy meta upgrades.

## Systems

- **RNG** — seeded mulberry32 everywhere; a run is reproducible from its seed.
- **Dungeon gen** — random rooms (3–8 wide) + Dijkstra-carved corridors + MST with ~20% extra
  loop edges; room roles by graph distance (start, stairs, treasure leaves, locked vault with
  reachable key, secret room behind a pushable wall, shrine); pillars, torches, props; biome by depth.
- **Renderer** — Three.js, 320×240-class render target, nearest upscale, vertex snapping,
  affine texture warp, per-pixel torch lighting, fog, 15-bit colour + Bayer dither post pass,
  billboard sprites, hand-drawn weapon viewmodel.
- **World sim** — fixed-timestep real-time: enemies with sight/hearing, BFS chase, telegraphed
  melee, ranged projectiles, doors, keys, secret walls, chests and mimics, breakables, floor loot.
- **Items** — base × material × rarity × affixes; unidentified drops; 7 equipment slots;
  limited backpack; consumables (potions, scrolls of identify/recall).
- **Crafting** — blueprints with material *slots* (metal/wood/hide/cloth/gem); the material you
  choose drives stats, damage type and name; salvage returns materials; blueprints are loot.
- **Market** — mean-reverting prices, player supply pushes prices down and recovers over days,
  timed events, merchant stock, item categories, price history (sparklines), contracts board.
- **Meta** — Renown earned by extraction/contracts; upgrades with real effects.

## Phases

- [x] 0. Review
- [x] 1. Foundations: RNG, data model, state machine, persistence v2
- [x] 2. Pixel art pipeline + authored art
- [x] 3. Dungeon generator v2
- [x] 4. PS1 renderer
- [x] 5. Real-time world sim + combat
- [x] 6. Items, loot, inventory, equipment
- [x] 7. Crafting, market, contracts, meta
- [x] 8. UI: HUD, automap, loot window, town screens
- [x] 9. Audio, polish, tests, headless playtest

## Next ideas

- [x] Traps: dart plates, spike pits and alarm wards, spotted by looking rather than by a roll.
- [x] Mimic chests: deterministic chance, a subtle visual tell, and the original hoard on death.
- [x] Mining picks as piercing weapons, with dedicated icon and first-person art.
- [x] Shrines in three readable flavours — font, idol, offering stone — plus run-long curses.
- [x] Durability & repairs: weapons, shields and armour wear where they are used; the forge mends.
- [ ] More hand-drawn art: enemy walk frames, a town backdrop, per-weapon viewmodels for dagger/club.

### Parked pending playtest — designed in [NEXT.md](NEXT.md)

The balance pass is still waiting on play rather than on design — and the relics
have now moved the loot curve, which is exactly the thing it was waiting for:

- [x] **Legendary uniques** with bespoke effects instead of named random rolls.
      Nine relics, drawn from WoW's naming shape, Risk of Rain 2's lunar trades,
      Discworld, It's Always Sunny and Community's D&D episodes. See MECHANICS.md.
- [ ] **Balance pass**, which needs a headless playtest harness before it needs
      any numbers changed. Uniques will move the loot curve, so they come first.

Also parked: [SUPABASE_SYNC.md](SUPABASE_SYNC.md), optional accounts and
cross-device saves.

Anything that adds a field to the save goes through `src/state/migrations.ts` — see
the schema section of MECHANICS.md. Bumping `SAVE_VERSION` deletes every player's
game, so it is never the answer to "I added a field".

## Controls

| Key | Action |
|-----|--------|
| W / S | Step forward / back |
| A / D, ← / → | Turn |
| Q / E | Strafe left / right |
| Space / Left click | Attack (damage scales with stamina) |
| Shift / Right click (hold) | Block — raise it as the blow lands to parry |
| F | Interact: door, chest, loot, shrine, marked wall, trap, stairs |
| 1–4 | Quick slots |
| I / Tab | Inventory & equipment |
| M | Automap |
| Esc | Close panel / pause |
