import * as THREE from 'three';
import { SpecialBlock, SpecialBlockContext } from './SpecialBlock';

export class JumperBlock implements SpecialBlock {
  readonly id = 'jumper';
  private readonly ctx: SpecialBlockContext;
  private mesh: THREE.Mesh | null = null;

  constructor(ctx: SpecialBlockContext) {
    this.ctx = ctx;
  }

  onPlace(mesh: THREE.Mesh): void {
    this.mesh = mesh;
  }

  onRemove(_mesh: THREE.Mesh): void {
    this.mesh = null;
  }

  update(_delta: number): void {
    if (!this.mesh) return;
    const player = this.ctx.getPlayerBase();
    // Consider player standing if feet are within a small epsilon of block top and x/z overlap
    const blockTopY = this.mesh.position.y + 0.51;
    const isAbove = Math.abs(player.y - blockTopY) < 0.15;
    const sameX = Math.round(player.x) === Math.round(this.mesh.position.x);
    const sameZ = Math.round(player.z) === Math.round(this.mesh.position.z);
    if (isAbove && sameX && sameZ) {
      // Apply upward impulse once per contact when velocity is downward or near zero
      const vel = this.ctx.getVelocity();
      if (vel.y <= 0.2) {
        this.ctx.addUpwardImpulse(14);
      }
    }
  }
}

export function createJumperBlock(ctx: SpecialBlockContext, mesh: THREE.Mesh): JumperBlock {
  const b = new JumperBlock(ctx);
  b.onPlace(mesh);
  return b;
}


