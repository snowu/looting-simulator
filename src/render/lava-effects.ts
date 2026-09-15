import * as THREE from 'three';
import { EMBER_VENTS, emberFloorIndex, EMBER_CEILING_VENTS, emberCeilingIndex } from '../art/ember-floor';
import { createRng, hashString } from '../core/rng';
import { Floor, FLOOR, tileAt } from '../systems/dungeon';
import { Shared, ps1Material } from './ps1';
import { TILE, WALL_H } from './level-mesh';

interface Site { x: number; z: number; phase: number }
interface Drop {
  body: THREE.Mesh; neck: THREE.Mesh; core: THREE.Mesh;
  age: number; hold: number; x: number; z: number; size: number; active: boolean;
}
interface Spark { mesh: THREE.Mesh; age: number; life: number; vx: number; vy: number; vz: number; size: number }

/** Decorative only: owns a separate RNG and no World reference or gameplay callbacks. */
export class LavaEffects {
  readonly root = new THREE.Group();
  private rng = createRng(0);
  private sites: Site[] = [];
  private ceilingSites: Site[] = [];
  private near: Site[] = [];
  private clock = 0;
  private forward = new THREE.Vector3();
  private nextDrop = 0.5;
  private nextBurst = 3;
  private geo = new THREE.IcosahedronGeometry(1, 1);
  private neckGeo = new THREE.CylinderGeometry(1, 1, 1, 5);
  private textures: THREE.DataTexture[] = [];
  private materials: ReturnType<typeof ps1Material>[] = [];
  private drops: Drop[] = [];
  private sparks: Spark[] = [];
  private bubble: THREE.Mesh;
  private burstSite: Site | null = null;
  private burstAge = 0;

  constructor(shared: Shared) {
    for (const rgb of [[222, 65, 12], [255, 168, 46], [133, 39, 12]]) {
      const tex = new THREE.DataTexture(new Uint8Array([...rgb, 250]), 1, 1);
      tex.needsUpdate = true;
      this.textures.push(tex);
      this.materials.push(ps1Material(shared, tex));
    }
    const mesh = (geometry: THREE.BufferGeometry, color: number) => {
      const m = new THREE.Mesh(geometry, this.materials[color]);
      m.visible = false; this.root.add(m); return m;
    };
    for (let i = 0; i < 5; i++) this.drops.push({ body: mesh(this.geo, 0), core: mesh(this.geo, 1), neck: mesh(this.neckGeo, 2), age: 0, hold: 0, x: 0, z: 0, size: 0, active: false });
    for (let i = 0; i < 28; i++) this.sparks.push({ mesh: mesh(this.geo, i % 3 === 0 ? 1 : 0), age: 0, life: 0, vx: 0, vy: 0, vz: 0, size: 0 });
    this.bubble = mesh(this.geo, 0);
  }

  reset(floor: Floor): void {
    this.sites = []; this.ceilingSites = []; this.near = []; this.clock = 0;
    this.nextDrop = 0.5; this.nextBurst = 3; this.burstSite = null;
    this.bubble.visible = false;
    for (const d of this.drops) { d.active = false; d.body.visible = d.neck.visible = d.core.visible = false; }
    for (const s of this.sparks) { s.life = 0; s.mesh.visible = false; }
    if (floor.biome !== 'emberworks') return;
    this.rng = createRng(hashString(`lava-decor:${floor.seed}:${floor.depth}`));
    for (let y = 0; y < floor.height; y++) for (let x = 0; x < floor.width; x++) {
      if (tileAt(floor, x, y) !== FLOOR || floor.stairs.some(s => s.x === x && s.y === y)
        || floor.doors.some(d => d.x === x && d.y === y)
        || floor.props.some(p => p.x === x && p.y === y && p.blocking)) continue;
      const overhead = this.rng.pick(EMBER_CEILING_VENTS[emberCeilingIndex(x, y)]);
      this.ceilingSites.push({ x: (x + overhead.u) * TILE, z: (y + overhead.v) * TILE, phase: 0 });
      const vents = EMBER_VENTS[emberFloorIndex(x, y)];
      if (!vents.length) continue;
      const vent = this.rng.pick(vents);
      this.sites.push({ x: (x + vent.u) * TILE, z: (y + vent.v) * TILE, phase: this.rng.float(0, Math.PI * 2) });
    }
  }

  private spray(x: number, z: number, count: number, strength: number): void {
    for (const s of this.sparks.filter(s => s.life <= 0).slice(0, count)) {
      const angle = this.rng.float(0, Math.PI * 2), speed = this.rng.float(0.2, 0.65) * strength;
      s.vx = Math.cos(angle) * speed; s.vz = Math.sin(angle) * speed;
      s.vy = this.rng.float(1.2, 2.1) * strength;
      s.age = 0; s.life = 1.8; s.size = this.rng.float(0.035, 0.075);
      s.mesh.position.set(x, 0.07, z); s.mesh.visible = true;
    }
  }

  update(dt: number, camera: THREE.Camera): void {
    // Pause freezes the simulation; tab-resume deltas cannot launch a backlog.
    const step = Math.min(Math.max(dt, 0), 0.05);
    this.clock += step;
    this.near = this.sites.filter(s => Math.hypot(s.x - camera.position.x, s.z - camera.position.z) < 9)
      .sort((a, b) => (a.x-camera.position.x)**2+(a.z-camera.position.z)**2 - (b.x-camera.position.x)**2-(b.z-camera.position.z)**2);
    if (step === 0) return;
    this.nextDrop -= step; this.nextBurst -= step;
    camera.getWorldDirection(this.forward);
    const inView = (s: Site) => {
      const dx = s.x - camera.position.x, dz = s.z - camera.position.z;
      const distance = Math.hypot(dx, dz);
      return distance > 1.7 && distance < 9 && (dx * this.forward.x + dz * this.forward.z) / distance > 0.45;
    };
    const candidates = this.near.filter(inView);
    const ceilingCandidates = this.ceilingSites.filter(inView);
    if (this.nextDrop <= 0 && ceilingCandidates.length) {
      this.nextDrop = this.rng.float(2.0, 3.7);
      const d = this.drops.find(d => !d.active);
      if (d) {
        const s = this.rng.pick(ceilingCandidates);
        Object.assign(d, { x: s.x, z: s.z, age: 0, hold: this.rng.float(2.8, 4.3), size: this.rng.float(0.10, 0.15), active: true });
      }
    }
    for (const d of this.drops) {
      if (!d.active) continue;
      d.age += step;
      const t = Math.min(1, d.age / d.hold), falling = Math.max(0, d.age - d.hold);
      // A swelling bulb hangs from a thinning thread, repeatedly sagging and
      // springing back before it finally lets go. Much slower than water.
      const wobble = Math.sin(t * Math.PI * 6) * 0.045 * t;
      const stretch = 0.07 + 0.33 * t * t + wobble;
      const radius = d.size * (0.25 + 0.75 * t);
      const y = WALL_H - stretch - radius - falling * 0.3 - 1.65 * falling * falling;
      if (y <= radius * 0.4) {
        this.spray(d.x, d.z, 4, 0.6);
        d.active = false; d.body.visible = d.neck.visible = d.core.visible = false;
        continue;
      }
      const squash = falling > 0 ? 1 + Math.sin(falling * 15) * 0.14 : 1 + wobble * 4;
      d.body.visible = d.core.visible = true;
      d.body.position.set(d.x, y, d.z);
      d.body.scale.set(radius / squash, radius * squash, radius / squash);
      d.core.position.copy(d.body.position).lerp(camera.position, radius * 0.85 / Math.max(0.1, camera.position.distanceTo(d.body.position)));
      d.core.scale.set(radius * 0.32, radius * 0.42 * squash, radius * 0.32);
      d.neck.visible = falling === 0;
      d.neck.position.set(d.x, (WALL_H + y) / 2, d.z);
      d.neck.scale.set(radius * (0.65 - 0.57 * t), WALL_H - y, radius * (0.65 - 0.57 * t));
    }
    if (this.nextBurst <= 0 && !this.burstSite && candidates.length) {
      this.burstSite = this.rng.pick(candidates); this.burstAge = 0;
      this.nextBurst = this.rng.float(6, 10);
    }
    if (this.burstSite) {
      this.burstAge += step;
      const t = this.burstAge / 1.25;
      this.bubble.visible = true;
      this.bubble.position.set(this.burstSite.x, 0.015, this.burstSite.z);
      this.bubble.scale.set(0.13 + t * 0.12, 0.02 + t * 0.16 + Math.sin(t * 18) * 0.012, 0.13 + t * 0.12);
      if (t >= 1) {
        this.spray(this.burstSite.x, this.burstSite.z, 9, 1.15);
        this.burstSite = null; this.bubble.visible = false;
      }
    }
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.age += step; s.vy -= 4.2 * step;
      s.mesh.position.x += s.vx * step; s.mesh.position.y += s.vy * step; s.mesh.position.z += s.vz * step;
      if (s.mesh.position.y <= 0.025 || s.age >= s.life) { s.life = 0; s.mesh.visible = false; continue; }
      s.mesh.scale.setScalar(s.size * (1 - s.age / s.life * 0.6));
    }
  }

  /** A few low lights make the undersides read as hot without filling the light budget. */
  lights(): { x: number; y: number; z: number; r: number; color: THREE.Color; intensity: number }[] {
    return this.near.slice(0, 2).map(s => ({ x: s.x, y: 0.12, z: s.z, r: 2.4, color: this.glow,
      intensity: 0.35 + 0.2 * Math.sin(this.clock * 0.85 + s.phase) }));
  }
  private glow = new THREE.Color('#ff6418');

  dispose(): void {
    this.root.removeFromParent(); this.geo.dispose(); this.neckGeo.dispose();
    this.textures.forEach(t => t.dispose()); this.materials.forEach(m => m.dispose());
  }
}
