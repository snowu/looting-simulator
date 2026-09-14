/*
 * Paste into the browser console to open everything up for playtesting.
 *
 *   npm run dev
 *   open http://localhost:5173/looting-simulator/?autostart=1
 *   paste this whole file into the console
 *
 * Dev server only, and deliberately so. `window.__game` is behind
 * `import.meta.env.DEV`, and the `/src/...` imports below are raw modules that
 * only Vite serves — neither exists in a production bundle, so this cannot be
 * run against the deployed game by accident.
 *
 * What it does:
 *   - one of every weapon, belt, shield and armour piece, forged in the best
 *     material its own recipe allows, Epic, at item level 16
 *   - a loadout equipped through `equipFrom`, so the two-handed rule runs and
 *     you get the same refusals and swaps a player would
 *   - every thrown belt's stock filled, if a run is open
 *   - all five sigils inscribed, Wardcry attuned
 *   - every recipe at Rank 5 and a pile of every material, so the forge works
 *   - gold, renown and every Warden upgrade maxed
 *
 * Slot 3, always. Slot 1 holds the save from before slots existed, which is
 * where anyone who has actually been playing finds their character, so nothing
 * here may ever land on it. The session is switched to slot 3 *before* anything
 * is handed out — writing the gear and then moving would leave it one autosave
 * away from slot 1 — and the script refuses to run at all on a build without
 * `__game.useSlot`, rather than quietly unlocking whatever slot you were in.
 *
 * Pass a slot to override: `__unlock(2)`. Slot 1 is refused by the game itself.
 */
window.__unlock = async (targetSlot = 3) => {
  const g = window.__game;
  if (!g) {
    console.error('[unlock] window.__game is missing. This only works on `npm run dev`, not a built copy.');
    return;
  }
  if (typeof g.useSlot !== 'function') {
    console.error(
      '[unlock] This build has no __game.useSlot, so the script cannot guarantee it will stay off slot 1. ' +
      'Refusing to run rather than risk your save. Pull the branch and restart the dev server.',
    );
    return;
  }
  const was = g.slot;
  g.useSlot(targetSlot);
  console.log(`[unlock] switched from slot ${was} to slot ${g.slot}; slot 1 will not be touched.`);

  const BASE = '/looting-simulator/src';
  const [items, inventory, equip, spells, itemData, materialData, recipeData, metaData, types, persistence] = await Promise.all([
    import(`${BASE}/systems/items.ts`),
    import(`${BASE}/state/inventory.ts`),
    import(`${BASE}/systems/equip.ts`),
    import(`${BASE}/systems/spells.ts`),
    import(`${BASE}/data/items.ts`),
    import(`${BASE}/data/materials.ts`),
    import(`${BASE}/data/recipes.ts`),
    import(`${BASE}/systems/meta.ts`),
    import(`${BASE}/types.ts`),
    import(`${BASE}/state/persistence.ts`),
  ]);

  const { makeEquipment, makeMaterial } = items;
  const { addItem } = inventory;
  const { equipFrom } = equip;
  const { ITEM_BASES } = itemData;
  const { MATERIALS } = materialData;
  const { RECIPES, MAX_RECIPE_RANK } = recipeData;
  const { META_UPGRADES } = metaData;
  const { Rarity } = types;

  const s = g.state;
  const ILVL = 16;

  // --- gear -----------------------------------------------------------------
  // Best material each base actually allows. A club takes wood, a plate takes
  // metal; handing everything star iron would produce items the forge cannot.
  const bestMaterial = (base) =>
    MATERIALS
      .filter((m) => base.primary.includes(m.category))
      .sort((a, b) => b.tier - a.tier || b.value - a.value)[0];

  const made = new Map();
  for (const base of ITEM_BASES) {
    const mat = bestMaterial(base);
    if (!mat) continue;
    const item = makeEquipment({
      baseId: base.id,
      materialId: mat.id,
      rarity: Rarity.Epic,
      ilvl: ILVL,
      quality: 1,
      identified: true,
    });
    addItem(s.stash, item);
    made.set(base.id, item);
  }

  // --- a loadout ------------------------------------------------------------
  // Through equipFrom rather than by assignment, so the two-handed rule runs
  // and this is a loadout the game could actually have produced.
  // Mints its own copy rather than reusing the one already in the stash: two
  // ring slots want two rings, and equipping the same uid twice fails the
  // second time with "That can't be equipped" because it is no longer there.
  const wear = (baseId, slot) => {
    const base = ITEM_BASES.find((b) => b.id === baseId);
    const mat = base && bestMaterial(base);
    if (!mat) return console.warn(`[unlock] no such base: ${baseId}`);
    const item = makeEquipment({
      baseId, materialId: mat.id, rarity: Rarity.Epic, ilvl: ILVL, quality: 1, identified: true,
    });
    addItem(s.stash, item);
    const err = equipFrom(s.equipment, s.stash, item.uid, slot);
    if (err) console.warn(`[unlock] ${baseId}: ${err}`);
  };
  wear('long_sword', 'weapon');
  wear('tower_shield', 'offhand');
  wear('javelins', 'thrown');
  wear('great_helm', 'head');
  wear('plate', 'body');
  wear('gauntlets', 'hands');
  wear('band', 'ring1');
  wear('band', 'ring2');
  wear('pendant', 'amulet');

  // --- sigils ---------------------------------------------------------------
  s.spells = ['wardcry', 'snuff', 'sounding', 'threshold', 'temper'];
  s.attuned = 'wardcry';
  if (s.run) s.run.sigil = { id: s.attuned, cd: 0 };
  // A spare stone of each, for trying the forge bench itself.
  for (const id of s.spells) addItem(s.stash, spells.makeSigil(id));

  // --- crafting -------------------------------------------------------------
  for (const r of RECIPES) s.recipeRanks[r.id] = MAX_RECIPE_RANK;
  for (const m of MATERIALS) addItem(s.stash, makeMaterial(m.id, 99));

  // --- purse and board ------------------------------------------------------
  s.gold = 999999;
  s.renown = 999;
  for (const u of META_UPGRADES) s.meta[u.id] = u.costs.length;

  // --- run state ------------------------------------------------------------
  const w = g.world;
  if (w) {
    w.refreshDerived();
    // Thrown stock is filled once per delve, on the first frame you carry a
    // belt. Equipping one mid-run misses that, so fill it here.
    w.run.thrown ??= { held: {}, retrieveCd: 0 };
    for (const base of ITEM_BASES) {
      if (!base.thrown) continue;
      const probe = makeEquipment({ baseId: base.id, materialId: bestMaterial(base).id, rarity: Rarity.Epic, ilvl: ILVL });
      w.run.thrown.held[base.id] = items.thrownCapacity(probe);
    }
    w.player.hp = w.derived.maxHp;
    w.player.stamina = w.derived.maxStamina;
  }

  // --- write it down --------------------------------------------------------
  // `useSlot` saved the character as it was on the way in, so without this the
  // unlocks live only in memory until the next autosave — reload before one
  // fires and the slot still holds the pre-unlock copy.
  persistence.saveGame(s, g.slot);

  // --- repaint --------------------------------------------------------------
  if (g.mode === 'town') g.enterTown();

  console.log(
    `[unlock] slot ${g.slot}: ${made.size} pieces in the stash, ${s.spells.length} sigils inscribed, ` +
    `${RECIPES.length} recipes at Rank ${MAX_RECIPE_RANK}. ` +
    (w ? 'Run state refreshed.' : 'Descend to try it.'),
  );
};

window.__unlock();
