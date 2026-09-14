/**
 * Dev-only shared setup for the scratch combat rooms (`./archer-room`,
 * `./melee-room`). Same contract as `./boss-arena`: only ever imported behind
 * an `import.meta.env.DEV` guard, so none of this reaches a production bundle.
 */
import { GameState } from '../state/game-state';
import { Equipment } from '../systems/player';
import { makeConsumable, makeEquipment } from '../systems/items';
import { addItem } from '../state/inventory';
import { syncLoadout } from '../systems/run';
import { Rarity } from '../types';
import { World } from '../world/world';
import { enemyDef } from '../data/enemies';
import { Room, blocksMove, createEnemy } from '../systems/dungeon';
import { Dir, dirOf, turnAround } from '../core/dir';

export interface SquadConfig {
  /** Enemy def ids, one spawn each. */
  ids: string[];
  /** Word for the log line, e.g. 'archers'. */
  label: string;
  /** Prefix for the spawned enemy ids. */
  idPrefix: string;
  /** Where the player stands: corner tile, or nearest the room's middle. */
  stand: 'corner' | 'center';
  /** Where the squad stands: crowding the player, or nearest four paces off. */
  spacing: 'near' | 'ranged';
  /**
   * How the squad starts: merely aware of the player, or already mid-swing so
   * the whole pile lands together inside one parry window.
   */
  prime: 'alert' | 'windup';
}

/** Honest depth-1 kit: enough shield to mistime a parry or two, nothing more. */
export function prepareScratch(state: GameState): void {
  const e = {} as Equipment;
  for (const s of ['weapon', 'offhand', 'head', 'body', 'hands', 'ring1', 'ring2', 'amulet'] as const) e[s] = null;
  e.weapon = makeEquipment({ baseId: 'long_sword', materialId: 'iron', rarity: Rarity.Common, ilvl: 4 });
  e.offhand = makeEquipment({ baseId: 'tower_shield', materialId: 'iron', rarity: Rarity.Common, ilvl: 4 });
  e.body = makeEquipment({ baseId: 'plate', materialId: 'iron', rarity: Rarity.Common, ilvl: 4 });
  e.head = makeEquipment({ baseId: 'great_helm', materialId: 'iron', rarity: Rarity.Common, ilvl: 4 });
  state.equipment = e;
  const pack = syncLoadout(state);
  addItem(pack, makeConsumable('greater_healing', 5));
}

/** Face from one tile toward another, falling back through the axes. */
function face(fromX: number, fromY: number, toX: number, toY: number, fallback: Dir): Dir {
  return dirOf(Math.sign(toX - fromX), Math.sign(toY - fromY))
    ?? dirOf(Math.sign(toX - fromX), 0)
    ?? dirOf(0, Math.sign(toY - fromY))
    ?? fallback;
}

/**
 * Clear the biggest ordinary room on this floor and line the squad up in it,
 * everyone facing the player and the player facing the nearest one. Returns
 * the description for the log line.
 */
export function dropSquad(world: World, cfg: SquadConfig): string {
  const f = world.floor;
  const rooms = f.rooms.filter((r) => r.role !== 'secret' && r.role !== 'throne');
  if (!rooms.length) return 'no ordinary room on this floor';
  const room: Room = rooms.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));

  const occupied = new Set(f.enemies.filter((e) => e.ai !== 'dead').map((e) => `${e.x},${e.y}`));
  const free: Array<{ x: number; y: number }> = [];
  for (let dy = 1; dy < room.h - 1; dy++) {
    for (let dx = 1; dx < room.w - 1; dx++) {
      const x = room.x + dx, y = room.y + dy;
      if (blocksMove(f, x, y) || occupied.has(`${x},${y}`)) continue;
      free.push({ x, y });
    }
  }
  if (free.length < cfg.ids.length + 1) return `no room with space for the ${cfg.label}`;

  // Wipe the room clean so nothing else joins in: no ambushers, no traps
  // underfoot, no furniture breaking up the sight lines.
  const inside = (x: number, y: number) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
  f.enemies = f.enemies.filter((e) => !inside(e.x, e.y));
  f.traps = f.traps.filter((t) => !inside(t.x, t.y));
  f.props = f.props.filter((p) => !p.blocking || !inside(p.x, p.y));

  const spot = cfg.stand === 'corner'
    ? [...free].sort((a, b) => (a.x + a.y) - (b.x + b.y))[0]
    : [...free].sort(
      (a, b) => Math.abs(a.x - (room.x + room.w / 2)) + Math.abs(a.y - (room.y + room.h / 2))
        - (Math.abs(b.x - (room.x + room.w / 2)) + Math.abs(b.y - (room.y + room.h / 2))),
    )[0];
  world.player.x = spot.x;
  world.player.y = spot.y;
  const dist = (t: { x: number; y: number }) => Math.abs(t.x - spot.x) + Math.abs(t.y - spot.y);
  const perches = [...free]
    .filter((t) => t.x !== spot.x || t.y !== spot.y)
    .sort((a, b) => cfg.spacing === 'ranged' ? Math.abs(dist(a) - 4) - Math.abs(dist(b) - 4) : dist(a) - dist(b))
    .slice(0, cfg.ids.length);

  cfg.ids.forEach((id, i) => {
    const p = perches[i];
    const e = createEnemy(enemyDef(id), p.x, p.y, face(p.x, p.y, spot.x, spot.y, Dir.N), `${cfg.idPrefix}${i}`, world.run.depth);
    e.alert = 6;
    e.lastSeenX = spot.x;
    e.lastSeenY = spot.y;
    if (cfg.prime === 'windup') {
      e.ai = 'windup';
      e.timer = 0.12;
    }
    f.enemies.push(e);
  });

  // Face the nearest one. Landing in a scratch room looking at the back wall
  // is a debug tool wasting the first exchange you came to test.
  const nearest = [...perches].sort((a, b) => dist(a) - dist(b))[0];
  world.player.facing = face(spot.x, spot.y, nearest.x, nearest.y, turnAround(world.player.facing));
  Object.assign(world.anim, {
    fromX: spot.x,
    fromY: spot.y,
    moveT: 1,
    yaw: (world.player.facing * Math.PI) / 2,
    yawTo: (world.player.facing * Math.PI) / 2,
    turnT: 1,
  });
  return `${cfg.ids.length} ${cfg.label}, nearest ${dist(nearest)} tile${dist(nearest) === 1 ? '' : 's'}`;
}
