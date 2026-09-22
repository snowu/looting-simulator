/**
 * The art pack: every PNG in public/art in one file, so a cold start makes
 * one request for the art instead of one per sprite (over three hundred).
 *
 * Built at `vite build` from the very files the per-sprite path would fetch,
 * so a hand-painted override dropped into public/art is packed like any
 * other. The PNG bytes are stored untouched and decoded by the browser.
 *
 * Layout: "LSAP", a uint32 format version, a uint32 index length, the index
 * as UTF-8 JSON — [id, byteLength][] in manifest order — then the PNGs back
 * to back in that order. All integers big-endian.
 */

const MAGIC = 'LSAP';
const VERSION = 1;

export interface ArtPackEntry {
  id: string;
  png: Uint8Array;
}

export function encodeArtPack(entries: ArtPackEntry[]): Uint8Array {
  const index = new TextEncoder().encode(JSON.stringify(entries.map((e) => [e.id, e.png.byteLength])));
  const body = entries.reduce((n, e) => n + e.png.byteLength, 0);
  const out = new Uint8Array(12 + index.byteLength + body);
  const view = new DataView(out.buffer);
  out.set(new TextEncoder().encode(MAGIC), 0);
  view.setUint32(4, VERSION);
  view.setUint32(8, index.byteLength);
  out.set(index, 12);
  let at = 12 + index.byteLength;
  for (const e of entries) {
    out.set(e.png, at);
    at += e.png.byteLength;
  }
  return out;
}

export function decodeArtPack(bytes: Uint8Array): ArtPackEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || new TextDecoder().decode(bytes.subarray(0, 4)) !== MAGIC) throw new Error('Not an art pack');
  if (view.getUint32(4) !== VERSION) throw new Error(`Unsupported art pack version ${view.getUint32(4)}`);
  const indexEnd = 12 + view.getUint32(8);
  const index: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(12, indexEnd)));
  if (!Array.isArray(index) || index.some((e) => !Array.isArray(e) || typeof e[0] !== 'string' || typeof e[1] !== 'number')) {
    throw new Error('Invalid art pack index');
  }
  const out: ArtPackEntry[] = [];
  let at = indexEnd;
  for (const [id, length] of index as [string, number][]) {
    if (at + length > bytes.byteLength) throw new Error(`Art pack truncated at ${id}`);
    out.push({ id, png: bytes.subarray(at, at + length) });
    at += length;
  }
  return out;
}
