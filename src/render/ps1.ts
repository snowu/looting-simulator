import * as THREE from 'three';

/**
 * PS1-flavoured shading:
 *  - vertices snap to the low-res pixel grid (wobble),
 *  - texture coordinates are partly affine (warp),
 *  - per-pixel point lights with hard quadratic falloff, gamma-space maths,
 *  - distance fog, emissive texels (alpha 250) ignore lighting.
 * A post pass then quantises to 15-bit colour with ordered dithering.
 */

export const MAX_LIGHTS = 12;

export interface Shared {
  uLightPos: { value: THREE.Vector4[] };
  uLightColor: { value: THREE.Vector3[] };
  uLightCount: { value: number };
  uAmbient: { value: THREE.Color };
  uFogColor: { value: THREE.Color };
  uFogNear: { value: number };
  uFogFar: { value: number };
  uSnap: { value: THREE.Vector2 };
  uAffine: { value: number };
}

export function createShared(): Shared {
  return {
    uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
    uLightColor: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
    uLightCount: { value: 0 },
    uAmbient: { value: new THREE.Color(0x181820) },
    uFogColor: { value: new THREE.Color(0x000000) },
    uFogNear: { value: 3 },
    uFogFar: { value: 16 },
    uSnap: { value: new THREE.Vector2(320, 240) },
    uAffine: { value: 0.45 },
  };
}

const VERT = /* glsl */ `
  uniform vec2 uSnap;
  varying vec2 vUv;
  varying vec3 vUvw;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 view = viewMatrix * world;
    vec4 clip = projectionMatrix * view;
    if (clip.w > 0.05) {
      vec2 hs = uSnap * 0.5;
      vec2 ndc = clip.xy / clip.w;
      ndc = floor(ndc * hs + 0.5) / hs;
      clip.xy = ndc * clip.w;
    }
    gl_Position = clip;
    float w = max(clip.w, 0.05);
    vUv = uv;
    vUvw = vec3(uv * w, w);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vDepth = -view.z;
  }
`;

const FRAG = /* glsl */ `
  #define MAX_LIGHTS ${MAX_LIGHTS}
  uniform sampler2D map;
  uniform vec4 uLightPos[MAX_LIGHTS];
  uniform vec3 uLightColor[MAX_LIGHTS];
  uniform int uLightCount;
  uniform vec3 uAmbient;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uAffine;
  uniform float uUnlit;
  uniform vec4 uTint;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vUvw;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vDepth;
  void main() {
    vec2 uv = mix(vUv, vUvw.xy / vUvw.z, uAffine);
    vec4 tex = texture2D(map, uv);
    if (tex.a < 0.5) discard;
    float emissive = (tex.a > 0.96 && tex.a < 0.99) ? 1.0 : 0.0;
    vec3 n = normalize(vNormalW);
    vec3 light = uAmbient;
    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (i >= uLightCount) break;
      vec3 d = uLightPos[i].xyz - vWorld;
      float dist = length(d);
      float att = clamp(1.0 - dist / uLightPos[i].w, 0.0, 1.0);
      att *= att;
      float lam = max(dot(n, d / max(dist, 0.0001)), 0.0) * 0.75 + 0.25;
      light += uLightColor[i] * att * mix(lam, 1.0, uUnlit);
    }
    vec3 col = tex.rgb * mix(min(light, vec3(1.3)), vec3(1.0), emissive);
    col = mix(col, uTint.rgb, uTint.a);
    float fog = smoothstep(uFogNear, uFogFar, vDepth);
    col = mix(col, uFogColor, fog * (1.0 - emissive * 0.7));
    gl_FragColor = vec4(col, uOpacity);
  }
`;

export interface PS1MaterialOptions {
  unlit?: boolean;
  transparent?: boolean;
  side?: THREE.Side;
  depthWrite?: boolean;
}

export type PS1Material = THREE.ShaderMaterial & {
  uniforms: {
    map: { value: THREE.Texture };
    uTint: { value: THREE.Vector4 };
    uUnlit: { value: number };
    uOpacity: { value: number };
  };
};

export function ps1Material(shared: Shared, map: THREE.Texture, opts: PS1MaterialOptions = {}): PS1Material {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      map: { value: map },
      uTint: { value: new THREE.Vector4(0, 0, 0, 0) },
      uUnlit: { value: opts.unlit ? 1 : 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    depthWrite: opts.depthWrite ?? true,
  });
  return mat as PS1Material;
}

// ---------------------------------------------------------------------------
// Post pass: 15-bit colour, ordered dither, flash, fade, vignette.
// ---------------------------------------------------------------------------

const POST_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const POST_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uRes;
  uniform float uDither;
  uniform vec4 uFlash;
  uniform float uFade;
  uniform float uVignette;
  uniform float uLowHp;
  varying vec2 vUv;
  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
  void main() {
    vec2 px = floor(vUv * uRes);
    vec3 c = texture2D(tDiffuse, (px + 0.5) / uRes).rgb;
    float g = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(g * 1.15, g * 0.8, g * 0.8), uLowHp * 0.55);
    c = mix(c, uFlash.rgb, uFlash.a);
    vec2 q = vUv - 0.5;
    c *= 1.0 - dot(q, q) * uVignette;
    float b = bayer4(px) - 0.5;
    c = floor(c * 31.0 + 0.5 + b * uDither) / 31.0;
    c *= 1.0 - uFade;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }
`;

export class PostPass {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uRes: { value: new THREE.Vector2(320, 240) },
        uDither: { value: 0.9 },
        uFlash: { value: new THREE.Vector4(0, 0, 0, 0) },
        uFade: { value: 0 },
        uVignette: { value: 1.1 },
        uLowHp: { value: 0 },
      },
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget): void {
    this.material.uniforms.tDiffuse.value = target.texture;
    this.material.uniforms.uRes.value.set(target.width, target.height);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
}

export function createLowResTarget(w: number, h: number): THREE.WebGLRenderTarget {
  const t = new THREE.WebGLRenderTarget(w, h, {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
    depthBuffer: true,
    generateMipmaps: false,
  });
  t.texture.colorSpace = THREE.NoColorSpace;
  return t;
}
