/*
 * Paste this entire file into the browser console while in town on npm run dev.
 * Adds 99 of every current material (including catalysts and trade goods) to
 * the current character's stash and saves the active slot.
 *
 * Reuse: await __giveMaterials(250)
 * Reads the live material catalog, so new materials are included automatically.
 * Requires the Vite dev build's __game hook; deployed builds do not expose it.
 */
window.__giveMaterials = async (quantity = 99) => {
  if (!window.__game) throw new Error('Run the game with npm run dev first.');

  const base = '/looting-simulator/src';
  const [{ giveMaterials }, { saveGame }] = await Promise.all([
    import(`${base}/dev/give-materials.ts`),
    import(`${base}/state/persistence.ts`),
  ]);
  const game = window.__game;
  if (game.mode !== 'town') throw new Error('Load your character and return to town first.');

  const count = giveMaterials(game.state, quantity);
  saveGame(game.state, game.slot);
  game.enterTown();
  console.log(`Added ${quantity} each of ${count} materials to slot ${game.slot}.`);
};

window.__giveMaterials().catch(console.error);
