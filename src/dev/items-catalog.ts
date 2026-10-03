import { CONSUMABLES, ITEM_BASES } from '../data/items';
import { MATERIALS } from '../data/materials';
import { UNIQUES } from '../data/uniques';

/** The highest-tier material a base can be made of, as the combat lab picks it. */
function bestMaterialFor(baseId: string): string {
  const base = ITEM_BASES.find((b) => b.id === baseId);
  const mat = base && MATERIALS
    .filter((m) => (base.primary as string[]).includes(m.category))
    .sort((a, b) => b.tier - a.tier || b.value - a.value)[0];
  return mat?.id ?? 'iron';
}

/**
 * Everything `scripts/dev-items.js` hands out, as plain data. The script is
 * generated from this (`npm run dev:items`) so it can run in the deployed game,
 * where the source modules cannot be imported.
 */
export function itemsCatalog() {
  return {
    gear: ITEM_BASES.map((b) => ({ baseId: b.id, materialId: bestMaterialFor(b.id) })),
    relics: UNIQUES.map((u) => ({ id: u.id, kind: u.kind, baseId: u.baseId, materialId: u.materialId, minDepth: u.minDepth })),
    consumables: CONSUMABLES.map((c) => c.id),
  };
}
