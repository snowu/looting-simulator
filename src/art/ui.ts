import { ArtDef } from './raster';
import { rows } from './helpers';

// 9-slice panel frames (slice at 4px). '.' is left transparent so the CSS
// panel background shows through.
const FRAME = rows(`
  kkkkkkkkkkkk
  kddddddddddk
  kdnccccccndk
  kdcbbbbbbcdk
  kdcb....bcdk
  kdcb....bcdk
  kdcb....bcdk
  kdcb....bcdk
  kdcbbbbbbcdk
  kdnccccccndk
  kddddddddddk
  kkkkkkkkkkkk
`);

export const UI_ART: ArtDef[] = [
  { id: 'ui_frame', palette: { k: '#07060a', d: '#5a5660', c: '#34313a', b: '#1c1a20', n: '#a09aa8' }, rows: FRAME },
  { id: 'ui_frame_gold', palette: { k: '#07060a', d: '#a07830', c: '#6a4c1c', b: '#2a1e0c', n: '#ffe08a' }, rows: FRAME },
];
