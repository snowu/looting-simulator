import * as THREE from 'three';
import { EMBER_FLOOR_IDS, EMBER_CEILING_IDS } from '../art/ember-floor';
import { Dir, DIRS, DX, DY, turnRight } from '../core/dir';
import { biomeForFloor } from '../data/biomes';
import { Door, Floor, FLOOR, PILLAR, Secret, WALL, stairsAt, tileAt } from '../systems/dungeon';
import { artTexture } from './art-cache';
import { PS1Material, Shared, ps1Material } from './ps1';

export const TILE = 2;
export const WALL_H = 2.6;
export const DOOR_H = 2.1;
const STEP_DROP = 0.24;
const STEPS = 6;
const CRUST_PULSES: [number, number][] = [[0.55, 0.65], [0.3, 0.95], [0.7, 1.25], [0.9, 0.48]];

export const tileX = (x: number) => x * TILE + TILE / 2;
export const tileZ = (y: number) => y * TILE + TILE / 2;

type V3 = [number, number, number];

/** Accumulates quads per texture, then emits one merged geometry each. */
class Builder {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];
  idx: number[] = [];

  /**
   * Quad p0→p1 (u axis) and p0→p3 (v axis), subdivided so affine warping and
   * vertex lighting stay tolerable up close. Winding is fixed up to face `n`.
   */
  quad(p0: V3, p1: V3, p2: V3, p3: V3, n: V3, u0 = 0, v0 = 0, u1 = 1, v1 = 1, sub = 2): void {
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1];
    const cy = e1[2] * e2[0] - e1[0] * e2[2];
    const cz = e1[0] * e2[1] - e1[1] * e2[0];
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const base = this.pos.length / 3;
    for (let j = 0; j <= sub; j++) {
      const t = j / sub;
      for (let i = 0; i <= sub; i++) {
        const s = i / sub;
        // Bilinear over the four corners.
        for (let k = 0; k < 3; k++) {
          const a = p0[k] + (p1[k] - p0[k]) * s;
          const b = p3[k] + (p2[k] - p3[k]) * s;
          this.pos.push(a + (b - a) * t);
        }
        this.nrm.push(n[0], n[1], n[2]);
        this.uv.push(u0 + (u1 - u0) * s, v0 + (v1 - v0) * t);
      }
    }
    const row = sub + 1;
    for (let j = 0; j < sub; j++) {
      for (let i = 0; i < sub; i++) {
        const a = base + j * row + i, b = a + 1, c = a + row + 1, d = a + row;
        if (flip) this.idx.push(a, c, b, a, d, c);
        else this.idx.push(a, b, c, a, c, d);
      }
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
}

export interface DoorView {
  door: Door;
  pivot: THREE.Group;
  angle: number;
  material: PS1Material;
  lockedTex: THREE.Texture;
  openTex: THREE.Texture;
}

export interface SecretView {
  secret: Secret;
  mesh: THREE.Mesh;
}

export interface LevelView {
  root: THREE.Group;
  doors: DoorView[];
  secrets: SecretView[];
  update(dt: number): void;
  dispose(): void;
}

function hash3(x: number, y: number, d: number): number {
  return (((x * 73856093) ^ (y * 19349663) ^ (d * 83492791)) >>> 0) % 100;
}

export function buildLevel(floor: Floor, shared: Shared, ceilingTexture?: string): LevelView {
  const biome = biomeForFloor(floor);
  const ceiling = ceilingTexture ?? biome.ceiling;
  const builders = new Map<string, Builder>();
  const B = (tex: string) => {
    let b = builders.get(tex);
    if (!b) builders.set(tex, (b = new Builder()));
    return b;
  };
  const root = new THREE.Group();
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const secretAtTile = (x: number, y: number) => floor.secrets.find((s) => s.x === x && s.y === y && !s.found);
  const half = TILE / 2;

  const wallQuad = (tex: string, cx: number, cz: number, d: Dir, y0: number, y1: number, forward = half) => {
    // Wall on side d of the tile centred at (cx, cz), facing back into the tile.
    const fx = DX[d], fz = DY[d];
    const r = turnRight(d);
    const rx = DX[r], rz = DY[r];
    const wx = cx + fx * forward, wz = cz + fz * forward;
    B(tex).quad(
      [wx - rx * half, y0, wz - rz * half],
      [wx + rx * half, y0, wz + rz * half],
      [wx + rx * half, y1, wz + rz * half],
      [wx - rx * half, y1, wz - rz * half],
      [-fx, 0, -fz],
      0, 0, 1, (y1 - y0) / WALL_H,
    );
  };

  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const t = tileAt(floor, x, y);
      if (t === WALL) continue;
      const cx = tileX(x), cz = tileZ(y);
      const x0 = cx - half, x1 = cx + half, z0 = cz - half, z1 = cz + half;
      const stairs = stairsAt(floor, x, y);
      if (stairs) {
        buildStairs(B, biome, cx, cz, stairs.dir, stairs.down, ceiling);
        continue;
      }

      const floorTex = biome.floorVariants?.length ? biome.floorVariants[hash3(x, y, 4) % biome.floorVariants.length] : biome.floor;
      B(floorTex).quad([x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], [0, 1, 0]);
      const ceilingTex = ceiling === biome.ceiling && biome.ceilingVariants?.length
        ? biome.ceilingVariants[hash3(x, y, 6) % biome.ceilingVariants.length] : ceiling;
      B(ceilingTex).quad([x0, WALL_H, z0], [x1, WALL_H, z0], [x1, WALL_H, z1], [x0, WALL_H, z1], [0, -1, 0]);
      if (biome.id === 'catacombs') {
        B('water_catacombs').quad(
          [x0, 0.018, z0], [x1, 0.018, z0], [x1, 0.018, z1], [x0, 0.018, z1], [0, 1, 0],
        );
      }

      if (t === PILLAR) {
        const p = 0.42 * TILE;
        // Outward-facing column faces.
        const tex = biome.wallVariants?.length
          ? biome.wallVariants[hash3(x, y, 9) % biome.wallVariants.length]
          : hash3(x, y, 9) < 50 ? biome.wall : biome.wallAlt;
        for (const d of DIRS) {
          const fx = DX[d], fz = DY[d];
          const r = turnRight(d);
          const rx = DX[r], rz = DY[r];
          const wx = cx + fx * p, wz = cz + fz * p;
          B(tex).quad(
            [wx + rx * p, 0, wz + rz * p],
            [wx - rx * p, 0, wz - rz * p],
            [wx - rx * p, WALL_H, wz - rz * p],
            [wx + rx * p, WALL_H, wz + rz * p],
            [fx, 0, fz],
            0, 0, 0.84, 1,
          );
        }
        continue;
      }

      for (const d of DIRS) {
        const nx = x + DX[d], ny = y + DY[d];
        if (tileAt(floor, nx, ny) !== WALL || secretAtTile(nx, ny)) continue;
        const tex = biome.wallVariants?.length
          ? biome.wallVariants[hash3(nx, ny, d) % biome.wallVariants.length]
          : hash3(nx, ny, d) < 12 ? biome.wallAlt : biome.wall;
        wallQuad(tex, cx, cz, d, 0, WALL_H);
      }
    }
  }

  for (const [tex, b] of builders) {
    if (!b.idx.length) continue;
    const geo = b.build();
    const water = tex === 'water_catacombs';
    const roof = EMBER_CEILING_IDS.indexOf(tex);
    const crust = EMBER_FLOOR_IDS.indexOf(tex);
    const heat: [number, number] = crust >= 0 ? CRUST_PULSES[crust]
      : roof >= 0 ? [0.35 + roof * 0.12, 0.5 + roof * 0.27] : [0.35, 3.8];
    const mat = ps1Material(shared, artTexture(tex), water
      ? { transparent: true, depthWrite: false, side: THREE.DoubleSide }
      : { fillLight: crust >= 0 || roof >= 0 ? [0.48, 0.32, 0.26] : undefined, pulse: biome.id === 'emberworks' ? heat : biome.id === 'frostvault' && tex !== ceiling ? [0.15, 1.1] : undefined });
    if (water) mat.uniforms.uOpacity.value = 0.16;
    geometries.push(geo);
    materials.push(mat);
    root.add(new THREE.Mesh(geo, mat));
  }

  // --- Doors -----------------------------------------------------------------
  const doors: DoorView[] = [];
  const doorGeo = new THREE.BoxGeometry(TILE - 0.08, DOOR_H, 0.14);
  doorGeo.translate((TILE - 0.08) / 2, DOOR_H / 2, 0);
  geometries.push(doorGeo);
  const lintelGeo = new THREE.BoxGeometry(TILE, WALL_H - DOOR_H, 0.5);
  lintelGeo.translate(0, DOOR_H + (WALL_H - DOOR_H) / 2, 0);
  geometries.push(lintelGeo);
  const lintelMat = ps1Material(shared, artTexture(biome.wall));
  materials.push(lintelMat);
  for (const door of floor.doors) {
    const cx = tileX(door.x), cz = tileZ(door.y);
    const frame = new THREE.Group();
    frame.position.set(cx, 0, cz);
    // Door leaf spans x when the passage runs north–south.
    if (!door.ns) frame.rotation.y = Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.position.set(-(TILE - 0.08) / 2, 0, 0);
    const openTex = artTexture(door.iron ? 'door_iron' : biome.door);
    const lockedTex = artTexture('door_locked');
    const mat = ps1Material(shared, door.locked ? lockedTex : openTex);
    materials.push(mat);
    pivot.add(new THREE.Mesh(doorGeo, mat));
    frame.add(pivot);
    frame.add(new THREE.Mesh(lintelGeo, lintelMat));
    root.add(frame);
    const angle = door.open ? -1.75 : 0;
    pivot.rotation.y = angle;
    doors.push({ door, pivot, angle, material: mat, lockedTex, openTex });
  }

  // --- Secret walls ------------------------------------------------------------
  const secrets: SecretView[] = [];
  const secretGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE);
  secretGeo.translate(0, WALL_H / 2, 0);
  geometries.push(secretGeo);
  const secretMat = ps1Material(shared, artTexture(biome.wallSecret));
  materials.push(secretMat);
  for (const secret of floor.secrets) {
    if (secret.found) continue;
    const mesh = new THREE.Mesh(secretGeo, secretMat);
    mesh.position.set(tileX(secret.x), 0, tileZ(secret.y));
    root.add(mesh);
    secrets.push({ secret, mesh });
  }

  return {
    root,
    doors,
    secrets,
    update(dt: number) {
      for (const dv of doors) {
        const target = dv.door.open ? -1.75 : 0;
        dv.angle += Math.sign(target - dv.angle) * Math.min(Math.abs(target - dv.angle), dt * 4.5);
        dv.pivot.rotation.y = dv.angle;
        const tex = dv.door.locked ? dv.lockedTex : dv.openTex;
        if (dv.material.uniforms.map.value !== tex) dv.material.uniforms.map.value = tex;
      }
      for (const sv of secrets) {
        if (!sv.secret.found || !sv.mesh.visible) continue;
        sv.mesh.position.y -= dt * 1.6;
        if (sv.mesh.position.y < -WALL_H) sv.mesh.visible = false;
      }
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

function buildStairs(
  B: (tex: string) => Builder,
  biome: ReturnType<typeof biomeForFloor>,
  cx: number,
  cz: number,
  d: Dir,
  down: boolean,
  ceiling: string,
): void {
  const fx = DX[d], fz = DY[d];
  const r = turnRight(d);
  const rx = DX[r], rz = DY[r];
  const half = TILE / 2;
  const s = TILE / STEPS;
  const sign = down ? -1 : 1;
  // Local → world: `fw` from the entry edge, `lat` across, `y` up.
  const P = (fw: number, lat: number, y: number): V3 => [cx + fx * (fw - half) + rx * lat, y, cz + fz * (fw - half) + rz * lat];
  const total = STEPS * STEP_DROP;
  const lowY = down ? -total - 0.4 : 0;
  const highY = down ? WALL_H : WALL_H + total;

  let prev = 0;
  for (let i = 0; i < STEPS; i++) {
    const h = sign * (i + 1) * STEP_DROP;
    const a = i * s, b = (i + 1) * s;
    // Riser, facing back toward the room.
    const yLo = Math.min(prev, h), yHi = Math.max(prev, h);
    B(biome.wall).quad(P(a, -half, yLo), P(a, half, yLo), P(a, half, yHi), P(a, -half, yHi), [-fx, 0, -fz], 0, 0, 1, 0.12);
    // Tread.
    B(biome.floor).quad(P(a, -half, h), P(a, half, h), P(b, half, h), P(b, -half, h), [0, 1, 0], 0, a / TILE, 1, b / TILE);
    prev = h;
  }
  // Side walls and the far wall.
  for (const side of [-1, 1]) {
    const lat = side * half;
    B(biome.wall).quad(P(0, lat, lowY), P(TILE, lat, lowY), P(TILE, lat, highY), P(0, lat, highY), [-rx * side, 0, -rz * side], 0, 0, 1, (highY - lowY) / WALL_H);
  }
  B(biome.wall).quad(P(TILE, -half, lowY), P(TILE, half, lowY), P(TILE, half, highY), P(TILE, -half, highY), [-fx, 0, -fz], 0, 0, 1, (highY - lowY) / WALL_H);
  // Ceiling (raised for stairs up, with a lintel closing the gap).
  B(ceiling).quad(P(0, -half, highY), P(TILE, -half, highY), P(TILE, half, highY), P(0, half, highY), [0, -1, 0]);
  if (!down) B(biome.wall).quad(P(0, -half, WALL_H), P(0, half, WALL_H), P(0, half, highY), P(0, -half, highY), [-fx, 0, -fz], 0, 0, 1, total / WALL_H);
}

export { FLOOR };
