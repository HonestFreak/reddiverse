import * as THREE from 'three';
import { SpecialBlock, SpecialBlockContext } from './SpecialBlock';

export class KillBlock implements SpecialBlock {
  readonly id = 'kill';
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
    const player = this.ctx.getPlayerBase();
    const dx = Math.abs(player.x - this.mesh.position.x);
    const dz = Math.abs(player.z - this.mesh.position.z);
    const withinXZ = dx <= 0.6 && dz <= 0.6; // slightly generous vs 0.5
    const py = player.y;
    const minY = this.mesh.position.y - 0.2;
    const maxY = this.mesh.position.y + 1.2; // include standing on top
    const withinY = py >= minY && py <= maxY;
    const inContact = withinXZ && withinY;

    if (inContact && !this.hasTriggered) {
      this.hasTriggered = true;
      // Immediate local feedback
      this.ctx.setPlayerStateLocal?.({ life: 0 });
      void this.setLifeZero();
    } else if (!inContact && this.hasTriggered) {
      // Reset trigger when player leaves contact so it can trigger again later
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
    } catch (_) {
      // ignore network errors; polling will retry state later
    }
  }
}

export function createKillBlock(ctx: SpecialBlockContext, mesh: THREE.Mesh): KillBlock {
  const b = new KillBlock(ctx);
  b.onPlace(mesh);
  return b;
}


