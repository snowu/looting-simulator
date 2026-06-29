import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Item } from '../types';
import { generateItemMesh } from './item-meshes';

export class ItemRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private currentMesh: THREE.Group | null = null;
  private animationId: number = 0;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.camera.position.set(0, 1, 3);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 2;

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    this.scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, 3, -5);
    this.scene.add(backLight);

    this.animate();

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    resizeObserver.observe(container);
  }

  showItem(item: Item): void {
    this.clear();
    this.currentMesh = generateItemMesh(item);
    this.scene.add(this.currentMesh);
    this.controls.reset();
  }

  clear(): void {
    if (this.currentMesh) {
      this.currentMesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
      this.scene.remove(this.currentMesh);
      this.currentMesh = null;
    }
  }

  dispose(): void {
    this.clear();
    cancelAnimationFrame(this.animationId);
    this.renderer.dispose();
    this.controls.dispose();
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
