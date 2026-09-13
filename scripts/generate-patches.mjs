// Regenerates src/data/patches.ts from git history: one patch per gameplay
// commit, newest first. `hash` is the source commit, `summary` the
// player-facing note. Summaries are written for players, not developers:
// what changed for YOU, never how it was built.
// Usage: node scripts/generate-patches.mjs
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const SEP = '\x1f';
const log = execSync(
  `git log --reverse --pretty=format:%H${SEP}%h${SEP}%ad${SEP}%s --date=short`,
  { encoding: 'utf8' },
).trim().split('\n');

const bodyOf = (h) => execSync(`git show -s --pretty=format:%B ${h}`, { encoding: 'utf8' });
const filesOf = (h) =>
  execSync(`git show --pretty=format: --name-only ${h}`, { encoding: 'utf8' }).split('\n').filter(Boolean);

// Player-facing summaries for every gameplay commit. Voice: an excited
// player telling you what's new — second person, no dev jargon, no harness
// talk, no implementation details. Lead with what you can DO or FEEL.
const OVERRIDES = {
  '7147fc8': 'Everything is new. First-person dungeon crawling with real-time combat — read the wind-up, dodge or block — torchlight and fog, six floors, a boss at the bottom, and a full loot loop of market, forge and contracts. All in crunchy PS1 pixel art.',
  '63a3a34': 'Phone players, you are in: full touch controls. And nobody heals by standing around anymore — bring supplies or do not bleed. Oh, and monsters hit harder.',
  '4218a74': 'The game fits in your pocket now: compact phone layout, fullscreen everywhere, installable to your home screen. Panels finally behave on small screens.',
  '35dbdbd': 'One fullscreen button, pinned on every screen, with landscape lock. You will never hunt for it again.',
  be7fac0: 'Ditch the D-pad: drag anywhere to walk and turn, with one smart button that swings when there is something to hit and grabs when there is something to take.',
  '8daf200': 'The installed app updates itself and never nags you mid-run. Tab away and your run pauses with the sound off — come back and it is all still there.',
  7414299: 'The floor fights back: dart plates, spike pits, and alarm wards that scream every monster in earshot toward you. Walk slow, watch the ground, pry up what you spot for free salvage — and lure chasers onto the spikes you already found.',
  '0dacefd': 'Recall scrolls do not end your run anymore — they rip open a two-way portal home. Bank your gold, restock, then step back to the exact depth you left. Pack your bag from the stash before you descend, and the boss hoard finally drops where you can grab it.',
  ca99845: 'Your hand looks like a hand now — fingers, bracer, the works — and the Hollow Knight finally holds his sword instead of wearing it through the chest. The title screen lists the real controls too.',
  '0dc7f00': 'Parrying is in! Snap your guard up at the last instant and the hit fizzles — zero damage, zero stamina — while melee attackers reel for a full second of double damage. Even arrows: smack them back into whoever shot them.',
  '667f68c': 'Hate the dark? The Warden sells lamplight now: three ranks of Lantern Wick stretch your torch further, and the first rank spots traps a tile sooner.',
  d46a8ee: 'Traps glint cold iron now so your eyes stand a chance, loot stops hijacking your taps mid-brawl, and chickening out at depth 1 pays exactly nothing. No more free renown.',
  '81f5572': 'Popping back up from depth 1 does not turn the day anymore — the market and the guild only move when you have actually been somewhere.',
  d29dc2b: 'Some chests are lying to you. Learn the tell before you reach.',
  '32ff6d1': 'Mimics unfold spindly legs when they spring and hit like vault guardians. That hoard is guarded for a reason.',
  '7b3bfea': 'Three shrines now, readable from across the room: blue font heals you clean and lifts curses, violet idol gambles blessings against curses that follow you all run, gold stone sells blessings for coin up front. Feeling lucky?',
  '5871a63': 'Your gear wears down fighting: weapons dull on every landed blow, shields soak what you block, armour suffers what gets through. Broken gear still fights at quarter strength, and the forge mends the lot — broken first — with one Mend All button.',
  d325893: 'New weapon: the mining pick. Quick for its punch with a taste for crits — and the forge knows its recipe.',
  '3df228d': 'Dead traps stay on the floor as wreckage — bent plates, collapsed spikes, shattered wards. You will remember where you have been.',
  '69da1ca': 'Accounts are here, and totally optional: get a code by email, sign in, and carry your delves from laptop to phone. Offline players lose nothing.',
  b1a022e: 'Your saves drift to the cloud in the background, and when two devices disagree, YOU pick the winner — never mid-delve, never silently.',
  '68556c2': 'Three save slots — three whole playthroughs, each living on your device and in the cloud. Pick your poison on the title screen.',
  bf6ef58: 'Loot got rebalanced and blueprints are master recipes now: spare copies feed mastery all the way to Rank 5 instead of gathering dust.',
  '772acc0': 'Endgame materials hit way harder — star iron, dragon scale, moonsilver, the lot — and a new Sunstone gem feeds holy builds. Forging high-tier finally pays.',
  '195bbf9': 'The blueprint shelf got tidier: clearer progress, easier upgrades, no more squinting.',
  '3e885db': 'Blueprints stack now instead of clogging your stash, and the mining pick got a fresh look.',
  '7e05c19': 'Rumor: the mining pick hides a secret. Rock and Stone, miner.',
  b1a1b52: 'Gear runs in power lines now — every base beats the last one forged two metals better — and the strong blueprints are properly rare. Chase the ladder.',
  '52ec1ea': 'Studying blueprints and appraising finds got their own papery, leathery sound. Knowledge has ambience now.',
  '0a27ba4': 'Weapons have real personalities: quick blades, heavy hafts that sip stamina, and a long spear that outranges everything. And no more free swings on an empty bar — every swing is paid for.',
  '3f298b1': 'Damage finally has a triangle: blunt crushes bone, slash opens flesh, pierce punches through plate. Bring the right tool — the pick is pierce again, and faster.',
  '293d483': 'Daggers are the crit weapon now: they crit for 2.4x and their crit chance grows with the metal. Stack luck and watch things melt.',
  '92ddc60': 'New blood: cave bats swarm the shallows (bring something slashy), and a rotting champion with a maul holds depths 5–6 (bring a mace, trust us).',
  '75122c1': 'There is a bestiary now! Kills earn names, field notes drop off the creature they describe — read them where they fall — and full entries spill resistances. Know what is coming.',
  '953e22c': 'The codex keeps your grudges: kills, deaths, your biggest hit landed and the worst you ever took, per creature.',
  '2429c17': 'Something warm and angry haunts depth 3: the Ember Wisp burns and hates the frost. Your first real elemental matchup.',
  c988bbd: 'New faces that punish button-mashing: goblin archers open up from range, and shieldbearers shrug off 75% of everything from the front. Flank them, time them, or back off.',
  '4ff430f': 'Nine named relics replace random legendaries — a sword that never dulls, a dagger that banks parries, a shield that throws hits back, a lamp that is a terrible shield, plate that eats half your healing, and one you DRINK. The Ashen King always drops one you have never held.',
  '12b96d9': 'Every relic tells you exactly what it does, in real numbers. No more flowery guessing — and stamina is called stamina.',
  '3d8fb82': 'Shield enemies telegraph now: watch the raise — swing into it and you will eat a bash and a stun. Chip the hold three times and their guard sags open.',
  ecc90cb: 'The Hollow Knight guards now too. Same rules as the rest: respect the raise.',
  '2700d73': 'Finding a relic is not knowing it — it counts the moment you grab it, but the appraiser has to name it before the codex opens its page. Mystery lump stays mysterious.',
  fa0420d: 'Relics talk plain now — hold Shift (or tap on touch) when you want the raw numbers. The codex shows both at once.',
  '48357f5': 'The whole codex follows one rule from here on: plain words, numbers on Shift, swapped live without losing your place.',
  fb51f59: 'He is home: the ASHEN KING waits on depth 6. Bring everything.',
  fb6bb03: 'The dungeon pushes back now — monsters ride the same power curve you do, so shiny gear stops auto-winning past depth 2, and loot runs scarcer. Every trip down matters. Deep runs, deep consequences.',
};

// Commits that never ship as patch notes: pre-overhaul prototypes, docs-only,
// save/cloud plumbing, dev-only gates, ops, and sprite-only redraws with no
// data or behavior change. Short hash -> reason.
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

function tagsFor(files, subject) {
  const t = new Set();
  const s = `${files.join(' ')} ${subject.toLowerCase()}`;
  if (/art\//.test(s)) t.add('art');
  if (/audio/.test(s)) t.add('audio');
  if (/touch|fullscreen/.test(s)) t.add('mobile');
  if (/cloud|supabase|account|sync|slots/.test(s)) t.add('saves');
  if (/dungeon|world|traps|shrine|mimic/.test(s)) t.add('dungeon');
  if (/market|craft|forge|recipes/.test(s)) t.add('town');
  if (/combat|parry|stamina|enemies|bestiary|uniques|relic/.test(s)) t.add('combat');
  if (/migrat|persistence|save-format/.test(s)) t.add('saves');
  if (/docs\//.test(s)) t.add('docs');
  if (!t.size) t.add('core');
  return [...t].sort();
}

const q = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

const kept = log
  .map((line) => {
    const [hash, short, date, ...rest] = line.split(SEP);
    return { hash, short, date, title: rest.join(SEP) };
  })
  .filter((c) => !(c.short in SKIP));

// Patch numbers run chronologically: the oldest gameplay change is Patch 1,
// so numbers stay stable as new patches append at the top.
kept.forEach((c, i) => (c.n = i + 1));

const patches = kept
  .map((c) => {
    const raw = bodyOf(c.hash).trim().split('\n');
    if (raw[0]?.trim() === c.title.trim()) raw.shift();
    let summary = OVERRIDES[c.short];
    if (!summary) {
      const para = raw.join('\n').split(/\n\s*\n/)[0]?.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() || c.title;
      summary = para.length > 300 ? `${para.slice(0, 297)}…` : para;
    }
    const tags = tagsFor(filesOf(c.hash), c.title);
    return `  { n: ${c.n}, hash: ${q(c.hash)}, short: ${q(c.short)}, date: ${q(c.date)}, title: ${q(c.title)}, summary: ${q(summary)}, tags: [${tags.map(q).join(', ')}] },`;
  })
  .reverse(); // newest first

writeFileSync(
  new URL('../src/data/patches.ts', import.meta.url),
  `// Patch notes: one entry per gameplay commit, newest first.\n// Generated by scripts/generate-patches.mjs — do not hand-edit. Re-run to pick up new commits.\n// Each patch is a commit: \`hash\` is the source of truth, \`summary\` is the player-facing note,\n// and \`n\` is the stable patch number (Patch 1 is the oldest gameplay change).\nexport interface Patch {\n  n: number; hash: string; short: string; date: string; title: string; summary: string; tags: string[];\n}\n\nexport const PATCHES: Patch[] = [\n${patches.join('\n')}\n];\n\nexport const PATCH_COUNT = PATCHES.length;\n`,
);
console.log(`wrote ${patches.length} patches (${log.length - kept.length} non-gameplay commits skipped)`);
