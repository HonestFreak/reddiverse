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

  updatePhysics(delta: number, opts: { gravity: number; walkSpeed: number; sprintMultiplier: number; damping: number; cameraDistance: number; cameraHeight: number; playerHeight: number; canJumpRef?: { current: boolean } }, velocity: THREE.Vector3, heightAt: (x: number, z: number) => number): void {
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
    this.playerBase.add(moveVector);

    // Vertical movement
    this.playerBase.y += velocity.y * delta;

    // Ground collision
    const gx = Math.round(this.playerBase.x);
    const gz = Math.round(this.playerBase.z);
    const ground = heightAt(gx, gz);
    // The terrain height represents the center of a 1u tall block positioned at y = h
    // So the block's top face is at (h + 0.5). The player's base (feet) should rest there.
    const minBaseY = ground + 0.5;
    if (this.playerBase.y < minBaseY) {
      velocity.y = 0;
      this.playerBase.y = minBaseY;
      if (canJumpRef) canJumpRef.current = true;
    } else {
      if (canJumpRef) canJumpRef.current = false;
    }

    if (this.input.consumeJump() && (canJumpRef?.current ?? false)) {
      velocity.y += 12; // jump impulse
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


