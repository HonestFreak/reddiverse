import * as THREE from 'three';
import { SpecialBlock, SpecialBlockContext } from './SpecialBlock';
import * as THREE from 'three';

function intersectsSphereAABB(center: THREE.Vector3, radius: number, boxCenter: THREE.Vector3): boolean {
  const hx = 0.5, hy = 0.5, hz = 0.5;
  const dx = Math.max(Math.abs(center.x - boxCenter.x) - hx, 0);
  const dy = Math.max(Math.abs(center.y - boxCenter.y) - hy, 0);
  const dz = Math.max(Math.abs(center.z - boxCenter.z) - hz, 0);
  return (dx * dx + dy * dy + dz * dz) <= (radius * radius);
}

export class WinnerBlock implements SpecialBlock {
  readonly id = 'winner';
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
      this.ctx.setPlayerStateLocal?.({ isWinner: true });
      void this.setWinnerTrue();
    } else if (!inContact && this.hasTriggered) {
      this.hasTriggered = false;
    }
  }

  private async setWinnerTrue(): Promise<void> {
    try {
      await fetch('/api/player-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isWinner: true }),
      });
    } catch (_) {}
  }
}

export function createWinnerBlock(ctx: SpecialBlockContext, mesh: THREE.Mesh): WinnerBlock {
  const b = new WinnerBlock(ctx);
  b.onPlace(mesh);
  return b;
}


