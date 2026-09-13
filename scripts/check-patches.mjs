// Validates the hand-curated src/data/patches.ts against git history.
// Usage: node scripts/check-patches.mjs  (or `npm run patches`)
//
// Patch notes are written deliberately, not generated: an entry appears here
// because someone decided players should read it, and several commits can
// share one entry (`also`). This script fails (exit 1) on:
// - an `n` sequence that is not 1..N, newest entry first,
// - a cited commit (hash or `also`) missing from history,
// - a hash that does not start with its short,
// - one commit cited by two entries.
// It warns (exit 0) about commits that are neither cited nor skipped — curate
// them into an entry or give them a skip reason below.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SRC = new URL('../src/data/patches.ts', import.meta.url);

// Commits that must never become patch notes. Short hash -> reason.
const SKIP = {
  b469c89: 'prototype scaffolding before the game existed',
  '9aa976a': 'gitignore',
  b609499: 'pre-overhaul prototype mechanics',
  e6ed87f: 'pre-overhaul prototype',
  '2341a45': 'pre-overhaul prototype',
  '5c1831a': 'docs-only MECHANICS.md',
  3869137: 'docs-only boss floor write-up',
  '6c9732c': 'invisible save-migration plumbing',
  'c65c9a5': 'docs-only parked-work write-up',
  '5f0df3a': 'save-format refactor, no player-visible change',
  9481385: 'invisible XSS hardening',
  c78b0c4: 'auth code-box plumbing',
  cbab425: 'ops email template, not in the game',
  efd2933: 'invisible playthrough-identity plumbing',
  c844d0e: 'sync-internals fix, no outward feature',
  8569913: 'hash canonicalization plumbing',
  b85eb34: 'docs-only secret clarification',
  '81f5572': 'day-turn nuance no legit run ever notices',
  '195bbf9': 'cosmetic card restyle, changes nothing you can do',
  '428ced0': 'README and screenshots, not in the game',
  deeb6b6: 'patch-notes feature itself, not a game change',
  '3b4d337': 'docs clarification, not in the game',
  fa0420d: 'tooltip register tweak, not a change',
  '48357f5': 'tooltip register tweak, not a change',
  '783eee0': 'dev harness + NEXT.md write-up, not gameplay',
  b7a9ca6: 'sprite redraw, cosmetic only',
  cd0b5a3: 'sprite redraw, cosmetic only',
  bb37ebc: 'sprite redraw, cosmetic only',
  '8a78041': 'sprite redraw, cosmetic only',
  '7c530fc': 'sprite redraw, cosmetic only',
  dd95362: 'sprite redraw, cosmetic only',
  '5f67aa4': 'sprite redraw, cosmetic only',
  '2ab1f17': 'sprite redraw, cosmetic only',
  '157f359': 'sprite redraw, cosmetic only',
  b3665fa: 'sprite redraw, cosmetic only',
};

// Commits touching only these files maintain the notes themselves and never
// need a note of their own.
const NOTES_ONLY = new Set(['scripts/check-patches.mjs', 'scripts/generate-patches.mjs', 'src/data/patches.ts']);

const errors = [];
const warnings = [];

const src = readFileSync(SRC, 'utf8');
const entries = [...src.matchAll(/\{ n: (\d+), hash: "([0-9a-f]{40})", short: "([0-9a-f]{7})"(?:, date: "[^"]*", title: "(?:[^"\\]|\\.)*", summary: "(?:[^"\\]|\\.)*", tags: \[[^\]]*\])?(, also: \[([^\]]*)\])?/g)]
  .map((m) => ({
    n: Number(m[1]),
    hash: m[2],
    short: m[3],
    also: [...(m[5] ?? '').matchAll(/"([0-9a-f]{7})"/g)].map((a) => a[1]),
  }));

const N = entries.length;
entries.forEach((e, i) => {
  if (e.n !== N - i) errors.push(`entry ${i + 1} has n:${e.n}, expected ${N - i} (1..${N}, newest first)`);
  if (!e.hash.startsWith(e.short)) errors.push(`${e.short}: hash does not start with short`);
});

const seen = new Map();
for (const e of entries) {
  for (const c of [e.short, ...e.also]) {
    if (seen.has(c)) errors.push(`${c} cited by both ${seen.get(c)} and ${e.short}`);
    else seen.set(c, e.short);
  }
}

let git = true;
const exists = (h) => {
  try {
    execSync(`git cat-file -e ${h}^{commit}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
} catch {
  git = false;
}

if (git) {
  for (const e of entries) {
    if (!exists(e.hash)) errors.push(`${e.short}: ${e.hash} not in history`);
    for (const a of e.also) {
      try {
        execSync(`git cat-file -e ${a}^{commit}`, { stdio: 'ignore' });
      } catch {
        errors.push(`${e.short}: also-cited ${a} not in history`);
      }
    }
  }
  // Coverage: every commit is cited, skipped, or notes-only — otherwise it
  // silently misses the scroll.
  const log = execSync('git log --pretty=format:%H%x1f%h', { encoding: 'utf8' }).trim().split('\n');
  const filesOf = (h) => {
    try {
      return execSync(`git show --pretty=format: --name-only ${h}`, { encoding: 'utf8' }).split('\n').filter(Boolean);
    } catch {
      return [];
    }
  };
  for (const line of log) {
    const [hash, short] = line.split('\x1f');
    if (!hash) continue;
    if (seen.has(short)) continue;
    if (short in SKIP) continue;
    if (filesOf(hash).every((f) => NOTES_ONLY.has(f))) continue;
    const subject = execSync(`git show -s --pretty=format:%s ${hash}`, { encoding: 'utf8' });
    warnings.push(`${short} ${subject}`);
  }
} else {
  warnings.push('not a git checkout — history checks skipped');
}

console.log(`${N} patches, ${seen.size} commits cited.`);
for (const w of warnings) console.log(`uncurated: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}
console.log(warnings.length ? `${warnings.length} commit(s) need curating or a skip reason.` : 'every commit cited or skipped.');
