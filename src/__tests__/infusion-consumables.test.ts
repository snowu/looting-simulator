import { describe, expect, it } from 'vitest';
import { CONSUMABLES } from '../data/items';
import { material } from '../data/materials';
import { draught, infusionName } from '../systems/infusion';

describe('consumables the flask takes', () => {
  // "Has a draught" is what keeps a consumable off the quick bar, stops it
  // being drunk raw and puts it on the forge bench. Today that is one bottle.
  it('are exactly Fight Milk', () => {
    expect(CONSUMABLES.filter((c) => draught(c.id)).map((c) => c.id)).toEqual(['fight_milk']);
  });

  it('are named like any other ingredient', () => {
    expect(infusionName('fight_milk')).toBe('Fight Milk');
    expect(infusionName('iron')).toBe(material('iron').name);
  });
});
