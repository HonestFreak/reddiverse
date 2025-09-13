import * as THREE from 'three';
import type { SpecialBlock, SpecialBlockContext } from './SpecialBlock';
import type { SmartBlockDefinition, SmartAction, PlayerState } from '../../../../shared/types/SmartBlocks';

export class SmartSpecialBlock implements SpecialBlock {
  readonly id: string;
  private readonly ctx: SpecialBlockContext;
  private mesh: THREE.Mesh | null = null;
  private readonly def: SmartBlockDefinition;
  private lastTouchTime = 0;

  constructor(ctx: SpecialBlockContext, def: SmartBlockDefinition) {
    this.ctx = ctx;
    this.def = def;
    this.id = def.id;
  }

  onPlace(mesh: THREE.Mesh): void {
    this.mesh = mesh;
  }

  onRemove(_mesh: THREE.Mesh): void {
    this.mesh = null;
  }

  update(delta: number): void {
    // Touch logic: if player overlaps block cell, fire once per second
    if (!this.mesh || !this.def.onTouch || this.def.onTouch.length === 0) return;
    
    const now = Date.now();
    if (now - this.lastTouchTime < 1000) return; // Throttle to once per second
    
    const player = this.ctx.getPlayerBase();
    const px = Math.round(player.x);
    const py = Math.round(player.y);
    const pz = Math.round(player.z);
    const bx = Math.round(this.mesh.position.x);
    const by = Math.round(this.mesh.position.y);
    const bz = Math.round(this.mesh.position.z);
    
    // Check if player is standing on or overlapping the block
    const isOnBlock = px === bx && pz === bz && (py === by || py === by + 1);
    const isInBlock = px === bx && py === by && pz === bz;
    
    if (isOnBlock || isInBlock) {
      console.log(`Smart block ${this.def.name} triggered onTouch`, { px, py, pz, bx, by, bz, actions: this.def.onTouch });
      this.lastTouchTime = now;
      void this.executeActions(this.def.onTouch);
    }
  }

  async click(): Promise<void> {
    if (this.def.onClick && this.def.onClick.length > 0) {
      await this.executeActions(this.def.onClick);
    }
  }

  private async executeActions(actions: SmartAction[]): Promise<void> {
    console.log(`Executing ${actions.length} actions for ${this.def.name}:`, actions);
    for (const a of actions) {
      try {
        console.log(`Executing action:`, a);
        switch (a.type) {
          case 'impulse': {
            if (a.axis === 'y') {
              console.log(`Adding impulse: ${a.amount}`);
              this.ctx.addUpwardImpulse(a.amount);
            }
            break;
          }
          case 'placeBlock': {
            if (!this.mesh) break;
            const p = this.mesh.position;
            const x = Math.round(p.x + a.offset.dx);
            const y = Math.round(p.y + a.offset.dy);
            const z = Math.round(p.z + a.offset.dz);
            console.log(`Placing block at ${x},${y},${z}`);
            await this.ctx.placeBlock(x, y, z, a.blockType, { persist: a.persist ?? true });
            break;
          }
          case 'removeBlock': {
            if (!this.mesh) break;
            const p = this.mesh.position;
            const x = Math.round(p.x + a.offset.dx);
            const y = Math.round(p.y + a.offset.dy);
            const z = Math.round(p.z + a.offset.dz);
            console.log(`Removing block at ${x},${y},${z}`);
            this.ctx.removeBlock(x, y, z);
            break;
          }
          case 'setLife': {
            const current = await this.getPlayerState();
            let next = current.life;
            if (a.mode === 'set') next = a.value;
            if (a.mode === 'add') next = current.life + a.value;
            if (a.mode === 'subtract') next = current.life - a.value;
            const finalLife = Math.max(0, Math.min(100, next));
            console.log(`Setting life: ${current.life} -> ${finalLife} (mode: ${a.mode}, value: ${a.value})`);
            await this.updatePlayerState({ ...current, life: finalLife });
            break;
          }
          case 'setWinner': {
            const current = await this.getPlayerState();
            console.log(`Setting winner: ${a.value}`);
            await this.updatePlayerState({ ...current, isWinner: a.value });
            break;
          }
          case 'setBadge': {
            const current = await this.getPlayerState();
            console.log(`Setting badge: ${a.value}`);
            await this.updatePlayerState({ ...current, badge: a.value });
            break;
          }
        }
        console.log(`Action ${a.type} completed successfully`);
      } catch (e) {
        console.error('Smart action failed', a, e);
      }
    }
  }

  private async getPlayerState(): Promise<PlayerState> {
    try {
      const res = await fetch('/api/player-state');
      if (!res.ok) throw new Error('state get failed');
      return (await res.json()) as PlayerState;
    } catch (_e) {
      return { life: 100, isWinner: false, badge: '' };
    }
  }

  private async updatePlayerState(state: PlayerState): Promise<PlayerState> {
    try {
      const res = await fetch('/api/player-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error('state post failed');
      return (await res.json()) as PlayerState;
    } catch (_e) {
      return state;
    }
  }
}


