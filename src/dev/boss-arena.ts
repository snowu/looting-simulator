/**
 * Dev-only: stand in the throne room, kitted for it, without playing six floors.
 *
 * Reached with `?autostart=boss`. The whole module is behind an
 * `import.meta.env.DEV` guard at its one call site in `main.ts`, and that guard
 * is replaced with `false` at build time, so the dynamic import is dropped and
 * none of this reaches a production bundle.
 *
 * The gear is the depth-6 rung of the ladder the balance tables are read
 * against (`scripts/tables.ts`), restated here rather than imported, because
 * `scripts/` is test infrastructure and must not be pulled into the app.
 */
import { GameState } from '../state/game-state';
import { Equipment } from '../systems/player';
import { makeConsumable, makeEquipment } from '../systems/items';
import { addItem } from '../state/inventory';
import { syncLoadout } from '../systems/run';
import { AffixRoll, Rarity } from '../types';
import { World } from '../world/world';
import { FINAL_DEPTH } from '../data/biomes';
import { BOSS_ID } from '../data/enemies';
import { Room, blocksMove } from '../systems/dungeon';
import { dirOf } from '../core/dir';

const aff = (id: string, value: number): AffixRoll => ({ id, value });

/** What a player who got here honestly would plausibly be wearing. */
function throneKit(): Equipment {
  const e = {} as Equipment;
  for (const s of ['weapon', 'offhand', 'head', 'body', 'hands', 'ring1', 'ring2', 'amulet'] as const) e[s] = null;
  e.weapon = makeEquipment({ baseId: 'war_axe', materialId: 'moonsilver', rarity: Rarity.Epic, ilvl: 14, affixes: [aff('brutal', 12), aff('swiftness', 10)] });
  e.body = makeEquipment({ baseId: 'plate', materialId: 'moonsilver', rarity: Rarity.Rare, ilvl: 14, affixes: [aff('sturdy', 8)] });
  e.head = makeEquipment({ baseId: 'great_helm', materialId: 'moonsilver', rarity: Rarity.Rare, ilvl: 14 });
  e.offhand = makeEquipment({ baseId: 'tower_shield', materialId: 'moonsilver', rarity: Rarity.Rare, ilvl: 14 });
  e.hands = makeEquipment({ baseId: 'gauntlets', materialId: 'moonsilver', rarity: Rarity.Uncommon, ilvl: 14 });
  return e;
}

/** Kit the character out and fill the pack, before the run starts. */
export function prepare(state: GameState): void {
  state.equipment = throneKit();
  state.meta = { toughness: 5, endurance: 3, pack_mule: 3, lantern: 3, treasure_sense: 2 };
  state.flask = { shards: 3, potency: 4, infusion: null };
  state.gold = 5000;
  const pack = syncLoadout(state);
  addItem(pack, makeConsumable('scroll_recall', 1));
}

/**
 * Drop the run onto the bottom floor and put the player just inside the throne
 * room's door, facing the King. Returns the description for the log line.
 */
export function dropIntoThroneRoom(world: World): string {
  const run = world.run;
  while (run.depth < FINAL_DEPTH) world.changeFloorForTest('down');
  const f = world.floor;
  const room: Room | undefined = f.rooms.find((r) => r.role === 'throne');
  if (!room) return 'no throne room on this floor';
  const boss = f.enemies.find((e) => e.def === BOSS_ID);

  // The back of the room, so the whole fight is in front of you.
  for (let dy = room.h - 2; dy >= 1; dy--) {
    for (let dx = 1; dx < room.w - 1; dx++) {
      const x = room.x + dx, y = room.y + dy;
      if (blocksMove(f, x, y) || f.enemies.some((e) => e.ai !== 'dead' && e.x === x && e.y === y)) continue;
      world.player.x = x;
      world.player.y = y;
      // Turn to face him. Landing in the throne room looking at the back wall
      // is a debug tool wasting the first thing you wanted to look at.
      const facing = boss
        ? dirOf(Math.sign(boss.x - x), Math.sign(boss.y - y)) ?? dirOf(0, Math.sign(boss.y - y))
        : null;
      if (facing !== null) world.player.facing = facing;
      Object.assign(world.anim, {
        fromX: x,
        fromY: y,
        moveT: 1,
        yaw: (world.player.facing * Math.PI) / 2,
        yawTo: (world.player.facing * Math.PI) / 2,
        turnT: 1,
      });
      return boss ? `depth ${run.depth}, ${boss.hp} hp on the throne` : `depth ${run.depth}, no King`;
    }
  }
  return `depth ${run.depth}, nowhere free to stand`;
}
