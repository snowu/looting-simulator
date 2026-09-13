import { ArtDef } from './raster';
import { rows, stamp } from './helpers';
import { ENEMY_ART_A } from './enemies-a';
import { ENEMY_ART_B } from './enemies-b';

// These are separate 32px frames, with equipment and silhouettes visible even
// before their attack windup. The underlying bodies keep the game's pixel style.
const original = new Map([...ENEMY_ART_A, ...ENEMY_ART_B].map((art) => [art.id, art]));
function frame(id: string, from: string, overlay: string[], x: number, y: number, colors: Record<string, string>): ArtDef {
  const source = original.get(from)!;
  return { id, palette: { ...source.palette, ...colors }, rows: stamp(source.rows, overlay, x, y) };
}

const drownedColors = { A: '#183c45', B: '#4f8586', C: '#9bc5bc', D: '#17191b', E: '#7c9999', F: '#b3e7e1fa' };
// A two-handed maul: head, then a haft thick enough to cover the raised sword
// it replaces. At one pixel the haft left the skeleton's own blade showing
// through beside it, and the head read as a box floating near the hand.
const drownedMaul = rows(`
  .DDDDDDD
  DBBBBBBD
  DBACACBD
  DBBBBBBD
  .DDDEDDD
  ...DEED.
  ...DEED.
  ...DEED.
  ...DEED.
  ...DEED.
  ...DEED.
  ...DEED.
  ...DEED.
  ...DEED.
`);
const drownedCrown = rows(`
  .A...A...A.
  .AB.BAB.BA.
  ..ABBBBBA..
  ...ABBBA...
  ..AF...FA..
`);

const stalkerColors = { A: '#191522', B: '#483350', C: '#a85d9f', D: '#f3c863fa', E: '#0a090e' };
/**
 * The bite. A stalker is a spider with a crest, and a crest three pixels higher
 * is not a tell you can read across a room — so the attack frame spreads a pair
 * of lit fangs under the eyes, which is the one part of it that catches light.
 */
const stalkerFangs = rows(`
  EDE....EDE
  .EDE..EDE.
  .EDE..EDE.
  ..EDEEDE..
  ...E..E...
`);
const stalkerCrest = rows(`
  A..............A
  BA............AB
  .CBA........ABC.
  ..CCBA....ABCC..
  ...CCBBBBBBCC...
  ....BBDDDDBB....
  .....BDDDDB.....
`);

const iceColors = { A: '#102638', B: '#346b94', C: '#8fd8f1', D: '#e1f8ff', E: '#b7eafffa' };
const iceCrest = rows(`
  .....C.....
  ....CDC....
  ...CDDDDC..
  ..CCCCCCC..
  ...BAAAB...
`);
const iceShield = rows(`
  ....C....
  ...CDC...
  ..CDDDC..
  .CDDBDDC.
  CDDDBDDDC
  CDDDBDDDC
  CDDDBDDDC
  .CDDBDDC.
  ..CDDDC..
  ...CDC...
  ....C....
`);

// The skeleton it is built from carries a sword. Clear the blade before the
// maul goes on, or the idle frame holds both and reads as neither.
const eraseSword = Array.from({ length: 18 }, () => '_'.repeat(6));
const drownedIdle = stamp(stamp(original.get('skeleton_0')!.rows, eraseSword, 23, 8), drownedCrown, 10, 0);
const drownedAttack = stamp(original.get('skeleton_atk')!.rows, drownedCrown, 10, 0);

const stalkerAttack = frame('stalker_atk', 'spider_atk', stalkerCrest, 8, 5, stalkerColors);
const stalkerBite: ArtDef = { ...stalkerAttack, rows: stamp(stalkerAttack.rows, stalkerFangs, 11, 16) };

export const ENEMY_ART_VARIETY: ArtDef[] = [
  { id: 'drowned_0', palette: { ...original.get('skeleton_0')!.palette, ...drownedColors }, rows: stamp(drownedIdle, drownedMaul, 22, 10) },
  { id: 'drowned_atk', palette: { ...original.get('skeleton_atk')!.palette, ...drownedColors }, rows: stamp(drownedAttack, drownedMaul, 21, 0) },
  frame('stalker_0', 'spider_0', stalkerCrest, 8, 8, stalkerColors),
  stalkerBite,
  { id: 'iceguard_0', palette: { ...original.get('skelshield_0')!.palette, ...iceColors }, rows: stamp(stamp(original.get('skelshield_0')!.rows, iceCrest, 10, 0), iceShield, 1, 17) },
  { id: 'iceguard_block', palette: { ...original.get('skelshield_block')!.palette, ...iceColors }, rows: stamp(stamp(original.get('skelshield_block')!.rows, iceCrest, 10, 0), iceShield, 9, 13) },
  { id: 'iceguard_atk', palette: { ...original.get('skelshield_atk')!.palette, ...iceColors }, rows: stamp(stamp(original.get('skelshield_atk')!.rows, iceCrest, 10, 0), iceShield, 1, 15) },
];
