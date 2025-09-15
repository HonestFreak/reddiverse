import * as THREE from 'three';
import { InputManager } from '../input/InputManager';

export class ThirdPersonController {
  readonly camera: THREE.PerspectiveCamera;
  readonly input: InputManager;
  readonly playerBase: THREE.Vector3 = new THREE.Vector3();

  yaw = 0;
  pitch = 0;

  constructor(camera: THREE.PerspectiveCamera, input: InputManager) {
    this.camera = camera;
    this.input = input;
  }

  updatePhysics(
    delta: number,
    opts: { gravity: number; walkSpeed: number; sprintMultiplier: number; damping: number; cameraDistance: number; cameraHeight: number; playerHeight: number; canJumpRef?: { current: boolean } },
    velocity: THREE.Vector3,
    heightAt: (x: number, z: number) => number,
    placedBlocks?: THREE.Mesh[],
    foliageCells?: Set<string>
  ): void {
    const { gravity, walkSpeed, sprintMultiplier, damping, cameraDistance, cameraHeight, playerHeight, canJumpRef } = opts;

    // Apply friction to horizontal velocity
    velocity.x -= velocity.x * damping * delta;
    velocity.z -= velocity.z * damping * delta;
    // Gravity
    velocity.y -= gravity * delta;

    // Rotation input
    if (this.input.state.rotateLeft) this.yaw += 2.0 * delta;
    if (this.input.state.rotateRight) this.yaw -= 2.0 * delta;

    // Movement input
    const direction = new THREE.Vector3(0, 0, 0);
    if (this.input.state.forward) direction.z -= 1;
    if (this.input.state.backward) direction.z += 1;
    direction.normalize();

    const speed = (this.input.state.sprint ? walkSpeed * sprintMultiplier : walkSpeed) * delta;
    const forwardDir = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    const rightDir = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    const moveVector = new THREE.Vector3();
    if (direction.z !== 0) moveVector.addScaledVector(forwardDir, -direction.z * speed);
    if (direction.x !== 0) moveVector.addScaledVector(rightDir, direction.x * speed);
    
    // Check for horizontal collision with placed blocks before moving
    if ((placedBlocks || foliageCells) && moveVector.length() > 0) {
      const newX = this.playerBase.x + moveVector.x;
      const newZ = this.playerBase.z + moveVector.z;
      const playerRadius = 0.4; // Match the actual player sphere radius
      
      let canMoveX = true;
      let canMoveZ = true;
      
      const newBlockX = Math.round(newX);
      const newBlockZ = Math.round(newZ);

      // Check collisions vs placed blocks using sphere-based collision
      if (placedBlocks) {
        for (const block of placedBlocks) {
          const blockPos = block.position;
          const blockX = blockPos.x;
          const blockZ = blockPos.z;
          const blockY = blockPos.y;

          // Check X movement collision
          const playerCenterY = this.playerBase.y + playerRadius;
          const distanceToBlockX = Math.abs(newX - blockX);
          const distanceToBlockY = Math.abs(playerCenterY - blockY);
          const distanceToBlockZ = Math.abs(this.playerBase.z - blockZ);
          
          // Check if sphere intersects with block for X movement
          if (distanceToBlockX < 0.5 + playerRadius && 
              distanceToBlockY < 0.5 + playerRadius && 
              distanceToBlockZ < 0.5 + playerRadius) {
            canMoveX = false;
          }

          // Check Z movement collision
          const distanceToBlockXZ = Math.abs(this.playerBase.x - blockX);
          const distanceToBlockZZ = Math.abs(newZ - blockZ);
          
          // Check if sphere intersects with block for Z movement
          if (distanceToBlockXZ < 0.5 + playerRadius && 
              distanceToBlockY < 0.5 + playerRadius && 
              distanceToBlockZZ < 0.5 + playerRadius) {
            canMoveZ = false;
          }
        }
      }

      // Check collisions vs foliage cells using sphere-based collision
      if (foliageCells) {
        const playerCenterY = this.playerBase.y + playerRadius;
        
        // Check X movement collision with foliage
        const foliageX = Math.round(newX);
        const foliageY = Math.round(playerCenterY);
        const foliageZ = Math.round(this.playerBase.z);
        const keyX = `${foliageX},${foliageY},${foliageZ}`;
        if (foliageCells.has(keyX)) canMoveX = false;
        
        // Check Z movement collision with foliage
        const foliageXZ = Math.round(this.playerBase.x);
        const foliageZZ = Math.round(newZ);
        const keyZ = `${foliageXZ},${foliageY},${foliageZZ}`;
        if (foliageCells.has(keyZ)) canMoveZ = false;
      }
      
      // Apply movement only if no collision
      if (canMoveX) this.playerBase.x += moveVector.x;
      if (canMoveZ) this.playerBase.z += moveVector.z;
    } else {
      this.playerBase.add(moveVector);
    }

    // Vertical movement
    this.playerBase.y += velocity.y * delta;

    // Ground collision - check both terrain and placed blocks
    const gx = Math.round(this.playerBase.x);
    const gz = Math.round(this.playerBase.z);
    const terrainHeight = heightAt(gx, gz);
    
    // Check for collision with placed blocks at player position
    let placedBlockHeight = -Infinity;
    if (placedBlocks) {
      for (const block of placedBlocks) {
        const blockPos = block.position;
        const blockX = Math.round(blockPos.x);
        const blockZ = Math.round(blockPos.z);
        
        // Check if this block is at the same x,z position as the player
        if (blockX === gx && blockZ === gz) {
          // Block top surface is at blockPos.y + 0.5 (block center + half height)
          const blockTop = blockPos.y + 0.5;
          if (blockTop > placedBlockHeight) {
            placedBlockHeight = blockTop;
          }
        }
      }
    }
    
    // Use the higher of terrain or placed block height
    const groundHeight = Math.max(terrainHeight, placedBlockHeight);
    
    // For terrain: height represents center, so top surface is height + 0.5
    // For placed blocks: placedBlockHeight already represents the top surface
    let minBaseY: number;
    if (placedBlockHeight > terrainHeight) {
      // Standing on placed blocks - use the height directly (already top surface)
      minBaseY = placedBlockHeight;
    } else {
      // Standing on terrain - add 0.5 to get top surface
      minBaseY = terrainHeight + 0.5;
    }
    if (this.playerBase.y < minBaseY) {
      velocity.y = 0;
      this.playerBase.y = minBaseY;
      if (canJumpRef) canJumpRef.current = true;
    } else {
      if (canJumpRef) canJumpRef.current = false;
    }

    if (this.input.consumeJump() && (canJumpRef?.current ?? false)) {
      velocity.y += 18; // jump impulse
      if (canJumpRef) canJumpRef.current = false;
    }

    // Camera follow
    const camTarget = new THREE.Vector3().copy(this.playerBase).add(new THREE.Vector3(0, cameraHeight, 0)).addScaledVector(forwardDir, 1.0);
    const camBack = new THREE.Vector3().copy(forwardDir).multiplyScalar(-cameraDistance);
    camBack.y += Math.sin(this.pitch) * cameraDistance * 0.5;
    const desiredCamPos = new THREE.Vector3().copy(this.playerBase).add(new THREE.Vector3(0, cameraHeight, 0)).add(camBack);
    this.camera.position.lerp(desiredCamPos, 0.25);
    this.camera.lookAt(camTarget);
  }
}


