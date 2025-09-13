import * as THREE from 'three';

export type SpecialBlockContext = {
  scene: THREE.Scene;
  getPlayerBase: () => THREE.Vector3;
  getVelocity: () => THREE.Vector3;
  addUpwardImpulse: (impulse: number) => void;
  heightAt: (x: number, z: number) => number;
  isOccupied: (x: number, y: number, z: number) => boolean;
  isSolid: (x: number, y: number, z: number) => boolean;
  placeBlock: (
    x: number,
    y: number,
    z: number,
    type: string,
    extras?: { userData?: Record<string, unknown>; persist?: boolean }
  ) => Promise<void>;
  removeBlock: (x: number, y: number, z: number) => void;
  special?: {
    water?: {
      register: (mesh: THREE.Mesh, groupId?: string) => string;
      requestSpread: (groupId: string) => boolean;
      markContained: (groupId: string) => void;
      absorbIfUncontained: (groupId: string) => void;
      budgetRemaining: (groupId: string) => number;
    };
  };
  persistBlock: (x: number, y: number, z: number, type: string, color?: string) => Promise<void>;
};

export interface SpecialBlock {
  readonly id: string;
  onPlace(mesh: THREE.Mesh): void;
  onRemove(mesh: THREE.Mesh): void;
  update(delta: number): void;
}


