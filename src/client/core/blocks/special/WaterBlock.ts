import * as THREE from 'three';
import { SpecialBlock, SpecialBlockContext } from './SpecialBlock';

// Minimal, simple water logic: slightly bobbing material and very simple spread to 4-neighbors with depth limit
export class WaterBlock implements SpecialBlock {
  readonly id = 'water';
  private readonly ctx: SpecialBlockContext;
  private mesh: THREE.Mesh | null = null;
  private spreadCooldown = 0; // seconds
  private depth = 0;
  private groupId: string | null = null;
  private visited = new Set<string>();

  constructor(ctx: SpecialBlockContext, depth: number = 0) {
    this.ctx = ctx;
    this.depth = depth;
  }

  onPlace(mesh: THREE.Mesh): void {
    this.mesh = mesh;
    // Join/create a water group and mark non-solid
    if (this.ctx.special?.water) {
      const existing = (mesh.userData && mesh.userData.waterGroupId) as string | undefined;
      this.groupId = this.ctx.special.water.register(mesh, existing);
    }
    if (this.mesh.material) {
      // Disable shadow interaction for water
      this.mesh.castShadow = false;
      this.mesh.receiveShadow = false;
    }
  }

  onRemove(_mesh: THREE.Mesh): void {
    this.mesh = null;
  }

  update(delta: number): void {
    if (!this.mesh) return;
    this.spreadCooldown -= delta;
    if (this.spreadCooldown <= 0) {
      void this.trySpread();
      this.spreadCooldown = 0.5; // spread a bit faster for responsiveness
    }
  }

  private async trySpread(): Promise<void> {
    if (!this.mesh) return;
    const baseX = Math.round(this.mesh.position.x);
    const baseY = Math.round(this.mesh.position.y);
    const baseZ = Math.round(this.mesh.position.z);
    const key = `${baseX},${baseY},${baseZ}`;
    if (this.visited.has(key)) return; // prevent oscillation loops
    this.visited.add(key);
    // Prefer flowing downward if empty (and not solid)
    const belowY = baseY - 1;
    if (!this.ctx.isOccupied(baseX, belowY, baseZ) && !this.ctx.isSolid(baseX, belowY, baseZ)) {
      if (!this.consumeSpreadBudget()) { this.maybeAbsorb(); return; }
      await this.ctx.placeBlock(baseX, belowY, baseZ, 'water', { persist: false, userData: { waterGroupId: this.groupId } });
      return;
    }
    // Otherwise spread to 4-neighbors at same level if empty and not solid
    const neighbors = [
      [baseX + 1, baseY, baseZ],
      [baseX - 1, baseY, baseZ],
      [baseX, baseY, baseZ + 1],
      [baseX, baseY, baseZ - 1],
    ];
    for (const [nx, ny, nz] of neighbors) {
      if (!this.ctx.isOccupied(nx, ny, nz) && !this.ctx.isSolid(nx, ny, nz)) {
        if (!this.consumeSpreadBudget()) {
          // No more budget: if we cannot spread and no down flow, and neighbors blocked, mark contained
          if (this.groupId && this.ctx.special?.water) this.ctx.special.water.markContained(this.groupId);
          this.maybeAbsorb();
          return;
        }
        await this.ctx.placeBlock(nx, ny, nz, 'water', { persist: false, userData: { waterGroupId: this.groupId } });
        return;
      }
    }
    // If we couldn't spread anywhere, mark as contained
    if (this.groupId && this.ctx.special?.water) this.ctx.special.water.markContained(this.groupId);
  }

  private consumeSpreadBudget(): boolean {
    if (!this.groupId || !this.ctx.special?.water) return true; // fallback
    return this.ctx.special.water.requestSpread(this.groupId);
  }

  private maybeAbsorb(): void {
    if (this.groupId && this.ctx.special?.water) {
      this.ctx.special.water.absorbIfUncontained(this.groupId);
    }
  }
}

export function createWaterBlock(ctx: SpecialBlockContext, mesh: THREE.Mesh): WaterBlock {
  const b = new WaterBlock(ctx, 0);
  b.onPlace(mesh);
  return b;
}


