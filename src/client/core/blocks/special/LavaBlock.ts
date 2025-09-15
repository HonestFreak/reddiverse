import * as THREE from 'three';
import { SpecialBlock, SpecialBlockContext } from './SpecialBlock';

function intersectsSphereAABB(center: THREE.Vector3, radius: number, boxCenter: THREE.Vector3): boolean {
  const hx = 0.5, hy = 0.5, hz = 0.5; // half-extents for 1×1×1 block
  const dx = Math.max(Math.abs(center.x - boxCenter.x) - hx, 0);
  const dy = Math.max(Math.abs(center.y - boxCenter.y) - hy, 0);
  const dz = Math.max(Math.abs(center.z - boxCenter.z) - hz, 0);
  return (dx * dx + dy * dy + dz * dz) <= (radius * radius);
}

export class LavaBlock implements SpecialBlock {
  readonly id = 'lava';
  private readonly ctx: SpecialBlockContext;
  private mesh: THREE.Mesh | null = null;
  private hasTriggered = false;

  constructor(ctx: SpecialBlockContext) {
    this.ctx = ctx;
  }

  onPlace(mesh: THREE.Mesh): void {
    this.mesh = mesh;
  }

  onRemove(_mesh: THREE.Mesh): void {
    this.mesh = null;
    this.hasTriggered = false;
  }

  update(_delta: number): void {
    if (!this.mesh) return;
    const playerBase = this.ctx.getPlayerBase();
    const sphereCenter = new THREE.Vector3(playerBase.x, playerBase.y + 0.4, playerBase.z);
    const radius = 0.4;
    const inContact = intersectsSphereAABB(sphereCenter, radius, this.mesh.position);
    if (inContact && !this.hasTriggered) {
      this.hasTriggered = true;
      this.ctx.setPlayerStateLocal?.({ life: 0 });
      void this.setLifeZero();
    } else if (!inContact && this.hasTriggered) {
      this.hasTriggered = false;
    }
  }

  private async setLifeZero(): Promise<void> {
    try {
      await fetch('/api/player-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ life: 0 }),
      });
    } catch (_) {}
  }
}

export function createLavaBlock(ctx: SpecialBlockContext, mesh: THREE.Mesh): LavaBlock {
  const b = new LavaBlock(ctx);
  b.onPlace(mesh);
  return b;
}


