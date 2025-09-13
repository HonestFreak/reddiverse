import * as THREE from 'three';
import { SpecialBlock, SpecialBlockContext } from './SpecialBlock';

export class LightBlock implements SpecialBlock {
  readonly id = 'light';
  private readonly ctx: SpecialBlockContext;
  private mesh: THREE.Mesh | null = null;
  private light: THREE.PointLight | null = null;

  constructor(ctx: SpecialBlockContext) {
    this.ctx = ctx;
  }

  onPlace(mesh: THREE.Mesh): void {
    this.mesh = mesh;
    // Light is omnidirectional from the block center
    const light = new THREE.PointLight(0xfff1b3, 2.0, 14, 2.0);
    light.position.copy(mesh.position).add(new THREE.Vector3(0, 0.2, 0));
    this.ctx.scene.add(light);
    this.light = light;
    // Make the block surface non-shadowing so light isn't visually blocked
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m: THREE.Material) => {
        (m as THREE.Material).transparent = (m as any).transparent ?? false;
        (m as any).depthWrite = (m as any).depthWrite ?? true;
      });
    }
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }

  onRemove(_mesh: THREE.Mesh): void {
    if (this.light) {
      this.ctx.scene.remove(this.light);
      this.light.dispose();
      this.light = null;
    }
    this.mesh = null;
  }

  update(_delta: number): void {
    // No per-frame behavior for simple light
  }
}

export function createLightBlock(ctx: SpecialBlockContext, mesh: THREE.Mesh): LightBlock {
  const b = new LightBlock(ctx);
  b.onPlace(mesh);
  return b;
}


