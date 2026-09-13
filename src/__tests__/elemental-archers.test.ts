import { describe, expect, it } from 'vitest';
import { enemyDef } from '../data/enemies';
import { getArt } from '../art/registry';

describe('elemental archers', () => {
  it('telegraphs the same element its arrow deals', () => {
    const variants = [
      ['cinder_raider', 'fire'],
      ['elemental_frost', 'frost'],
      ['elemental_shadow', 'shadow'],
      ['elemental_holy', 'holy'],
    ] as const;
    const tipColors = new Set<string>();
    for (const [id, element] of variants) {
      const enemy = enemyDef(id);
      expect(enemy.damageType).toBe(element);
      expect(enemy.projectile?.damageType).toBe(element);
      expect(enemy.projectile?.sprite).toBe(`proj_arrow_${element}`);
      expect(getArt(enemy.projectile!.sprite)).toBeDefined();
      const idle = getArt(`${enemy.sprite}_0`)!;
      const attack = getArt(`${enemy.sprite}_atk`)!;
      expect(idle.rows).not.toEqual(attack.rows);
      expect(idle.palette.G).toBe(attack.palette.G);
      tipColors.add(idle.palette.G);
    }
    expect(tipColors.size).toBe(variants.length);
  });
});
