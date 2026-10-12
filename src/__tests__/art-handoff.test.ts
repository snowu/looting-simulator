import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_ART } from '../art/registry';

// Repo rule (CONTRIBUTING.md, AGENTS.md): every sprite drawn in code is handed
// to the artist. `npm run art:handoff` exports the ones missing from
// art-handoff/ and lists them in its TODO.md.
const exists = (path: string): boolean => {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
};

describe('art handoff', () => {
  const manifest: { id: string; file: string }[] = JSON.parse(readFileSync(resolve('art-handoff/manifest.json'), 'utf8'));
  const byId = new Map(manifest.map((m) => [m.id, m.file]));

  it('has a PNG in art-handoff/ for every registered sprite (run npm run art:handoff)', () => {
    const missing = ALL_ART.map((a) => a.id).filter((id) => !byId.has(id) || !exists(resolve('art-handoff', byId.get(id)!)));
    expect(missing).toEqual([]);
  });
});
