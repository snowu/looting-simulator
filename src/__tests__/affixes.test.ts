import { describe, expect, it } from 'vitest';
import { affix } from '../data/affixes';
import { emptyStats, STAT_KEYS, STAT_LABELS } from '../types';

describe('Spell Focus', () => {
  it('is a zero-initialized stat with its display label', () => {
    expect(STAT_KEYS).toContain('focus');
    expect(STAT_LABELS.focus).toBe('Spell Focus %');
    expect(emptyStats().focus).toBe(0);
  });

  it('restricts both focus affixes to head and jewellery', () => {
    expect(affix('graven')).toEqual({
      id: 'graven', name: 'Graven', kind: 'prefix', stat: 'focus', min: 3, max: 6,
      perLevel: 0.5, slots: ['head', 'ring', 'amulet'], weight: 3, minIlvl: 4,
    });
    expect(affix('vigil')).toEqual({
      id: 'vigil', name: 'of the Vigil', kind: 'suffix', stat: 'focus', min: 4, max: 8,
      perLevel: 0.6, slots: ['head', 'ring', 'amulet'], weight: 4, minIlvl: 3,
    });
  });
});
