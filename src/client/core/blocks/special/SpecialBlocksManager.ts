import * as THREE from 'three';
import { SpecialBlock, SpecialBlockContext } from './SpecialBlock';

export type SpecialBlockFactory = (ctx: SpecialBlockContext, mesh: THREE.Mesh) => SpecialBlock;

export class SpecialBlocksManager {
  private readonly ctx: SpecialBlockContext;
  private readonly registry = new Map<string, SpecialBlockFactory>();
  private readonly instances = new Map<string, SpecialBlock>(); // key: mesh.uuid
  // Water group tracking: each group has a spread budget and containment flag
  private readonly waterGroups = new Map<string, { budget: number; contained: boolean; meshes: Set<string>; settled: boolean }>();
  private waterGroupCounter = 0;

  constructor(ctx: SpecialBlockContext) {
    this.ctx = {
      ...ctx,
      special: {
        ...(ctx.special ?? {}),
        water: {
          register: (mesh: THREE.Mesh, groupId?: string) => this.registerWater(mesh, groupId),
          requestSpread: (gid: string) => this.requestWaterSpread(gid),
          markContained: (gid: string) => this.markWaterContained(gid),
          absorbIfUncontained: (gid: string) => this.absorbIfUncontained(gid),
          budgetRemaining: (gid: string) => this.waterGroups.get(gid)?.budget ?? 0,
        },
      },
    };
  }

  register(typeId: string, factory: SpecialBlockFactory): void {
    this.registry.set(typeId, factory);
  }

  onBlockPlaced(mesh: THREE.Mesh, blockTypeId: string): void {
    const factory = this.registry.get(blockTypeId);
    if (!factory) return;
    const inst = factory(this.ctx, mesh);
    this.instances.set(mesh.uuid, inst);
    inst.onPlace(mesh);
    // Track water meshes in groups
    if (blockTypeId === 'water') {
      const gid = (mesh.userData && mesh.userData.waterGroupId) as string | undefined;
      const finalGid = gid ?? this.registerWater(mesh, gid);
      const g = this.waterGroups.get(finalGid);
      if (g) g.meshes.add(mesh.uuid);
    }
  }

  onBlockRemoved(mesh: THREE.Mesh): void {
    const inst = this.instances.get(mesh.uuid);
    if (inst) {
      inst.onRemove(mesh);
      this.instances.delete(mesh.uuid);
    }
    const gid = (mesh.userData && mesh.userData.waterGroupId) as string | undefined;
    if (gid) {
      const g = this.waterGroups.get(gid);
      if (g) g.meshes.delete(mesh.uuid);
    }
  }

  update(delta: number): void {
    for (const inst of this.instances.values()) {
      inst.update(delta);
    }
    // Clean up empty water groups
    for (const [gid, info] of Array.from(this.waterGroups.entries())) {
      if (info.meshes.size === 0) {
        this.waterGroups.delete(gid);
      }
      // If group is contained and budget is exhausted, mark as settled
      if (info.contained && info.budget <= 0 && !info.settled) {
        info.settled = true;
        // Persist final layout for the group
        for (const uuid of info.meshes) {
          const inst = this.instances.get(uuid) as any;
          const mesh: THREE.Mesh | undefined = inst?.mesh;
          if (mesh) {
            const p = mesh.position;
            void this.ctx.persistBlock(Math.round(p.x), Math.round(p.y), Math.round(p.z), 'water');
          }
        }
      }
    }
  }

  // Water helpers
  private nextWaterGroupId(): string {
    this.waterGroupCounter += 1;
    return `wg_${this.waterGroupCounter}`;
  }

  private registerWater(mesh: THREE.Mesh, groupId?: string): string {
    const gid = groupId ?? this.nextWaterGroupId();
    const g = this.waterGroups.get(gid) ?? { budget: 6, contained: false, meshes: new Set<string>(), settled: false };
    this.waterGroups.set(gid, g);
    g.meshes.add(mesh.uuid);
    mesh.userData.waterGroupId = gid;
    return gid;
  }

  private requestWaterSpread(groupId: string): boolean {
    const g = this.waterGroups.get(groupId);
    if (!g) return false;
    if (g.settled || g.contained) return false; // freeze once contained/settled
    if (g.budget <= 0) return false;
    g.budget -= 1;
    return true;
  }

  private markWaterContained(groupId: string): void {
    const g = this.waterGroups.get(groupId);
    if (!g) return;
    if (g.settled) return;
    g.contained = true;
    // Settle immediately: freeze budget and persist final layout
    g.budget = 0;
    g.settled = true;
    for (const uuid of g.meshes) {
      const inst = this.instances.get(uuid) as any;
      const mesh: THREE.Mesh | undefined = inst?.mesh;
      if (mesh) {
        const p = mesh.position;
        void this.ctx.persistBlock(Math.round(p.x), Math.round(p.y), Math.round(p.z), 'water');
      }
    }
  }

  private absorbIfUncontained(groupId: string): void {
    const g = this.waterGroups.get(groupId);
    if (!g) return;
    if (!g.contained && g.budget <= 0) {
      // Remove all meshes in this group
      for (const uuid of Array.from(g.meshes)) {
        const inst = this.instances.get(uuid);
        // Find mesh by uuid in scene
        let mesh: THREE.Mesh | null = null;
        if (inst && (inst as any).mesh) {
          mesh = (inst as any).mesh as THREE.Mesh;
        }
        if (mesh) {
          this.ctx.scene.remove(mesh);
        }
        this.instances.delete(uuid);
        g.meshes.delete(uuid);
      }
      this.waterGroups.delete(groupId);
    }
  }
}


