import * as THREE from 'three';
import { Shared } from './ps1';

/** A pixelated, rising ash curtain. World fog keeps it grounded in the dungeon. */
export function fogGateMaterial(shared: Shared): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uTime: { value: 0 }, uOpacity: { value: 1 } },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      varying float vDepth;
      void main() {
        vUv = uv;
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        vDepth = -p.z;
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: `
      uniform float uTime, uOpacity, uFogNear, uFogFar;
      uniform vec3 uFogColor;
      varying vec2 vUv;
      varying float vDepth;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec2 uv = floor(vUv * vec2(64, 80)) / vec2(64, 80);
        float t = uTime * 0.22;
        float billow = noise(vec2(uv.x * 5.0, uv.y * 4.0 - t));
        float strands = noise(vec2(uv.x * 19.0 + billow * 2.5, uv.y * 3.0 - t * 1.7));
        float fine = noise(vec2(uv.x * 38.0, uv.y * 13.0 - t * 2.0));
        float ash = billow * 0.45 + strands * 0.45 + fine * 0.10;
        float edge = smoothstep(0.0, 0.12, uv.x) * smoothstep(0.0, 0.12, 1.0 - uv.x);
        vec3 col = mix(vec3(0.12, 0.13, 0.17), vec3(0.76, 0.75, 0.68), smoothstep(0.2, 0.8, ash));
        col += vec3(0.12, 0.09, 0.035) * pow(1.0 - uv.y, 4.0);
        col *= 0.65 + 0.35 * edge;
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vDepth) * 0.8);
        gl_FragColor = vec4(col, uOpacity * (0.88 + 0.12 * ash));
      }
    `,
  });
}
