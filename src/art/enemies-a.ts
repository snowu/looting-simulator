import { ArtDef } from './raster';
import { fill, rows, stamp, sym } from './helpers';
import { bowAtRest, bowDrawn } from './weapons';

// Front-facing 32×32 enemy sprites, feet on the bottom row. Each enemy has an
// idle frame (`<id>_0`) and an attack/telegraph frame (`<id>_atk`).
// Glowing eyes are emissive ('fa' alpha) so they read in the dark.

// --- Giant rat ---------------------------------------------------------------
// Head-on and crouched: the back humps up behind a low head, round ears with
// pink insides, beady eyes on the sides of the skull, a tapered snout with a
// pink nose, buck teeth and whiskers, front paws with pink claws, and a bare
// tail curling out to one side. The bite pins the ears back, opens the jaws
// and brings the claws up. At 0.55 scale the ears, the teeth and the tail are
// what carry.
const RAT = rows(`
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  .........kk..........kk.........
  .......kkcckk......kkcckk.......
  ......kcccccck....kcccccck......
  ......kccppcck....kccppcck......
  .....kbbppppbbkkkkbbppppbbk.....
  .....kbbppppbbccccbbppppbbk.....
  ......kbqqqqbccccccbqqqqbk......
  ......kbbqqbbccccccbbqqbbk......
  ......kccbbcccaaaacccbbcck......
  .....kcccccaaaddddaaaccccck.....
  ....kabbbbaccddddddccabbbbak....
  ....kabbbacccddddddcccabbbak.k..
  ...kaabbbcccccddddcccccbbbaakpk.
  ...kaabbbccrwrccccrwrccbbbaakpk.
  ...kaabbbccrrrccccrrrccbbbaakkpk
  ...kaabbbbbbbbbbbbbbbbbbbbaakkpk
  ...kaabbbbbbbbddddbbbbbbbbaakkpk
  ....kabbbxxbbccppccbbxxbbbak.kpk
  ....kabbbbbxxccqqccxxbbbbbak.kpk
  .....kaaaaaxxbckkcbxxaaaaak..kpq
  ......kaaxxaaaawwaaaaxxaakkkkpqk
  .......kaaaaaaawwaaaaaaapppppqk.
  ........kbbbaaaaaaaaaabbbqqqqk..
  ........kbbbaaaaaaaakkbbbkkkk...
  ........kpppkkkkkkkk.kpppk......
`);
const RAT_ATK = rows(`
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ......kk................kk......
  ....kkcckk..kkkkkkkk..kkcckk....
  ...kcccccckkcccccccckkcccccck...
  ...kccppccccccccccccccccppcck...
  ..kbbppppbbccccccccccbbppppbbk..
  ..kbbppppbbcccaaaacccbbppppbbk..
  ...kbqqqqbcaaaddddaaacbqqqqbk...
  ...kbbqqbbaccddddddccabbqqbbk...
  ....kabbbacccddddddcccabbbak.k..
  ...kaabbbccrccddddccrccbbbaakpk.
  ...kaabbbccrwrccccrwrccbbbaakpk.
  ...kaabbbccrrrccccrrrccbbbaakkpk
  ...kaabbbbbbbbbppbbbbbbbbbaakkpk
  ...kaabbbbbbbbmmmmbbbbbbbbaakkpk
  ....kabbbxxwmwmwmwmwmxxbbbak.kpk
  ....kabbbbmxxmmmmmmxxmbbbbak.kpk
  .....kaaabbbxmmmmmmxxmbbbak..kpq
  ......kaabbbmmmmmmmmmxbbbkkkkpqk
  .......kapppmmmmmmmmmapppppppqk.
  ........kaaawawmwmwaaaakkqqqqk..
  .........kkkaaaaaaaakkk..kkkk...
  ............kkkkkkkk............
`);
const RAT_PAL = { k: '#140e0c', a: '#3a2c24', b: '#5e4a3c', c: '#7e6654', d: '#9a826c', p: '#c88080', q: '#9a5a60', r: '#ff3020fa', w: '#f0e8d8', m: '#6a0c0c', x: '#b0a090' };

// --- Bog Seraph ---------------------------------------------------------------
// A frog seen from below, spread-eagled like an icon: pale belly and throat,
// arms thrown up and out with padded fingers, long hind legs bent out to
// webbed feet. Around it, the biblical part: a bone-gold halo, and feathers
// radiating from its flanks through the ring, each with an eye near its tip,
// two more eyes on the halo's shoulders. Symmetric and frontal, so the X of
// the limbs and the ring hold at range.
const SERAPH = rows(`
  ................................
  ................................
  ...........hhhhhhhhhh...........
  .....k..khhh........hhhk..k.....
  ....kkkkpk............kpkkkk....
  ...kkwwkk.kk........kk.kkwwkk...
  ..kpkwKkkkggkkkkkkkkggkkkKwkpk..
  .kkkkkkkkgHggFFFFFFggHgkkkkkkkk.
  kcckkkgkkGGGFFFFFFFFGGGkkgkkkcck
  .kckwwkgkkffffffffffffkkgkwwkck.
  ..kkwKkgkkffffffffffffkkgkKwkk..
  ..hhkkckgggoooojjoooogggkckkhh..
  ..h.kbbkgggggfjjjjfgggggkbbk.h..
  ..h..kkbkkggFFjjjjFFggkkbkk..h..
  ..hkk..kkbkkFFffffFFkkbkk..kkh..
  kkkwwkk..kkFFFffffFFFkk..kkwwkkk
  cckwKkckkkkFFFffffFFFkkkkckKwkcc
  kkhkkbbccckfffoffofffkcccbbkkhkk
  ..hkkkbbbbkffffffffffkbbbbkkkh..
  ..hh..kkkkkkfoffffofkkkkkk..hh..
  ...hkk.kkkckooooooookckkk.kkh...
  ...kwwkcccckkooooookkcccckwwk...
  .kkkwKkbbkkggggooggggkkbbkKwkkk.
  kccckkbkkgggggkkkkgggggkkbkkccck
  .kkkkhhkGgggkk....kkgggGkhhkkkk.
  ......hkgGkk........kkGgkh......
  .......hkgGk........kGgkh.......
  ...kkkkkkkgGk......kGgkkkkkkk...
  ..kpggGgggggkhhhhhhkgggggGggpk..
  ...kkGGGGkkk........kkkGGGGkk...
  ....kpgkk..............kkgpk....
  .....kk..................kk.....
`);
// The castigation: the halo ignites white, every eye opens red, the throat
// sac swells and glows, and the arms rise.
const SERAPH_ATK = rows(`
  ................................
  .....k..k..............k..k.....
  ....kpkkpk.eeeeeeeeee.kpkkpk....
  ...kkgkgkeee........eeekgkgkk...
  ..kpgkkgke............ekgkkgpk..
  .kkkkwwk..kk........kk..kwwkkkk.
  kcckkwrk.kggkkkkkkkkggk.krwkkcck
  .kcckkkgkgHggFFFFFFggHgkgkkkcck.
  ..kkwwkgkGGGFFFFFFFFGGGkgkwwkk..
  ..kkwrkkggffffffffffffggkkrwkk..
  ...ekkckggffffffffffffggkckke...
  ..eekkbckggooJJJJJJooggkcbkkee..
  ..e...kbbkgggJJJJJJgggkbbk...e..
  kkekk..kbbkgFJJJJJJFgkbbk..kkekk
  cckwwk..kbbkFjjjjjjFkbbk..kwwkcc
  kkkwrkkkkkkFFFffffFFFkkkkkkrwkkk
  .kekkbcccckFFFffffFFFkccccbkkek.
  ..ekkkbbbbkfffoffofffkbbbbkkke..
  ..e...kkkbkffffffffffkbkkk...e..
  ..eekkkkkkkkfoffffofkkkkkkkkee..
  .kkkwwkcccckooooooookcccckwwkkk.
  kcckwrkbbbbkkooooookkbbbbkrwkcck
  .kkbkkbkkkkggggooggggkkkkbkkbkk.
  ...keek.kgggggkkkkgggggk.keek...
  .....eekGgggkk....kkgggGkee.....
  ......ekgGkk........kkGgke......
  .......ekgGk........kGgke.......
  ...kkkkkkkgGk......kGgkkkkkkk...
  ..kpggGgggggkeeeeeekgggggGggpk..
  ...kkGGGGkkk........kkkGGGGkk...
  ....kpgkk..............kkgpk....
  .....kk..................kk.....
`);
const SERAPH_PAL = { k: '#140e0c', h: '#c8a860', H: '#f0dc98', e: '#fffffffa', w: '#f0e8d8', r: '#ff3020fa', K: '#1e1a14', f: '#d8dca0', F: '#f0f0c8', g: '#8ac858', G: '#4e8a34', o: '#a8b070', p: '#d08878', a: '#6a6270', b: '#a098a8', c: '#d8d0e0', j: '#e8c8a0', J: '#fff4d8fa' };

// --- Goblin cutpurse ---------------------------------------------------------
const GOBLIN_HALF = rows(`
  ................
  ................
  ................
  ................
  ...........kkkkk
  ..........kttttt
  .........kttuuuu
  ........kttukkkk
  kk......ktukgggg
  khkk....ktkggggg
  .khgkk..ktkgfggg
  .khhggkkkkgfrrgg
  ..khggggggggyrgg
  ...kkhggggggggfg
  .....kkgggggggkk
  .......kggggkwkw
  .......kfgggkkkk
  ......kttkkfgggg
  .....ktttuukkkkk
  ....kgtttuuttttt
  ...kggkttuutttut
  ...kgfkttuuttttt
  ...kgfktuuutttut
  ...khgkuuuuttttt
  ...kggkkuuuuuuuu
  ....kk.kuuuukkkk
  .........kffgk..
  .........kfggk..
  .........kfggk..
  ........kuuuuk..
  ........kuuuuuk.
  ........kkkkkkk.
`);
const GOBLIN_DAGGER = rows(`
  .ws.
  .ws.
  .ws.
  .ws.
  .ws.
  .ws.
  .ws.
  kjjk
  kggk
  .kk.
`);
const GOBLIN_RAISED = rows(`
  ...ws.
  ...ws.
  ...ws.
  ...ws.
  ...ws.
  ..kjjk
  ..kggk
  ..kgk.
  ..kgk.
  .kgk..
  .kgk..
  .kgk..
  kgk...
  kgk...
  kgk...
  kk....
`);
const ERASE_3x7 = fill(3, 7, '_');
const GOBLIN_SHRIEK = rows(`
  kwmmmmwk
  kkwmmwkk
`);
const GOBLIN_PAL = {
  k: '#120e08', g: '#5a7a30', h: '#7a9a40', f: '#3a5020', r: '#ff4020fa', y: '#ffd040fa',
  t: '#6a4424', u: '#44280f', w: '#e8e0c0', s: '#a0a0aa', j: '#6a6a74', m: '#4a0808',
};
const GOBLIN_BASE = sym(GOBLIN_HALF);

// --- Skeleton ----------------------------------------------------------------
const SKELETON_HALF = rows(`
  ................
  ................
  ................
  ...........kkkkk
  ..........kwwwww
  .........kwwwwww
  .........kwvwwww
  .........kwkkkvw
  .........kwkrkvw
  .........kvwwwwk
  ..........kvwwww
  ...........kwkwk
  ............kkkv
  ........kkkkkvvv
  .......kwwwwkkkv
  ......kvkkwwkvwv
  ......kwk.kwkkkv
  ......kwk.kvwwwv
  ......kwk.kkkkkv
  ......kvk.kvwwwv
  ......kwk..kkkkv
  ......kwk..kvwwk
  ......kvk.kvwwwk
  .....kwwk.kkkkkk
  .....kkkk..kvk..
  ...........kwk..
  ...........kwk..
  ...........kvk..
  ...........kwk..
  ..........kwwk..
  ..........kvwwk.
  ..........kkkkk.
`);
const SKELETON_SWORD = rows(`
  ..ws..
  ..ws..
  ..wq..
  ..ws..
  ..ws..
  ..ws..
  ..qs..
  ..ws..
  ..ws..
  ..ws..
  ..ws..
  ..ws..
  ..ws..
  ..js..
  kjjjjk
  .khhk.
  .kwwk.
  ..kk..
`);
const SKELETON_RAISED = rows(`
  ....ws..
  ....ws..
  ....wq..
  ....ws..
  ....ws..
  ....ws..
  ....ws..
  ...kjjk.
  ...khhk.
  ...kwwk.
  ...kwk..
  ..kwk...
  ..kwk...
  .kwk....
  .kwk....
`);
const ERASE_4x11 = fill(4, 11, '_');
const SKELETON_PAL = {
  k: '#0e0c0a', w: '#e2d9c2', v: '#aa9e84', u: '#6e6452', r: '#ff5030fa',
  s: '#8a8a94', q: '#7a4a2a', j: '#5a5a64', h: '#5a3a1a',
};
const SKELETON_BASE = sym(SKELETON_HALF);

// --- Archers -------------------------------------------------------------------
// The skeleton, the goblin and the four elemental archers all carry the bow
// from `weapons.ts`: same silhouette at rest, same long V when it is drawn.
// Ranged creatures are read by their weapon before anything else, so the
// weapon is the thing that must not vary between them.
//
// The old side bow was a filled ellipse — at sprite scale it read as a small
// shield — and the old attack frame swapped it for a diamond on the chest.
const ARCHER_PAL = {
  ...SKELETON_PAL,
  Y: '#4a3218', Z: '#a8763f', X: '#8e877a', P: '#c8ccd6', H: '#f2f6ff', F: '#aa9e84',
};
/**
 * The skeleton's arms hang past its hips, and with the bow across its chest
 * that read as four limbs. Cut both forearms back to where the pose puts a
 * hand — one closed on the riser, one on the held shaft.
 */
const ARCHER_TRIM_ARMS = fill(4, 6, '_');

const GOB_ARCHER_PAL = {
  ...GOBLIN_PAL,
  Y: '#3a2410', Z: '#8a5c2a', X: '#8e877a', P: '#b4b4c0', H: '#eef0f8', F: '#3a5020',
};

// --- Shieldbearers ---------------------------------------------------------------
// Round shields strapped to the left forearm, same spot idle and attacking —
// only braced a little higher when the right arm goes up with the weapon.
// The raised stamps below draw arm *and* weapon, so the attack frame erases
// the hanging weapon-arm first instead of leaving both hanging and raised.
const GOB_ERASE_ARM = fill(6, 16, '_');
const SKEL_ERASE_ARM = fill(8, 15, '_');
// --- Shield block pose -----------------------------------------------------------
// The left arm bends across the body and the shield comes center: the same
// arm, redrawn — not a second shield teleported in. The weapon arm stays
// hanging with its weapon down, exactly as in idle.
//
// The guard sits on the chest, not under the chin. Held at head height it
// covered the face, which is where every one of these creatures keeps the eyes
// that tell you it has seen you; and the elbow now swings clear of the body,
// because a shield that only slides across is a shield you do not notice.
const GOB_ERASE_LEFT = fill(8, 13, '_');
const GOB_BENT_ARM = rows(`
  kgk.....
  kgkk....
  kgggk...
  .kgggk..
  ..kgggk.
  ...kkkk.
`);
const SKEL_ERASE_LEFT = fill(7, 12, '_');
const SKEL_BENT_ARM = rows(`
  kwk.....
  kwkk....
  kwwwk...
  .kwwwk..
  ..kwwwk.
  ...kkkk.
`);
const GOB_SHIELD = rows(`
  ..kkk..
  .ktttk.
  ktttttk
  kttjttk
  ktjsjtk
  kttjttk
  ktttttk
  .ktttk.
  ..kkk..
`);
const SKEL_SHIELD = rows(`
  ..kkk..
  .kjjjk.
  kjsssjk
  kjsjsjk
  kjjwjjk
  kjsjsjk
  kjsssjk
  .kjjjk.
  ..kkk..
`);
// --- Cave spider ---------------------------------------------------------------
// Head-on: a domed abdomen behind a low carapace, eight eyes in two rows, bone
// fangs, and legs a shade lighter than the body so they carry against a dark
// floor. The legs kink at a high knee and come down to the ground, which is
// what makes it a spider rather than a crab.
const SPIDER = rows(`
  ................................
  ................................
  ............kkkkkkkk............
  ..........kkcccccccckk..........
  .........kcccccccccccck.........
  ....k...kccccccddcccccck...k....
  ...kdk.kbbbbbbcddcbbbbbbk.kdk...
  ...kcckkbbbbbbbccbbbbbbbkkcck...
  ..kckckkbbbbbbbbbbbbbbbbkkckck..
  ..kckkckbbbbbbbccbbbbbbbkckkck..
  ..kck.kcbbbbbbkkkkbbbbbbck.kck..
  .kdkk..kcbbbkkcccckkbbbck..kkdk.
  .kccckkkckakcccccccckakckkkccck.
  .kckkcckkcrccccrrccccrckkcckkck.
  .kck.kkckkbbyrbbbbrybbkkckk.kck.
  kck.kdckccbbrrbbbbrrbbcckcdk.kck
  kck.kckcccbbbbrbbrbbbbccckck.kck
  kck.kckkkkcbbbbbbbbbbckkkkck.kck
  kck.kck...kkaaaaaaaakk...kck.kck
  kckkck...kkckfaaaafkckk...kckkck
  kckkck..kcckkfkkkkfkkcck..kckkck
  ck.kck.kdkk.kfk..kfk.kkdk.kck.kc
  ck.kck.kck...kfkkfk...kck.kck.kc
  ck.kck.kck....k..k....kck.kck.kc
  ck.kck.kck............kck.kck.kc
  k.kck..kck............kck..kck.k
  ..kck..kck............kck..kck..
  ..kck..kck............kck..kck..
  ..kck..kck............kck..kck..
  ...k...kck............kck...k...
  ........k..............k........
  ................................
`);
// The lunge: front legs up over the body and the fangs open.
const SPIDER_ATK = rows(`
  ................................
  .....k....................k.....
  ....kdk.....kkkkkkkk.....kdk....
  ...kcck...kkcccccccckk...kcck...
  ..kckkck.kcccccccccccck.kckkck..
  ..kckkckkccccccddcccccckkckkck..
  .kck..kcbbbbbbcddcbbbbbbck..kck.
  kck...kcbbbbbbbccbbbbbbbck...kck
  .k....kcbbbbbbbbbbbbbbbbck....k.
  .......kbbbbbbbccbbbbbbbk.......
  ..k....kbbbbbbkkkkbbbbbbk....k..
  .kdkk...kbbbkkcccckkbbbk...kkdk.
  .kccckk.kcakcccccccckack.kkccck.
  .kckkcck.krccccrrccccrk.kcckkck.
  .kck.kkckkbbyrbbbbrybbkkckk.kck.
  kck.kdckccbbrrbbbbrrbbcckcdk.kck
  kck.kckcccbbbbrbbrbbbbccckck.kck
  kck.kckkkkcbbbbbbbbbbckkkkck.kck
  kck.kck...kkaaammaaakk...kck.kck
  kckkck...kkcfkammakfckk...kckkck
  kckkck..kcckfkkkkkkfkcck..kckkck
  ck.kck.kdkkkfk....kfkkkdk.kck.kc
  ck.kck.kck.kfk....kfk.kck.kck.kc
  ck.kck.kck..kfk..kfk..kck.kck.kc
  ck.kck.kck...k....k...kck.kck.kc
  k.kck..kck............kck..kck.k
  ..kck..kck............kck..kck..
  ..kck..kck............kck..kck..
  ..kck..kck............kck..kck..
  ...k...kck............kck...k...
  ........k..............k........
  ................................
`);
const SPIDER_PAL = { k: '#0e0a0c', a: '#2a1c22', b: '#44303a', c: '#644a56', d: '#8a6a78', r: '#ff2a2afa', y: '#ffb0a0fa', f: '#d8d0c0', m: '#5a0c14' };

// --- Cave bat ----------------------------------------------------------------
// Floats, so it sits in the middle of the canvas rather than on the bottom row.
const BAT_HALF = rows(`
  ................
  .............k..
  ............kck.
  ............kck.
  ............kcck
  ..kk........kcck
  .kddkk......kcck
  kccddckkk....kcc
  kaacccccckkk.krc
  kaaaaaaccccckkcc
  kaaaaaaaaacccacw
  .kaaacccccccbbbb
  .kcccabbccbcbabb
  ..kbkbccabcababb
  ...kkcabbacaaabb
  .....kbkacabaabb
  ......k.kcaaaaka
  .........kbkaaka
  ..........k.kk.k
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
`);
// Wings swept back and maw open: the frame it snaps forward on.
// Wings swept forward and the maw open across the whole body: at 0.45 scale a
// bat is a smudge with a mouth, and the mouth is the only thing that can carry
// the tell.
const BAT_LUNGE = rows(`
  ..kwwwwwwk..
  .kwmmmmmmwk.
  kwmmmmmmmmwk
  kmmmwmmwmmmk
  .kwmmmmmmwk.
  ..kwmmmmwk..
  ...kkwwkk...
`);
const BAT_PAL = {
  k: '#090608', a: '#3e2a30', b: '#63464c', c: '#8a5c46', d: '#ab7458',
  r: '#ff4028fa', w: '#ede4d0', m: '#5a0c16',
};

// --- Barrow champion ---------------------------------------------------------
// The same bones as a skeleton, gone green in the mould, swinging a maul. Reusing
// SKELETON_BASE is the same trick the archer plays.
const MAUL_REST = rows(`
  .kkkkk.
  kmnnnmk
  kmnnnmk
  kmnnnmk
  kmmmmmk
  .kkqkk.
  ..kqk..
  ..kqk..
  ..kqk..
  ..kqk..
  ..kqk..
  ..kqk..
  ..kqk..
  ..kqk..
  ..kqk..
  ..kqk..
  ..kqk..
  ...k...
`);
const MAUL_RAISED = rows(`
  ...kkkkk.
  ..kmnnnmk
  ..kmnnnmk
  ..kmnnnmk
  ..kmmmmmk
  ...kkqkk.
  ....kqk..
  ...kqk...
  ...kqk...
  ..kqk....
  ..kqk....
  .kqk.....
  .kqk.....
`);
const ERASE_5x20 = fill(5, 20, '_');
const BARROW_PAL = {
  ...SKELETON_PAL,
  w: '#c2c8a4', v: '#8e9676', u: '#5e6450', r: '#7cff8afa',
  s: '#5a5e50', j: '#3e4238', m: '#3e3e46', n: '#6a6a76',
};

const archerBones = stamp(stamp(SKELETON_BASE, ARCHER_TRIM_ARMS, 5, 20), ARCHER_TRIM_ARMS, 23, 20);

export const ENEMY_ART_A: ArtDef[] = [
  { id: 'rat_0', palette: RAT_PAL, rows: RAT },
  { id: 'rat_atk', palette: RAT_PAL, rows: RAT_ATK },

  { id: 'bogseraph_0', palette: SERAPH_PAL, rows: SERAPH },
  { id: 'bogseraph_atk', palette: SERAPH_PAL, rows: SERAPH_ATK },

  { id: 'goblin_0', palette: GOBLIN_PAL, rows: stamp(GOBLIN_BASE, GOBLIN_DAGGER, 28, 15) },
  {
    id: 'goblin_atk',
    palette: GOBLIN_PAL,
    rows: stamp(stamp(stamp(GOBLIN_BASE, ERASE_3x7, 26, 19), GOBLIN_RAISED, 25, 3), GOBLIN_SHRIEK, 12, 15),
  },

  { id: 'skeleton_0', palette: SKELETON_PAL, rows: stamp(SKELETON_BASE, SKELETON_SWORD, 23, 8) },
  { id: 'skeleton_atk', palette: SKELETON_PAL, rows: stamp(stamp(SKELETON_BASE, ERASE_4x11, 23, 14), SKELETON_RAISED, 20, 0) },

  { id: 'archer_0', palette: ARCHER_PAL, rows: bowAtRest(archerBones) },
  { id: 'archer_atk', palette: ARCHER_PAL, rows: bowDrawn(archerBones) },

  // The goblin is the squat one: everything sits two rows lower on it.
  { id: 'gobarcher_0', palette: GOB_ARCHER_PAL, rows: bowAtRest(GOBLIN_BASE, 2) },
  { id: 'gobarcher_atk', palette: GOB_ARCHER_PAL, rows: bowDrawn(GOBLIN_BASE, 2) },

  { id: 'gobshield_0', palette: GOBLIN_PAL, rows: stamp(stamp(GOBLIN_BASE, GOBLIN_DAGGER, 28, 15), GOB_SHIELD, 0, 20) },
  {
    id: 'gobshield_block',
    palette: GOBLIN_PAL,
    rows: stamp(stamp(stamp(stamp(GOBLIN_BASE, GOB_ERASE_LEFT, 0, 18), GOB_BENT_ARM, 4, 16), GOB_SHIELD, 9, 16), GOBLIN_DAGGER, 28, 15),
  },
  {
    id: 'gobshield_atk',
    palette: GOBLIN_PAL,
    rows: stamp(stamp(stamp(stamp(GOBLIN_BASE, GOB_ERASE_ARM, 26, 15), GOBLIN_RAISED, 25, 3), GOB_SHIELD, 0, 18), GOBLIN_SHRIEK, 12, 15),
  },

  { id: 'skelshield_0', palette: SKELETON_PAL, rows: stamp(stamp(SKELETON_BASE, SKELETON_SWORD, 23, 8), SKEL_SHIELD, 1, 17) },
  {
    id: 'skelshield_block',
    palette: SKELETON_PAL,
    rows: stamp(stamp(stamp(stamp(SKELETON_BASE, SKEL_ERASE_LEFT, 2, 15), SKEL_BENT_ARM, 6, 15), SKEL_SHIELD, 9, 16), SKELETON_SWORD, 23, 8),
  },
  {
    id: 'skelshield_atk',
    palette: SKELETON_PAL,
    rows: stamp(stamp(stamp(SKELETON_BASE, SKEL_ERASE_ARM, 23, 12), SKELETON_RAISED, 20, 0), SKEL_SHIELD, 1, 15),
  },

  { id: 'spider_0', palette: SPIDER_PAL, rows: SPIDER },
  { id: 'spider_atk', palette: SPIDER_PAL, rows: SPIDER_ATK },

  { id: 'champion_0', palette: BARROW_PAL, rows: stamp(SKELETON_BASE, MAUL_REST, 22, 6) },
  {
    id: 'champion_atk',
    palette: BARROW_PAL,
    rows: stamp(stamp(SKELETON_BASE, ERASE_5x20, 23, 8), MAUL_RAISED, 18, 0),
  },

  { id: 'bat_0', palette: BAT_PAL, rows: sym(BAT_HALF) },
  { id: 'bat_atk', palette: BAT_PAL, rows: stamp(sym(BAT_HALF), BAT_LUNGE, 10, 11) },
];
