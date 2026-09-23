/**
 * The in-game bug report: everything the game knows about where you are, laid
 * out as the body of a GitHub issue, plus a repro code that drops a dev build
 * onto the same tile of the same floor.
 *
 * Why a prefilled link and not an API call: the repo is public and the game
 * has no server of its own, so the cheapest honest route is GitHub's
 * `issues/new?template=…&field=…` URL. The reporter signs in to GitHub, reads
 * exactly what will be posted, and submits it themselves. No token ever ships
 * in the bundle. The one thing a URL cannot carry is the screenshot, so the
 * UI copies it to the clipboard for a paste into the form.
 *
 * DOM-free on purpose: the UI hands in the device facts, so this stays
 * testable under plain vitest.
 */
import type { GameState } from '../state/game-state';
import type { World } from '../world/world';
import { DIR_NAMES, DX, DY, Dir } from '../core/dir';
import { biomeForFloor, BIOMES } from '../data/biomes';
import { quirkDef } from '../data/quirks';
import { enemyDef } from '../data/enemies';
import { DIFFICULTY_IDS, DifficultyId, difficultyOf } from '../data/difficulty';
import { EQUIP_SLOTS } from '../types';
import { itemName } from './items';
import { marketEvent } from './market';
import { Floor, PILLAR, WALL, tileAt } from './dungeon';
import { hashString } from '../core/rng';

export const ISSUE_REPO = 'snowu/looting-simulator';
/** `.github/ISSUE_TEMPLATE/in-game-report.yml`; its field ids are the query keys below. */
export const ISSUE_TEMPLATE = 'in-game-report.yml';
/**
 * GitHub answers 414 somewhere past 8k characters of URL. The body is kept
 * well under that, and the reporter's own words are trimmed last.
 */
export const MAX_URL = 7500;

export interface DeviceFacts {
  version: string;
  build: string;
  userAgent: string;
  viewport: string;
  touch: boolean;
  /** Display brightness as a percent (100 = default). */
  brightness: number;
}

export interface ReportSource {
  mode: 'title' | 'town' | 'dungeon' | 'summary' | string;
  state: GameState;
  world: World | null;
  townTab?: string;
  device: DeviceFacts;
}

// ---------------------------------------------------------------------------
// Repro code
// ---------------------------------------------------------------------------

/**
 * What a floor's walls depend on: the run seed, the depth, the road taken at
 * the fork and the Ashen Seals (difficulty only changes how many things
 * spawn, but it is cheap to carry). Replaying the descent 1…depth in order
 * reproduces the shrine-pity rolls too, since floors are only ever generated
 * in that order.
 */
export interface Repro {
  seed: number;
  depth: number;
  x: number;
  y: number;
  facing: Dir;
  /**
   * Fingerprint of the reported floor's walls. Floors are saved when first
   * generated, so a run that outlived an update stands on a floor an older
   * generator made; the replay compares this to say so instead of silently
   * dropping you somewhere else.
   */
  print?: string;
  difficulty?: DifficultyId;
  road?: string;
  seals?: string[];
}

/** Short and stable: the size and every tile, hashed. */
export function floorPrint(f: Floor): string {
  return hashString(`${f.width}x${f.height}:${f.tiles.join('')}`).toString(36);
}

export function reproOf(world: World): Repro {
  const run = world.run;
  const r: Repro = { seed: run.seed, depth: run.depth, x: world.player.x, y: world.player.y, facing: world.player.facing, print: floorPrint(world.floor) };
  if (run.difficulty) r.difficulty = run.difficulty;
  if (run.road) r.road = run.road;
  if (run.seals?.length) r.seals = [...run.seals];
  return r;
}

/** Compact and URL-safe: `seed.depth.x.y.facing.print[.difficulty[.road[.seal+seal]]]`. */
export function encodeRepro(r: Repro): string {
  const parts: string[] = [String(r.seed >>> 0), String(r.depth), String(r.x), String(r.y), String(r.facing), r.print ?? ''];
  const tail = [r.difficulty ?? '', r.road ?? '', (r.seals ?? []).join('+')];
  while (tail.length && !tail[tail.length - 1]) tail.pop();
  return [...parts, ...tail].join('.');
}

/** Null on anything malformed: a repro link is typed by hand as often as clicked. */
export function decodeRepro(code: string): Repro | null {
  const p = code.trim().split('.');
  if (p.length < 5) return null;
  const [seed, depth, x, y, facing] = p.slice(0, 5).map(Number);
  if (![seed, depth, x, y, facing].every(Number.isInteger)) return null;
  if (depth < 1 || facing < 0 || facing > 3 || x < 0 || y < 0) return null;
  const r: Repro = { seed: seed >>> 0, depth, x, y, facing: facing as Dir };
  const [print, difficulty, road, seals] = p.slice(5);
  if (print) {
    if (!/^[0-9a-z]+$/.test(print)) return null;
    r.print = print;
  }
  if (difficulty) {
    if (!DIFFICULTY_IDS.includes(difficulty as DifficultyId)) return null;
    r.difficulty = difficulty as DifficultyId;
  }
  if (road) r.road = road;
  if (seals) r.seals = seals.split('+').filter(Boolean);
  return r;
}

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

/** What the player is looking at: the one tile ahead, in words. */
export function describeAhead(world: World): string {
  const f = world.floor;
  const { x, y, facing } = world.player;
  const ax = x + DX[facing], ay = y + DY[facing];
  const at = `(${ax}, ${ay})`;
  const enemy = f.enemies.find((e) => e.ai !== 'dead' && e.x === ax && e.y === ay);
  if (enemy) return `${enemyDef(enemy.def).name} ${at}`;
  const door = f.doors.find((d) => d.x === ax && d.y === ay);
  if (door) return `${door.iron ? 'iron ' : ''}door, ${door.open ? 'open' : 'closed'}${door.locked ? ', locked' : ''} ${at}`;
  if (f.secrets.some((s) => s.x === ax && s.y === ay && !s.found)) return `secret wall ${at}`;
  if (f.cracks?.some((c) => c.x === ax && c.y === ay && !c.broken)) return `cracked wall ${at}`;
  const t = tileAt(f, ax, ay);
  if (t === WALL) return `wall ${at}`;
  if (t === PILLAR) return `pillar ${at}`;
  const prop = f.props.find((p) => p.x === ax && p.y === ay);
  if (prop) return `${prop.kind} ${at}`;
  return `open floor ${at}`;
}

/** Doors within two tiles: half of all "near a door" reports are about the frame. */
function nearbyDoors(world: World): string {
  const { x, y } = world.player;
  const near = world.floor.doors.filter((d) => Math.max(Math.abs(d.x - x), Math.abs(d.y - y)) <= 2);
  return near.map((d) => `(${d.x}, ${d.y}) ${d.ns ? 'N–S' : 'E–W'}${d.open ? ' open' : ''}`).join('; ');
}

type Row = [string, string];

function where(src: ReportSource): string {
  if (src.mode === 'dungeon' && src.world) {
    const f = src.world.floor;
    const quirk = quirkDef(f.quirk);
    return `Depth ${f.depth}: ${biomeForFloor(f).name}${quirk ? ` (${quirk.name})` : ''}`;
  }
  if (src.mode === 'town') return `Bleakmere${src.townTab ? `, ${src.townTab} tab` : ''}`;
  return src.mode === 'title' ? 'Title screen' : src.mode;
}

export function reportRows(src: ReportSource): Row[] {
  const { state, world, device } = src;
  const rows: Row[] = [
    ['Build', `v${device.version} (${device.build})`],
    ['Where', where(src)],
  ];
  if (src.mode === 'dungeon' && world) {
    const run = world.run;
    const p = world.player;
    rows.push(
      ['Standing', `(${p.x}, ${p.y}) facing ${DIR_NAMES[p.facing]}`],
      ['Ahead', describeAhead(world)],
    );
    const doors = nearbyDoors(world);
    if (doors) rows.push(['Doors nearby', doors]);
    rows.push(
      ['Run seed', String(run.seed)],
      ['Health', `${Math.round(p.hp)} / ${world.derived.maxHp}`],
      ['Carrying', `${run.gold}g · pack ${run.backpack.items.length}/${run.backpack.capacity}`],
    );
    if (run.road) rows.push(['Road', BIOMES.find((b) => b.id === run.road)?.name ?? run.road]);
    if (run.seals?.length) rows.push(['Seals', run.seals.join(', ')]);
  }
  const gear = EQUIP_SLOTS.map((s) => state.equipment[s]).filter((it) => !!it).map((it) => `${itemName(it!)} (${it!.rarity})`);
  if (gear.length) rows.push(['Gear', gear.join(', ')]);
  const events = state.market.events.map((e) => `${marketEvent(e.id).name} (${e.daysLeft}d left)`);
  rows.push(
    ['Save', `${difficultyOf(state.difficulty).name} · day ${state.market.day} · ${state.lifetime.runs} delves · revision ${state.revision ?? '?'}`],
    ['Market events', events.length ? events.join(', ') : 'none'],
    ['Device', `${device.viewport}${device.touch ? ' · touch' : ''} · brightness ${device.brightness}%`],
    ['Browser', device.userAgent],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

function cell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function detailsMarkdown(src: ReportSource): string {
  const lines = ['| | |', '|---|---|', ...reportRows(src).map(([k, v]) => `| ${k} | ${cell(v)} |`)];
  if (src.mode === 'dungeon' && src.world) {
    const code = encodeRepro(reproOf(src.world));
    lines.push(
      '',
      `**Repro** (dev build, \`npm run dev\`): \`?repro=${code}\``,
      `http://localhost:5173/looting-simulator/?repro=${code}`,
    );
  }
  return lines.join('\n');
}

/** First line of the description, trimmed to a title, or a generic one. */
export function defaultTitle(src: ReportSource, description: string): string {
  const first = description.trim().split('\n')[0]?.trim() ?? '';
  if (first) return first.length > 80 ? `${first.slice(0, 77)}…` : first;
  return `Bug report: ${where(src)}`;
}

/**
 * The prefilled "new issue" URL. The reporter's description is trimmed (with
 * a note) if it alone would push the URL past GitHub's limit; the facts stay
 * whole, because they are the part nobody can retype later.
 */
export function issueUrl(title: string, description: string, details: string): string {
  const build = (what: string) => {
    const q = new URLSearchParams({ template: ISSUE_TEMPLATE, title, what, details });
    return `https://github.com/${ISSUE_REPO}/issues/new?${q.toString()}`;
  };
  let url = build(description);
  if (url.length <= MAX_URL) return url;
  let keep = description.length;
  while (keep > 0 && url.length > MAX_URL) {
    keep = Math.floor(keep * 0.8);
    url = build(`${description.slice(0, keep)}\n\n[…trimmed to fit the link; please paste the rest]`);
  }
  return url;
}
