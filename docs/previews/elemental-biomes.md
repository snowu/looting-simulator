# Elemental biomes — review gallery

## Emberworks

Four walls place heat differently: unlit soot brick, an opened mortar joint,
a molten lower course, and an iron grille silhouetted against furnace light.
The unlit wall occupies two of five hash slots. Heat pulses out of phase between
surfaces and the room has a slower ambient pulse.

![Emberworks in the game](emberworks-ingame.png)

![Live heat pulse](emberworks-heat.gif)

## Frost Vault

Five walls: rimed brick, clear glaze, frozen cascade, deep split and ice-choked
grille. Two broken-rock floors carry translucent ice patches and sharp rims.
Most ice responds to the room lighting; only deep cracks emit light.

![Frost Vault in the game](frostvault-ingame.png)

Three icicle silhouettes hang from a dedicated frozen roof in separated groups.
They are decoration: no collision, interaction, falling damage or point lights.

![Icicle cluster and the frozen roof](frostvault-ceiling.png)

## Residents

Scorched Bones, Cinder Guard, Emberback and Slagborn inhabit the Emberworks.
Rimebound, Hoarfrost Bat, Frozen Wretch and Glacier Goblin inhabit the Frost
Vault. Each inherits its base creature's stats, timing and scaling, with changed
skin, elemental damage/resistances and one themed material drop.

The Delver Mole is a new Burrows resident. Its digging claws cover its face in
the guard pose and lift overhead before a blow. Flanking bypasses its frontal
protection. Root caches replace urns in newly generated Burrows floors.

![All new residents, including attack and guard poses](residents.png)

![Delver Mole and a root cache](burrows-ingame.png)

[Full biome texture sheet](biomes.png) · [Full guard sheet](guard.png)

## How these previews were made

Art sheets use the same registered pixel art as the game. In-game captures use
headless Chromium and the normal renderer in a disposable dev-lab session.
The review rooms use depth-3 seeds 2 (Emberworks), 5 (Frost Vault), and 37
(Burrows). Enemies are staged and paused, room pillars cleared for the view,
extra ordinary sconces placed for visibility, and the dev log hidden. Icicle
positions come from floor generation. No saved playthrough was changed.
The GIF samples the real renderer, including existing torch flicker.

## Validation

- 475 tests pass, including inherited stats, spawn restrictions, neutral spawns,
  mole flanking, root-cache interaction, save round trips and icicle RNG isolation.
- Production build and static balance tables pass.
- 56 scripted delves (8 per profile): no timeouts; all 8 prepared expeditions
  reach depth 6. This is a runtime and reachability check, not a balance retune.
- No JavaScript or WebGL errors reported during browser capture.

Existing saved floors keep their stored residents and props. New floors get the
new content. Tunnelling AI and falling/colliding icicles remain outside this pass.
