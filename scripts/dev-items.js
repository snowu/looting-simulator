/*
 * Paste this entire file into the browser console while in town on npm run dev.
 * Adds every relic (identified, and recorded in the codex), one Epic piece of
 * every gear base in its best material, and 10 of every consumable (tonics
 * included) to the current character's stash, then saves the active slot.
 *
 * Reuse: await __giveItems(25)   // quantity per consumable
 * Reads the live item catalogs, so new items are included automatically.
 * Requires the Vite dev build's __game hook; deployed builds do not expose it.
 * Always switches the session to slot 3 first (copying the current character
 * there), so slot 1, the real save, is never touched.
 */
window.__giveItems = async (quantity = 10) => {
  if (!window.__game) throw new Error('Run the game with npm run dev first.');

  const base = '/looting-simulator/src';
  const [{ giveItems }, { saveGame }] = await Promise.all([
    import(`${base}/dev/give-items.ts`),
    import(`${base}/state/persistence.ts`),
  ]);
  const game = window.__game;
  if (game.mode !== 'town') throw new Error('Load your character and return to town first.');
  game.useSlot(3);

  const n = giveItems(game.state, quantity);
  saveGame(game.state, game.slot);
  game.enterTown();
  console.log(`Slot ${game.slot} stash: ${n.relics} relics, ${n.gear} gear pieces, ${quantity} each of ${n.consumables} consumables.`);
};

window.__giveItems().catch(console.error);
