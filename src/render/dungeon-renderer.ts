import * as THREE from 'three';
import { LavaEffects, LavaSound } from './lava-effects';
import { DX, DY, turnRight } from '../core/dir';
import { biomeForFloor, ceilingForFloor } from '../data/biomes';
import { enemyDef, enemyView } from '../data/enemies';
import { ELITES } from '../data/elites';
import { DROP_SECONDS } from '../data/ambush';
import { RAISE_CHANNEL } from '../data/necromancy';
import { OSSUARY_STIR } from '../data/laws';

/** The sickly green of a Gravecaller's chant, on the corpse it is calling. */
const RAISE_GLOW = '#8ce07a';
import { findMaterial } from '../data/materials';
import { findSigil } from '../data/spells';
import { itemBase, viewmodelFor } from '../data/items';
import { EnemyState, Floor, ShrineKind } from '../systems/dungeon';
import type { EnemyDef } from '../types';
import { itemIcon } from '../systems/items';
import { lightIntensity } from '../systems/meta';
import { World } from '../world/world';
import { artSize, artTexture } from './art-cache';
import { enemyPose } from './enemy-pose';
import { LevelView, TILE, WALL_H, buildLevel, tileX, tileZ } from './level-mesh';
import { MAX_LIGHTS, PS1Material, PostPass, Shared, createLowResTarget, createShared, ps1Material } from './ps1';
import { brightness } from './brightness';
import { MORSEL_ART, MORSEL_ROT_SECONDS } from '../systems/healing';

const EYE = 1.32;

/** Shrine glow by flavour — the same hues as their flames. */
const SHRINE_LIGHT: Record<ShrineKind, string> = {
  font: '#58c8ff',
  idol: '#b070ff',
  coffer: '#ffc45a',
  blood: '#ff4a5a',
  combat: '#ff7a30',
};
const LOW_H = 240;

interface SpriteObj {
  mesh: THREE.Mesh;
  mat: PS1Material;
  seen: boolean;
}

interface LightCand {
  x: number;
  y: number;
  z: number;
  r: number;
  color: THREE.Color;
  intensity: number;
}

const TMP = new THREE.Vector3();

/**
 * Renders the World into a low-res target with PS1 shading, then upscales
 * through the dither/quantise post pass.
 */
export class DungeonRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(64, 4 / 3, 0.05, 60);
  private scene = new THREE.Scene();
  private shared: Shared = createShared();
  private lava = new LavaEffects(this.shared);
  private target: THREE.WebGLRenderTarget;
  private post = new PostPass();
  private level: LevelView | null = null;
  private levelFloor: Floor | null = null;
  private sprites = new Map<string, SpriteObj>();
  private quad = new THREE.PlaneGeometry(1, 1);

  // Viewmodel (drawn in low-res pixel space).
  private vmScene = new THREE.Scene();
  private vmCamera = new THREE.OrthographicCamera(0, 320, 240, 0, -10, 10);
  private vmShared: Shared = createShared();
  private vmWeapon: SpriteObj;
  private vmShield: SpriteObj;
  private vmKey = '';

  private shake = 0;
  private flash = new THREE.Vector4();
  private time = 0;
  /** Corpses being chanted over this frame, with how far along the chant is (0..1). */
  private called = new Map<string, number>();
  private trapTriggeredAt = new Map<string, number>();
  private lowW = 320;
  deathFade = 0;

  // Falling water drops for the Sunken Catacombs: a small pool of billboarded
  // streaks. main.ts spawns them next to the drip plinks; anything spawned
  // inside wall geometry stays hidden behind it, so no layout check is needed.
  // The plink sounds on landing through this callback, so a watched drop is
  // heard when it hits — not while it is still falling.
  onLavaSound: ((event: LavaSound) => void) | null = null;
  onDripLand: (() => void) | null = null;
  private drips: { mesh: THREE.Mesh; vel: number; active: boolean }[] = [];
  private dripGeo = new THREE.PlaneGeometry(0.035, 1);
  private dripMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#9fd8e8'),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.target = createLowResTarget(320, LOW_H);
    this.vmShared.uFogFar.value = 1e6;
    this.vmShared.uFogNear.value = 1e6;
    this.vmShared.uAffine.value = 0;
    this.vmWeapon = this.makeSprite(this.vmShared, this.vmScene);
    this.vmShield = this.makeSprite(this.vmShared, this.vmScene);
    this.scene.add(this.lava.root);
    this.lava.onSound = event => this.onLavaSound?.(event);
    this.resize();
  }

  resize(): void {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.lowW = Math.max(160, Math.round((LOW_H * w) / h));
    this.target.setSize(this.lowW, LOW_H);
    this.shared.uSnap.value.set(this.lowW, LOW_H);
    this.vmShared.uSnap.value.set(this.lowW, LOW_H);
    this.vmCamera.right = this.lowW;
    this.vmCamera.top = LOW_H;
    this.vmCamera.updateProjectionMatrix();
  }

  private makeSprite(shared: Shared, scene: THREE.Scene): SpriteObj {
    const mat = ps1Material(shared, artTexture('pickup_bag'), { unlit: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this.quad, mat);
    scene.add(mesh);
    return { mesh, mat, seen: true };
  }

  private sprite(key: string): SpriteObj {
    let s = this.sprites.get(key);
    if (!s) {
      s = this.makeSprite(this.shared, this.scene);
      this.sprites.set(key, s);
    }
    s.seen = true;
    s.mesh.visible = true;
    return s;
  }

  private place(s: SpriteObj, art: string, x: number, y: number, z: number, height: number, ramp?: readonly [string, string, string, string]): void {
    const tex = artTexture(art, ramp);
    if (s.mat.uniforms.map.value !== tex) s.mat.uniforms.map.value = tex;
    const { w, h } = artSize(art);
    s.mesh.scale.set((height * w) / h, height, 1);
    s.mesh.position.set(x, y + height / 2, z);
    s.mesh.rotation.set(0, this.camera.rotation.y, 0);
    s.mat.uniforms.uTint.value.set(0, 0, 0, 0);
  }

  /** Lay a sprite flat on the floor as a decal, one tile wide. */
  /**
   * A hidden monster. Buried: its mound, sliding between tiles as it travels
   * and heaving as it rises. On the ceiling: nothing until you have spotted it,
   * then a dark shape high in the gloom; once it lets go, the fall.
   */
  private drawLurker(en: EnemyState, def: EnemyDef): void {
    const t = en.moveT < 1 ? en.moveT : 1;
    const wx = tileX(en.fromX + (en.x - en.fromX) * t), wz = tileZ(en.fromY + (en.y - en.fromY) * t);
    if (en.lurk === 'buried') {
      const s = this.sprite(`m:${en.id}`);
      const rising = en.lurkT !== undefined && !en.tunnelling;
      const heave = rising ? 1.1 + 0.12 * Math.sin(this.time * 40) : 0.9 + 0.05 * Math.sin(this.time * 6 + en.x);
      this.placeFlat(s, 'mound', wx, wz, heave);
      return;
    }
    if (!en.spotted && en.lurkT === undefined) return;
    const s = this.sprite(`e:${en.id}`);
    const height = def.scale * 1.9;
    const fall = en.lurkT === undefined ? 0 : 1 - Math.max(0, en.lurkT) / DROP_SECONDS;
    const top = WALL_H - height * 0.95;
    this.place(s, `${def.sprite}_0`, wx, top * (1 - fall * fall), wz, height);
    s.mat.uniforms.uTint.value.set(0, 0, 0, 0.5 * (1 - fall));
  }

  private placeFlat(s: SpriteObj, art: string, x: number, z: number, size = 1): void {
    const tex = artTexture(art);
    if (s.mat.uniforms.map.value !== tex) s.mat.uniforms.map.value = tex;
    s.mesh.scale.set(size, size, 1);
    // A hair above the floor so it doesn't z-fight with the tile.
    s.mesh.position.set(x, 0.012, z);
    s.mesh.rotation.set(-Math.PI / 2, 0, 0);
    s.mat.uniforms.uTint.value.set(0, 0, 0, 0);
  }

  onHurt(amount: number, blocked: boolean): void {
    if (blocked) this.flash.set(0.7, 0.75, 0.9, 0.25);
    else this.flash.set(0.8, 0.05, 0.02, Math.min(0.55, 0.2 + amount / 40));
  }

  onShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  /** A sigil landing: a wash of its own colour, so the moment has a colour. */
  onSigil(r: number, g: number, b: number, strength: number): void {
    this.flash.set(r, g, b, strength);
  }

  /** Let a sprung mechanism kick once, then leave its spent decal in place. */
  onTrap(id: string): void {
    this.trapTriggeredAt.set(id, this.time);
  }

  /** Drop one bead of water from the ceiling ahead of the camera. */
  spawnDrip(): void {
    let d = this.drips.find((d) => !d.active);
    if (!d) {
      if (this.drips.length >= 10) return;
      const mesh = new THREE.Mesh(this.dripGeo, this.dripMat);
      mesh.visible = false;
      this.scene.add(mesh);
      d = { mesh, vel: 0, active: false };
      this.drips.push(d);
    }
    const rotY = this.camera.rotation.y;
    const fx = -Math.sin(rotY), fz = -Math.cos(rotY);
    // A few paces ahead with a sideways scatter, so drops land across the view.
    const dist = 2 + Math.random() * 4;
    const side = (Math.random() - 0.5) * 2.4;
    d.mesh.position.set(
      this.camera.position.x + fx * dist - fz * side,
      WALL_H - 0.15,
      this.camera.position.z + fz * dist + fx * side,
    );
    d.vel = 0.4 + Math.random() * 0.4;
    d.active = true;
    d.mesh.visible = true;
    d.mesh.scale.y = 0.09;
  }

  private updateDrips(dt: number): void {
    if (dt <= 0) return;
    for (const d of this.drips) {
      if (!d.active) continue;
      d.vel += 9.8 * dt;
      const y = d.mesh.position.y - d.vel * dt;
      if (y <= 0.04) {
        d.active = false;
        d.mesh.visible = false;
        this.onDripLand?.();
        continue;
      }
      d.mesh.position.y = y;
      // A short bead that stretches only slightly as it picks up speed.
      d.mesh.scale.y = 0.08 + d.vel * 0.012;
      d.mesh.rotation.y = this.camera.rotation.y;
    }
  }

  /** World (tile coords + height) → canvas pixels, or null when behind the camera. */
  project(tx: number, ty: number, height: number): { x: number; y: number } | null {
    TMP.set(tileX(tx), height, tileZ(ty)).project(this.camera);
    if (TMP.z > 1) return null;
    return { x: ((TMP.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - TMP.y) / 2) * this.canvas.clientHeight };
  }

  render(world: World, dt: number): void {
    this.time += dt;
    this.shared.uTime.value = this.time;
    const floor = world.floor;
    const biome = biomeForFloor(floor);
    if (this.levelFloor !== floor) {
      if (this.level) {
        this.scene.remove(this.level.root);
        this.level.dispose();
      }
      const previous = world.run.floors[world.run.depth - 2];
      this.level = buildLevel(floor, this.shared, ceilingForFloor(floor, previous ?? undefined));
      this.levelFloor = floor;
      this.lava.reset(floor);
      this.trapTriggeredAt.clear();
      for (const d of this.drips) {
        d.active = false;
        d.mesh.visible = false;
      }
      this.scene.add(this.level.root);
      this.shared.uFogColor.value.set(biome.fog);
      this.shared.uAmbient.value.set(biome.ambient);
      this.shared.uFogNear.value = 4;
      this.shared.uFogFar.value = 18;
    }
    this.shared.uAmbient.value.set(biome.ambient);
    if (biome.id === 'emberworks') {
      this.shared.uAmbient.value.multiplyScalar(1 + 0.08 * Math.sin(this.time * Math.PI * 0.8 + 1.7));
    }
    this.level!.update(dt);

    // --- Camera ---------------------------------------------------------------
    const a = world.anim;
    const p = world.player;
    const e = a.moveT < 1 ? 1 - Math.pow(1 - a.moveT, 2) : 1;
    const cx = tileX(a.fromX + (p.x - a.fromX) * e);
    const cz = tileZ(a.fromY + (p.y - a.fromY) * e);
    const bob = a.moveT < 1 ? Math.sin(a.moveT * Math.PI) * 0.05 : 0;
    let lunge = 0;
    if (a.attack === 'windup') lunge = -0.06 * (a.attackT / Math.max(0.01, a.attackDur));
    else if (a.attack === 'recover') lunge = 0.12 * Math.max(0, 1 - a.attackT / 0.15);
    const fwdX = Math.sin(a.yaw), fwdZ = -Math.cos(a.yaw);
    this.shake = Math.max(0, this.shake - dt * 3);
    const sh = this.shake * 0.08;
    this.camera.position.set(
      cx + fwdX * lunge + (Math.random() - 0.5) * sh,
      EYE + bob + (Math.random() - 0.5) * sh - this.deathFade * 0.9,
      cz + fwdZ * lunge + (Math.random() - 0.5) * sh,
    );
    this.camera.rotation.set(0, -a.yaw, this.deathFade * 0.5);

    this.lava.update(biome.id === 'emberworks' ? dt : 0, this.camera);

    // --- Lights ---------------------------------------------------------------
    const flick = (seed: number) => 0.9 + Math.sin(this.time * 11 + seed) * 0.06 + Math.sin(this.time * 23.7 + seed * 3) * 0.04;
    const lights: LightCand[] = [];
    const torchColor = new THREE.Color(biome.torch);
    // The player's own light is whiter than the wall torches so colours read true up close.
    const handLight = new THREE.Color('#ffe6cc');
    const meta = world.state.meta;
    lights.push({
      x: this.camera.position.x, y: EYE + 0.2, z: this.camera.position.z,
      // A lamp you are carrying counts on top of the one the Warden sold you.
      r: world.playerLightRadius,
      color: handLight,
      intensity: lightIntensity(meta) * flick(0),
    });
    lights.push(...this.lava.lights());
    for (const t of floor.torches) {
      const wx = tileX(t.x) + DX[t.side] * (TILE / 2 - 0.3);
      const wz = tileZ(t.y) + DY[t.side] * (TILE / 2 - 0.3);
      lights.push({ x: wx, y: 1.9, z: wz, r: 7, color: torchColor, intensity: 1.0 * flick(t.x * 7 + t.y) });
    }
    for (const pr of floor.props) {
      if (pr.kind === 'fungus') lights.push({ x: tileX(pr.x), y: 0.4, z: tileZ(pr.y), r: 3, color: new THREE.Color('#40e0c0'), intensity: 0.7 });
      if (pr.kind === 'portal') lights.push({ x: tileX(pr.x), y: 1.2, z: tileZ(pr.y), r: 7, color: new THREE.Color('#b070ff'), intensity: 1.3 * flick(5) });
      if (pr.kind === 'town_portal') lights.push({ x: tileX(pr.x), y: 1.2, z: tileZ(pr.y), r: 6, color: new THREE.Color('#70b0ff'), intensity: 1.1 * flick(4) });
      // The colour it throws is the tell you can read from across a room.
      if (pr.kind === 'shrine' && !pr.used) {
        lights.push({ x: tileX(pr.x), y: 1.3, z: tileZ(pr.y), r: 4.5, color: new THREE.Color(SHRINE_LIGHT[pr.shrine ?? 'font']), intensity: 0.95 });
      }
    }
    for (const tr of floor.traps ?? []) {
      // Only the ward glows, because a ward is magic. A dart plate and a spike
      // pit are ironmongery in a dark floor: your lamp has to find them.
      if (tr.kind !== 'alarm' || !tr.found || !tr.armed) continue;
      lights.push({ x: tileX(tr.x), y: 0.2, z: tileZ(tr.y), r: 2.5, color: new THREE.Color('#a070ff'), intensity: 0.5 * flick(7) });
    }
    // Corpses a Gravecaller is chanting over: they rise into view and glow.
    const called = new Map<string, number>();
    for (const en of floor.enemies) if (en.channel) called.set(en.channel.target, 1 - en.channel.t / RAISE_CHANNEL);
    // Ossuary: restless remains rise into view the same way, on their own.
    for (const en of floor.enemies) if (en.stirT !== undefined) called.set(en.id, 1 - Math.max(0, en.stirT) / OSSUARY_STIR);
    this.called = called;
    for (const en of floor.enemies) {
      const def = enemyDef(en.def);
      const view = enemyView(def, en.hp, en.maxHp, { elite: en.elite, carrying: !!en.stolen?.length });
      const call = called.get(en.id);
      if (call !== undefined) lights.push({ x: tileX(en.x), y: 0.5, z: tileZ(en.y), r: 3 + 2 * call, color: new THREE.Color(RAISE_GLOW), intensity: 0.6 + 0.8 * call });
      // A lurker throws no light: an elite glowing on the ceiling would be no ambush.
      if (view.glow && en.ai !== 'dead' && !en.lurk) lights.push({ x: tileX(en.x), y: 1.2, z: tileZ(en.y), r: 4.5, color: new THREE.Color(view.glow), intensity: 0.9 });
      // A Vengeful corpse's fuse: a swelling violet light over the body.
      if (en.burstT !== undefined) lights.push({ x: tileX(en.x), y: 0.6, z: tileZ(en.y), r: 3.5, color: new THREE.Color(ELITES.vengeful.color), intensity: 0.8 + 0.8 * Math.abs(Math.sin(this.time * 14)) });
    }
    for (const pr of world.projectiles) {
      if (pr.light) lights.push({ x: pr.x * TILE, y: 1.3, z: pr.y * TILE, r: 3.5, color: new THREE.Color(pr.light), intensity: 1.1 });
    }
    const camX = this.camera.position.x, camZ = this.camera.position.z;
    const [first, ...rest] = lights;
    rest.sort((l1, l2) => (l1.x - camX) ** 2 + (l1.z - camZ) ** 2 - ((l2.x - camX) ** 2 + (l2.z - camZ) ** 2));
    const chosen = [first, ...rest].slice(0, MAX_LIGHTS);
    chosen.forEach((l, i) => {
      this.shared.uLightPos.value[i].set(l.x, l.y, l.z, l.r);
      this.shared.uLightColor.value[i].set(l.color.r * l.intensity, l.color.g * l.intensity, l.color.b * l.intensity);
    });
    this.shared.uLightCount.value = chosen.length;

    // --- Sprites ---------------------------------------------------------------
    for (const s of this.sprites.values()) s.seen = false;
    const near = (x: number, y: number) => Math.abs(x - p.x) + Math.abs(y - p.y) <= 14;

    for (const en of floor.enemies) {
      if (!near(en.x, en.y)) continue;
      // The phase view, so the King's sprite family, glow and guard all follow
      // the fight. Everything else gets its own stat block back unchanged.
      const def = enemyView(enemyDef(en.def), en.hp, en.maxHp, { elite: en.elite, carrying: !!en.stolen?.length });
      if (en.lurk && en.ai !== 'dead') {
        this.drawLurker(en, def);
        continue;
      }
      // A Vengeful corpse stays up, pulsing, until it goes off.
      const fused = en.burstT !== undefined;
      const call = this.called.get(en.id);
      if (en.ai === 'dead' && en.deadT > 0.9 && !fused && call === undefined) continue;
      const s = this.sprite(`e:${en.id}`);
      const t = en.moveT < 1 ? en.moveT : 1;
      const ex = en.fromX + (en.x - en.fromX) * t;
      const ey = en.fromY + (en.y - en.fromY) * t;
      let wx = tileX(ex), wz = tileZ(ey);
      // Which frame, and how far the body is thrown: one shared model, so the
      // dev art sheet previews exactly what the dungeon draws.
      const pose = enemyPose({
        ai: en.ai,
        timer: en.timer,
        sinceStrike: en.strikeT ?? Infinity,
        guard: en.guard,
        hasShield: !!def.shield,
        ranged: def.behavior === 'ranged',
        windup: def.windup,
        recovery: def.recovery,
        grabT: en.grabT,
      });
      wx += DX[en.facing] * pose.lunge;
      wz += DY[en.facing] * pose.lunge;
      const height = def.scale * 1.9 * (en.scavenged ? 1.15 : 1);
      let y = (def.floats ? 0.35 + Math.sin(this.time * 2.5 + en.x) * 0.1 : 0) + (en.moveT < 1 ? Math.abs(Math.sin(en.moveT * Math.PI)) * 0.08 : 0);
      // A called corpse lies at the floor and is drawn up as the chant runs.
      if (en.ai === 'dead') y -= call !== undefined ? (1 - call) * 1.2 : (fused ? Math.min(en.deadT, 0.3) : en.deadT) * 1.4;
      this.place(s, `${def.sprite}_${pose.frame}`, wx, y, wz, height);
      if (en.hurtT > 0) s.mat.uniforms.uTint.value.set(1, 0.95, 0.9, Math.min(0.8, en.hurtT * 3));
      // Your Shade: a pale, cold wash so it never reads as an ordinary knight.
      else if (en.def === 'shade' && en.ai !== 'dead' && en.ai !== 'windup') s.mat.uniforms.uTint.value.set(0.6, 0.72, 1, 0.45 + 0.08 * Math.sin(this.time * 2));
      else if (en.ai === 'windup' || (en.grabT ?? 0) > 0) s.mat.uniforms.uTint.value.set(1, 0.2, 0.1, 0.12 + 0.12 * Math.sin(this.time * 30));
      else if (en.elite && en.ai !== 'dead') {
        // A slow pulse in the trait's colour: readable at a glance, and never
        // confusable with the fast red flicker of a wind-up.
        const c = new THREE.Color(ELITES[en.elite].color);
        s.mat.uniforms.uTint.value.set(c.r, c.g, c.b, 0.1 + 0.08 * Math.sin(this.time * 3));
      }
      if (call !== undefined) {
        const c = new THREE.Color(RAISE_GLOW);
        s.mat.uniforms.uTint.value.set(c.r, c.g, c.b, 0.55 - 0.3 * call + 0.1 * Math.sin(this.time * 9));
      } else if (fused) {
        const c = new THREE.Color(ELITES.vengeful.color);
        s.mat.uniforms.uTint.value.set(c.r, c.g, c.b, 0.35 + 0.3 * Math.abs(Math.sin(this.time * 14)));
      } else if (en.ai === 'dead') s.mat.uniforms.uTint.value.set(0, 0, 0, Math.min(1, en.deadT * 1.2));
    }

    for (const tr of floor.traps ?? []) {
      if (!tr.found || !near(tr.x, tr.y)) continue;
      const s = this.sprite(`t:${tr.id}`);
      const art = tr.armed ? `trap_${tr.kind}` : `trap_${tr.kind}_spent`;
      const triggeredAt = this.trapTriggeredAt.get(tr.id);
      const elapsed = triggeredAt === undefined ? Infinity : this.time - triggeredAt;
      const settle = elapsed < 0.8 ? Math.sin((elapsed / 0.8) * Math.PI) : 0;
      this.placeFlat(s, art, tileX(tr.x), tileZ(tr.y), 0.96 + settle * 0.12);
      // A brief warm kick reads as the mechanism collapsing. Afterwards the
      // cold wreckage remains at full value instead of fading into the floor.
      if (!tr.armed && settle > 0) s.mat.uniforms.uTint.value.set(1, 0.72, 0.3, settle * 0.3);
    }

    for (const pr of floor.props) {
      if (!near(pr.x, pr.y)) continue;
      const s = this.sprite(`p:${pr.id}`);
      const wx = tileX(pr.x), wz = tileZ(pr.y);
      switch (pr.kind) {
        case 'chest':
          this.place(s, pr.smashed ? 'chest_broken' : pr.used ? 'chest_open' : pr.mimic ? 'chest_mimic' : 'chest', wx, 0, wz, 1.5);
          break;
        case 'icicle': {
          const c = pr.ceiling;
          if (c) {
            this.place(s, c.sprite, wx + c.dx, WALL_H - c.height, wz + c.dz, c.height);
            s.mat.uniforms.uTint.value.set(torchColor.r, torchColor.g, torchColor.b, 0.08);
          } else s.mesh.visible = false;
          break;
        }
        case 'root_cache':
          this.place(s, pr.used ? 'root_cache_broken' : 'root_cache', wx, 0, wz, 1.2);
          break;
        case 'urn':
          this.place(s, pr.used ? 'urn_broken' : 'urn', wx, 0, wz, 1.4);
          break;
        case 'barrel':
          this.place(s, pr.used ? 'barrel_broken' : 'barrel', wx, 0, wz, 1.5);
          break;
        case 'bones':
          this.place(s, 'bones', wx, 0, wz, 1.4);
          break;
        case 'shrine': {
          const kind = pr.shrine ?? 'font';
          this.place(s, `shrine_${kind}${pr.used ? '_used' : ''}`, wx, 0, wz, 1.9);
          break;
        }
        case 'fungus':
          this.place(s, 'fungus', wx + ((pr.x * 7) % 5) * 0.12 - 0.25, 0, wz + ((pr.y * 3) % 5) * 0.12 - 0.25, 0.7);
          break;
        case 'portal': {
          const pulse = 1.8 + Math.sin(this.time * 4) * 0.15;
          this.place(s, 'proj_shadow', wx, 0.2, wz, pulse);
          break;
        }
        case 'town_portal': {
          const pulse = 2.1 + Math.sin(this.time * 3) * 0.1;
          this.place(s, 'town_portal', wx, 0, wz, pulse);
          break;
        }
      }
    }

    for (const pk of floor.pickups) {
      if (!near(pk.x, pk.y)) continue;
      const s = this.sprite(`k:${pk.id}`);
      const hover = 0.25 + Math.sin(this.time * 3 + pk.x) * 0.06;
      let art = 'pickup_bag';
      let ramp: readonly [string, string, string, string] | undefined;
      if (pk.flaskShard) { art = 'ic_shard'; ramp = ['#12383b', '#26716e', '#67c6b6', '#dcfff7']; }
      else if (pk.keyId && !pk.items.length) art = 'ic_key';
      else if (pk.items.length === 1) {
        const ic = itemIcon(pk.items[0]);
        art = ic.icon;
        ramp = ic.ramp;
      } else if (!pk.items.length) art = 'pickup_gold';
      const onFloor = art === 'pickup_bag' || art === 'pickup_gold';
      this.place(s, art, tileX(pk.x), onFloor ? 0 : hover, tileZ(pk.y), onFloor ? 0.7 : 0.55, ramp);
    }

    for (const marker of floor.thrown ?? []) {
      if (!near(marker.x, marker.y)) continue;
      const art = itemBase(marker.base).thrown?.groundSprite;
      if (!art) continue;
      const s = this.sprite(`th:${marker.base}:${marker.x}:${marker.y}`);
      this.placeFlat(s, art, tileX(marker.x), tileZ(marker.y), 0.62);
    }

    for (const morsel of floor.morsels ?? []) {
      if (!near(morsel.x, morsel.y)) continue;
      const s = this.sprite(`morsel:${morsel.id}`);
      const age = world.run.stats.time - morsel.droppedAt;
      const dish = MORSEL_ART[morsel.kind];
      this.place(s, dish.art, tileX(morsel.x), 0.08, tileZ(morsel.y), dish.height);
      // Over the last third of its life it goes off: a mouldy olive creeping in.
      const rot = Math.max(0, Math.min(1, (age - MORSEL_ROT_SECONDS * 2 / 3) / (MORSEL_ROT_SECONDS / 3)));
      if (rot > 0) s.mat.uniforms.uTint.value.set(0.2, 0.22, 0.1, 0.65 * rot);
    }

    if (a.ward && near(a.ward.x, a.ward.y)) {
      const s = this.sprite('sigil:threshold');
      // The art drawn for this, not the trap plate it was borrowing.
      //
      // The ward is always the tile you are standing on — step off it and it is
      // gone — and at eye height your own tile sits entirely below the frustum:
      // the floor only starts being visible about two tiles ahead. So this
      // sprite is drawn every frame and cannot be seen, and widening it just
      // spills light over tiles that are not warded. The cue a player actually
      // reads is the glow at the bottom of the screen and the status line, both
      // in the HUD; this stays for the moment you are knocked off the tile or
      // the camera is ever lowered. It dims over the last two seconds.
      const art = a.ward.t <= 2 ? 'ward_threshold_dim' : 'ward_threshold';
      this.placeFlat(s, art, tileX(a.ward.x), tileZ(a.ward.y), 0.96);
      const pulse = 0.4 + 0.3 * Math.sin(this.time * 6);
      s.mat.uniforms.uTint.value.set(1, 0.88, 0.5, a.ward.t <= 2 ? pulse * 0.55 : pulse);
    }

    for (const t of floor.torches) {
      if (!near(t.x, t.y)) continue;
      const wx = tileX(t.x) + DX[t.side] * (TILE / 2 - 0.02);
      const wz = tileZ(t.y) + DY[t.side] * (TILE / 2 - 0.02);
      const sc = this.sprite(`ts:${t.x},${t.y},${t.side}`);
      this.place(sc, 'sconce', wx, 1.25, wz, 0.55);
      // Sconce sits flat on its wall.
      const r = turnRight(t.side);
      sc.mesh.rotation.set(0, Math.atan2(DX[r], DY[r]) - Math.PI / 2, 0);
      const fl = this.sprite(`tf:${t.x},${t.y},${t.side}`);
      const frame = Math.floor(this.time * 9 + t.x * 3 + t.y) % 3;
      this.place(fl, `flame_${frame}`, wx - DX[t.side] * 0.12, 1.55, wz - DY[t.side] * 0.12, 0.5);
    }

    for (const pr of world.projectiles) {
      const s = this.sprite(`j:${pr.id}`);
      this.place(s, pr.sprite, pr.x * TILE, 0.95, pr.y * TILE, 0.7);
      if (pr.sprite.startsWith('proj_arrow')) {
        s.mesh.rotation.set(0, this.camera.rotation.y, Math.atan2(-pr.dy, pr.dx));
      }
    }

    for (const [k, s] of this.sprites) {
      if (!s.seen) {
        this.scene.remove(s.mesh);
        s.mat.dispose();
        this.sprites.delete(k);
      }
    }

    // --- Viewmodel ---------------------------------------------------------------
    this.updateDrips(dt);
    this.updateViewmodel(world, dt, flick(0));

    // --- Draw ---------------------------------------------------------------------
    const pu = this.post.material.uniforms;
    this.flash.w = Math.max(0, this.flash.w - dt * 1.6);
    pu.uFlash.value.copy(this.flash);
    // Polled per frame, not pushed: the settings slider stays live with no
    // wiring, and dev arenas using this renderer get it for free.
    pu.uBrightness.value = brightness.get();
    const hpFrac = p.hp / world.derived.maxHp;
    pu.uLowHp.value = hpFrac < 0.3 ? 0.5 + 0.5 * Math.sin(this.time * 5) : 0;
    let fade = 0;
    if (a.transition) fade = a.transition.t < 0.45 ? a.transition.t / 0.45 : Math.max(0, 1 - (a.transition.t - 0.45) / 0.45);
    pu.uFade.value = Math.max(fade, this.deathFade * 0.85);

    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearColor(this.shared.uFogColor.value, 1);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.vmScene, this.vmCamera);
    this.post.render(this.renderer, this.target);
  }

  private updateViewmodel(world: World, _dt: number, flicker: number): void {
    const a = world.anim;
    const W = this.lowW, H = LOW_H;
    const art = world.weaponArt();
    const ramp = art.materialId ? findMaterial(art.materialId)?.ramp : undefined;
    const key = art.id + (art.materialId ?? '');
    const w = this.vmWeapon;
    if (key !== this.vmKey) {
      this.vmKey = key;
      w.mat.uniforms.map.value = artTexture(art.id, ramp);
    }
    // Torch-lit: tint the viewmodel by the torch colour, flickering.
    const biome = biomeForFloor(world.floor);
    const tc = new THREE.Color(biome.torch).lerp(new THREE.Color('#ffffff'), 0.6);
    this.vmShared.uAmbient.value.setRGB(tc.r * 0.85 * flicker, tc.g * 0.85 * flicker, tc.b * 0.85 * flicker);
    this.vmShared.uLightCount.value = 0;

    // The scale below normalises each viewmodel by its canvas height,
    // so art alone can never make one weapon read as bigger than another — a
    // dagger and a greatsword came out the same size in the same corner of the
    // frame. Two-handed weapons get their own pose instead: held up and across
    // the middle of the view rather than tucked at the right hip, half again as
    // tall, swaying harder with the walk, and winding up further because the
    // data already says they take longer to swing. Everything a player can see
    // about the grip, they see here.
    // A cast has its own pose: the stone comes up into the centre of the view
    // and rises as it charges, so the wind-up is something you watch rather
    // than something you time in your head.
    const casting = a.cast;
    const twoHanded = !casting && world.derived.twoHanded;
    const size = artSize(art.id);
    const scale = (H * (twoHanded ? 0.74 : casting ? 0.56 : 0.5)) / size.h;
    const walking = a.moveT < 1 ? a.moveT : 0;
    const sway = twoHanded ? 1.7 : 1;
    const bobX = Math.sin((a.steps + walking) * Math.PI) * 4 * sway;
    const bobY = Math.abs(Math.cos((a.steps + walking) * Math.PI)) * 4 * sway;
    let x = W * (twoHanded ? 0.56 : casting ? 0.5 : 0.74) + bobX;
    let y = H * 0.12 - bobY - 8;
    let rot = twoHanded ? -0.05 : casting ? 0 : -0.18;
    // A throw runs through the same `anim.attack` states as a swing, because it
    // is the same wind-up and recovery machinery — but a thrown weapon has no
    // viewmodel of its own, so those states were animating whatever melee
    // weapon happened to be in your hands. Hurling a javelin swung your
    // greatsword. The shaft leaves the body; the hands stay where they are.
    if (casting) {
      // `t` counts down, so this runs 0 → 1 over the cast.
      const total = Math.max(0.01, findSigil(casting.id)?.cast ?? 0.5);
      const k = 1 - Math.max(0, Math.min(1, casting.t / total));
      y += 26 * k;
      rot = Math.sin(this.time * 22) * 0.05 * k;
    } else if (a.attackThrow) {
      // Deliberately nothing.
    } else if (a.attack === 'windup') {
      const k = a.attackT / Math.max(0.01, a.attackDur);
      x += (twoHanded ? 40 : 22) * k;
      y += (twoHanded ? 52 : 30) * k;
      rot -= (twoHanded ? 0.95 : 0.55) * k;
    } else if (a.attack === 'recover') {
      const k = Math.min(1, a.attackT / 0.12);
      const back = Math.max(0, (a.attackT - 0.12) / Math.max(0.01, a.attackDur - 0.12));
      const reach = twoHanded ? 1.5 : 1;
      x += (22 - 110 * k + 88 * back) * reach;
      y += (30 - 60 * k + 30 * back) * reach;
      rot = (twoHanded ? -1.0 : -0.73) + (twoHanded ? 2.3 : 1.6) * k - (twoHanded ? 1.5 : 1.05) * back;
    }
    y -= a.blockRaise * 30;
    y -= this.deathFade * 120;
    w.mesh.scale.set(size.w * scale, size.h * scale, 1);
    w.mesh.position.set(x, y + (size.h * scale) / 2, 0);
    w.mesh.rotation.set(0, 0, rot);

    const sh = this.vmShield;
    // Asked of the derived player, not the slot: a two-hander leaves the shield
    // in the pack, and a shield still sitting in the offhand of a save that
    // predates the rule must not be drawn on an arm that is holding a maul.
    // While calling shafts back the left hand comes up to meet them — the
    // bare receiving hand, with the shield lowered — so the call reads on the
    // body rather than only in the log. Shafts are collected the moment they
    // reach the player tile, which is where the raised hand is.
    const retrieving = !!a.retrieving;
    const offhand = !retrieving && world.derived.hasShield ? world.state.equipment.offhand : null;
    sh.mesh.visible = !!offhand || retrieving;
    if (sh.mesh.visible) {
      const sramp = offhand?.materialId ? findMaterial(offhand.materialId)?.ramp : undefined;
      const texId = offhand ? viewmodelFor(itemBase(offhand.ref)) : 'vm_hand';
      const tex = artTexture(texId, sramp);
      if (sh.mat.uniforms.map.value !== tex) sh.mat.uniforms.map.value = tex;
      // Sized off the art, not a constant: the box is 24 rows tall but a
      // denser sprite (the bare hand is drawn at 2×) rides the same pose at
      // the same on-screen size with finer pixels.
      const box = artSize(texId);
      const ss = (H * 0.42) / box.h;
      const raise = Math.max(a.blockRaise, retrieving ? 1 : 0);
      sh.mesh.scale.set(box.w * ss, box.h * ss, 1);
      // Mostly out of frame until raised.
      sh.mesh.position.set(W * 0.16 + raise * W * 0.16 - bobX * 0.5, -H * 0.12 + raise * H * 0.4 - bobY - this.deathFade * 120, 0);
      // A small beckoning pulse follows each shaft's channel timer.
      const beckon = a.retrieving ? Math.sin((1 - a.retrieving.t / 0.75) * Math.PI) : 0;
      sh.mesh.position.y += beckon * H * 0.008;
      sh.mesh.rotation.set(0, 0, 0.2 - raise * 0.2 - beckon * 0.035);
      // The shield flares white while a parry would land, so the window is
      // something you learn to see rather than something you read about.
      const flare = world.parryWindow ? 0.38 : 0;
      sh.mat.uniforms.uTint.value.set(1, 0.95, 0.75, flare);
    }
  }

  dispose(): void {
    this.lava.dispose();
    this.level?.dispose();
    for (const s of this.sprites.values()) s.mat.dispose();
    this.target.dispose();
    this.renderer.dispose();
  }
}

export { WALL_H };
