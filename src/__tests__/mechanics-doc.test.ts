import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { syncMechanics } from '../../scripts/mechanics-tables';

/**
 * docs/MECHANICS.md is the single reference for numbers that ship. These keep
 * it honest: its generated tables match the data, and every file, constant and
 * function it points at is where it says.
 */

const DOC = readFileSync('docs/MECHANICS.md', 'utf8');

function sources(dir: string, out = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) sources(p, out);
    else if (p.endsWith('.ts')) out.set(p, readFileSync(p, 'utf8'));
  }
  return out;
}
const SRC = sources('src');

/** Whether `text` declares `name`: a top-level declaration, or a class member. */
function declares(text: string, name: string): boolean {
  const n = name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  return new RegExp(`(?:const|let|function|enum|class|interface|type)\\s+${n}\\b|^\\s+(?:private |readonly |static |get )*${n}\\s*[=:(<]`, 'm').test(text);
}

/** `name` → `file` claims made by the doc's *Files:* lines, in both styles it uses. */
function attributions(): { file: string; name: string; line: string }[] {
  const out: { file: string; name: string; line: string }[] = [];
  for (const line of DOC.split('\n')) {
    if (!/^\*Files?:/.test(line)) continue;
    // `path` — `a`, `b`; `other` — `c`
    for (const seg of line.split(';')) {
      const m = seg.match(/`((?:src|scripts)\/[\w./-]+\.ts)`\s*—\s*(.*)/);
      if (!m) continue;
      for (const [, name] of m[2].matchAll(/`([A-Za-z_]\w*)(?:\(\))?`/g)) out.push({ file: m[1], name, line });
    }
    // `a` / `b` in `path`
    for (const m of line.matchAll(/((?:`[A-Za-z_]\w*`\s*\/\s*)*`[A-Za-z_]\w*`) in `((?:src|scripts)\/[\w./-]+\.ts)`/g)) {
      for (const [, name] of m[1].matchAll(/`([A-Za-z_]\w*)`/g)) out.push({ file: m[2], name, line });
    }
  }
  return out;
}

describe('MECHANICS.md', () => {
  it('has generated tables that match the game data (run `npm run mechanics` to refresh them)', () => {
    expect(syncMechanics(DOC) === DOC, 'docs/MECHANICS.md is out of date with src/data: run `npm run mechanics`').toBe(true);
  });

  it('only points at files that exist', () => {
    const paths = [...new Set([...DOC.matchAll(/`((?:src|scripts|docs|public|supabase)\/[\w./-]+)`/g)].map((m) => m[1]))];
    expect(paths.length).toBeGreaterThan(30);
    expect(paths.filter((p) => !existsSync(p.replace(/\/$/, '')))).toEqual([]);
  });

  it('only names constants that exist', () => {
    const names = [...new Set([...DOC.matchAll(/`([A-Z][A-Z0-9_]{3,})`/g)].map((m) => m[1]))];
    expect(names.length).toBeGreaterThan(20);
    const nowhere = names.filter((n) => ![...SRC.values()].some((t) => declares(t, n)));
    expect(nowhere).toEqual([]);
  });

  it('finds each constant and function in the file its *Files:* line names', () => {
    const claims = attributions();
    expect(claims.length).toBeGreaterThan(40);
    const wrong = claims
      .filter((c) => SRC.has(c.file) && !declares(SRC.get(c.file)!, c.name))
      .map((c) => `${c.name} is not in ${c.file}`);
    expect(wrong).toEqual([]);
  });
});
