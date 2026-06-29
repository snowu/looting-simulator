import * as THREE from 'three';
import { BaseType, Item, RARITY_COLORS } from '../types';

export function generateItemMesh(item: Item): THREE.Group {
  const group = new THREE.Group();
  const color = new THREE.Color(RARITY_COLORS[item.rarity]);

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.6,
    flatShading: true,
  });

  switch (item.baseType) {
    case BaseType.Blade: {
      // Blade = elongated octahedron + cylinder handle
      const blade = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), material);
      blade.scale.set(0.5, 2, 0.5);
      blade.position.y = 1;
      group.add(blade);
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.8, 6),
        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8, metalness: 0.1 })
      );
      handle.position.y = -0.2;
      group.add(handle);
      break;
    }
    case BaseType.Shield: {
      const shield = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), material);
      shield.scale.set(1, 1.2, 0.3);
      group.add(shield);
      break;
    }
    case BaseType.Ring: {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 8, 16), material);
      group.add(ring);
      break;
    }
    case BaseType.Helmet: {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), material);
      dome.position.y = 0.1;
      group.add(dome);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 8), material);
      group.add(brim);
      break;
    }
    case BaseType.Armor: {
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.6, 1, 1, 1), material);
      group.add(torso);
      const lShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), material);
      lShoulder.position.set(-0.7, 0.4, 0);
      group.add(lShoulder);
      const rShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), material);
      rShoulder.position.set(0.7, 0.4, 0);
      group.add(rShoulder);
      break;
    }
  }

  return group;
}
