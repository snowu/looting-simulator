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
  '55e9f88': 'design doc for the run-identity plan; no player-facing change',
  '8517c39': 'progress tracker update in NEXT.md; no player-facing change',
  '2b6c9de': 'PR preview image only',
  e99ce03: 'merge only; stacked branch sync, changes covered by Patches 58 and 59',
  aa2b693: 'PR preview image only',
  d245536: 'patch-note citation only; the fix is cited by Patch 57',
  f25027a: 'merge only; stacked branch sync, changes covered by Patches 57 and 58',
  '9f785e4': 'merge only; stacked branch sync, changes covered by Patches 57-59',
  'f5d74d0': 'merge only; stacked branch sync, changes covered by Patches 57-59',
  a8894b0: 'patch-note skip reasons only',
  '37bffed': 'patch-note citation only; the retune is cited by Patch 57',
  '43b8e65': 'merge only; stacked branch sync, changes covered by Patches 57 and 58',
  c72e04c: 'merge only; stacked branch sync, changes covered by Patches 57-59',
  '9541e89': 'merge only; stacked branch sync, changes covered by Patches 57-60',
  '1c24bdf': 'harness fix only (reproducible bot save id); no player-facing change',
  ed91fa2: 'merge only; stacked branch sync of the harness fix',
  '70da7ee': 'merge only; stacked branch sync of the harness fix',
  '77943fa': 'patch-note commit for Patch 64 that also filled in patch_notes.md; covered by Patch 64',
  a4347f6: 'merge only; healing rework changes covered by Patch 51',
  '1013973': 'merge only; the master forge layout arrives with its own commit',
  '080e186': 'dev art sheet grouping only; the food art is covered by Patch 52',
  'c5e5389': 'merge only; economy and altar changes covered by Patch 46',
  'a818fc6': 'merge only; original changes already curated',
  '53f1d86': 'merge only; original changes are already curated',
  '38727b0': 'dev art-sheet information only',
  '83affdc': 'settings access and fullscreen UI; no gameplay or balance change',
  '01b87d8': 'merge only; map expansion and fog gate covered by original commits',
  'ef582f5': 'preview file housekeeping only',
  'e09cdc1': 'PR preview only',
  'ea2f867': 'dev lab map controls and cosmetic lava visibility/audio; no gameplay or system changes',
  'ee5397d': 'cosmetic biome lighting, vent spacing and prop art; no gameplay or system changes',
  '64cff4f': 'cosmetic lava animation and enemy-art refinement; no gameplay or system changes',
  '03f006f': 'merge only; player-facing changes are covered by their original commits',
  a0df8e0: 'merge only; player-facing changes are covered by their original commits',
  ecd94ef: 'water footsteps and catacomb ambience, no gameplay or system change',
  '4c01267': 'volume and mute settings, outside gameplay/system patch notes',
  '30ecca9': 'item-icon material colors, visual fix only',
  caf74bb: 'PNG asset validation, internal tooling rather than gameplay',
  '425c867': 'exported PNG loading pipeline, no gameplay or system change',
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
  '52ec1ea': 'single study sound, not a note',
  '8daf200': 'app update plumbing, not gameplay',
  '35dbdbd': 'fullscreen toggle chrome, not gameplay',
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
  '94991ca': 'art handoff export, not in the game',
  '0f2ff8c': 'dev art sheet, a build tool nobody playing can open',
  '0c2b95c': 'dev art sheet contents, not in the game',
  '99a717e': 'dev art sheet contents, not in the game',
  '4d1eb17': 'preview GIFs for a pull request, not in the game',
  '3ae9192': 'the preview GIF generator, not in the game',
  a6a3402: 'notes pipeline rebuild, not a game change',
  // The first difficulty branch, merged and then reverted whole. The feature
  // ships from the second one instead, so these describe nothing a player can
  // reach and the note for it cites 652132b.
  '11f0cb8': 'reverted first difficulty branch, superseded by 652132b',
  '846f204': 'reverted first difficulty branch',
  b73ccf5: 'reverted first difficulty branch',
  '0c3027b': 'merge of the reverted first difficulty branch',
  '5d91673': 'the revert itself, restoring the pre-difficulty game',
  // The cloud-save hardening of the same day, reverted whole after it broke
  // duplicate-save detection and new-save sync. The surviving forge-preview
  // escape is invisible hardening, so neither commit describes anything a
  // player can reach.
  '30b44ad': 'reverted cloud hardening, superseded by af5354d',
  af5354d: 'the revert itself, restoring pre-hardening sync',
  // Weapon-overhaul branch scaffolding: docs, tooling, previews and dev
  // rooms. The gameplay itself is curated as Patch 42 (hash 9c99288).
  '9be384c': 'docs-only MECHANICS write-up, not in the game',
  '8a2542c': 'README controls table, not in the game',
  '7ab99ec': 'balance harness numbers + docs, no game change',
  '70b0af3': 'patch_notes.md draft, not loaded by the game',
  '35142c1': 'preview PNGs for a pull request, not in the game',
  '3f2745a': 'dev combat rooms + tests, not in the game',
  '4b9df45': 'dev console unlock script, not in the game',
  '6f47e36': 'dev unlock script wiring behind DEV, not in the game',
  e044123: 'dev lab arena behind DEV, not in the game',
  f9c9e56: 'art-handoff staging + PR previews, not yet in the game',
  a029e9d: 'preview sheets + dev art-sheet tool for the PR, not in the game',
  '10ef6ff': 'art sync build tool, not in the game',
  a297375: 'test-only parry assumption fix + notes file, not gameplay',
  // This branch's own scaffolding: PR preview art and the master merge.
// The gameplay ships as Patch 44 (hash 4e0a343).
  '9e0f01b': 'preview PNGs for a pull request, not in the game',
  '51b33a9': 'merge of master into the branch; its commits are curated or warned individually',
  e09cdc1: 'preview PNG for a pull request, not in the game',
  ef582f5: 'preview PNG move for a pull request, not in the game',
  // This branch's own scaffolding: patch_notes.md section + Patch 48 entry
  // for Astra's crafting/progression work, and the dev materials helper.
  // The gameplay itself is curated as Patch 48 (hash e01892d).
  '1533b27': 'patch_notes.md section + Patch 48 entry, not loaded by the game',
  '0d7932b': 'dev materials helper behind DEV, not in the game',
  '86b47ff': 'lab mimic/honest chest buttons behind DEV, not in the game',
  '91926de': 'propAt skips wreckage; only reachable by stacking props with the dev lab',
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
