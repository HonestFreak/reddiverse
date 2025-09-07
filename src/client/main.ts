import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// Canvas / DOM
const canvas = document.getElementById('bg') as HTMLCanvasElement;
const overlay = document.querySelector('.overlay') as HTMLDivElement | null;
const titleEl = document.getElementById('title') as HTMLHeadingElement | null;
const descriptionEl = document.querySelector('.description') as HTMLParagraphElement | null;
const instructionsEl = document.getElementById('instructions') as HTMLDivElement | null;
const crosshairEl = document.getElementById('crosshair') as HTMLDivElement | null;

// Ensure canvas is ready for pointer lock
if (!canvas) {
  throw new Error('Canvas element not found');
}

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // sky

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 15);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
renderer.setPixelRatio(window.devicePixelRatio ?? 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Lights - more intense lighting
scene.add(new THREE.HemisphereLight(0xffffff, 0x88bbff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(20, 30, 20);
dirLight.castShadow = false;
scene.add(dirLight);

// Additional ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Pointer lock controls
const controls = new PointerLockControls(camera, canvas);
scene.add(controls.getObject());

// Fallback mouse look (when pointer lock fails)
let mouseX = 0;
let mouseY = 0;
let isMouseDown = false;
let useFallbackControls = false;

// Mouse look fallback
function onMouseMove(event: MouseEvent): void {
  if (!useFallbackControls || !isMouseDown) return;
  
  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;
  
  // Rotate camera based on mouse movement
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  euler.setFromQuaternion(camera.quaternion);
  
  euler.y -= movementX * 0.002;
  euler.x -= movementY * 0.002;
  euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, euler.x));
  
  camera.quaternion.setFromEuler(euler);
}

function onMouseDown(event: MouseEvent): void {
  if (event.button === 0) { // Left mouse button
    isMouseDown = true;
    canvas.requestPointerLock();
  }
}

function onMouseUp(): void {
  isMouseDown = false;
}

canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('mousedown', onMouseDown);
canvas.addEventListener('mouseup', onMouseUp);

function setOverlayVisible(visible: boolean): void {
  if (!overlay) return;
  overlay.style.display = 'none'; // Always hide overlay
  if (crosshairEl) crosshairEl.style.display = 'block'; // Always show crosshair
}

// Event listeners for pointer lock (optional - game works without it)
function requestPointerLock(): void {
  console.log('Attempting to lock pointer...');
  try {
    controls.lock();
  } catch (error) {
    console.error('Error locking pointer:', error);
  }
}

// Try pointer lock on any click
canvas.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  requestPointerLock();
});

controls.addEventListener('lock', () => {
  console.log('Pointer locked successfully');
  useFallbackControls = false;
  setOverlayVisible(false);
});

controls.addEventListener('unlock', () => {
  console.log('Pointer unlocked');
  useFallbackControls = true;
  setOverlayVisible(false);
});

controls.addEventListener('error', (event) => {
  console.error('Pointer lock error:', event);
  console.log('Falling back to mouse look controls');
  useFallbackControls = true;
  setOverlayVisible(false);
});

// World settings
const chunkSize = 64; // x and z dimensions
const half = Math.floor(chunkSize / 2);
const maxHeight = 18;
const blockSize = 1;

// Height function (simple pseudo-noise via trigonometry)
function heightAt(gridX: number, gridZ: number): number {
  const n1 = Math.sin(gridX * 0.15) + Math.cos(gridZ * 0.15);
  const n2 = Math.sin(gridX * 0.05) * Math.cos(gridZ * 0.05);
  const base = 8 + n1 * 4 + n2 * 2;
  const h = Math.floor(THREE.MathUtils.clamp(base, 0, maxHeight));
  return h;
}

// Build voxel top-layer with InstancedMesh for performance
const dummy = new THREE.Object3D();
const color = new THREE.Color();
const cubeGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
const cubeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const instanceCount = chunkSize * chunkSize;
const voxels = new THREE.InstancedMesh(cubeGeo, cubeMat, instanceCount);
voxels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

// Set up instance colors properly
const colors = new Float32Array(instanceCount * 3);
voxels.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);

let i = 0;
for (let gz = -half; gz < half; gz++) {
  for (let gx = -half; gx < half; gx++) {
    const h = heightAt(gx, gz);
    dummy.position.set(gx * blockSize, h * blockSize, gz * blockSize);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    voxels.setMatrixAt(i, dummy.matrix);
    // Grass hue with slight variation by height
    const hue = 0.33 - (h / maxHeight) * 0.05;
    const lightness = 0.35 + (h / maxHeight) * 0.2;
    color.setHSL(hue, 0.6, lightness);
    
    // Set color in the colors array
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    i++;
  }
}
voxels.instanceColor.needsUpdate = true;
scene.add(voxels);

console.log('Voxels created:', instanceCount, 'instances');
console.log('Camera position:', camera.position);
console.log('Scene children:', scene.children.length);

// Add a simple test cube to verify rendering works
const testGeo = new THREE.BoxGeometry(2, 2, 2);
const testMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
const testCube = new THREE.Mesh(testGeo, testMat);
testCube.position.set(0, 5, 0);
scene.add(testCube);

// Simple sky dome (optional visual)
const skyGeo = new THREE.SphereGeometry(500, 16, 16);
const skyMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// Player physics
const clock = new THREE.Clock();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);
let canJump = false;

const playerHeight = 1.7; // camera eye height
const gravity = 30; // units/s^2
const walkSpeed = 8; // units/s
const sprintMultiplier = 1.7;
const damping = 8; // horizontal friction

const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
};

function onKeyDown(event: KeyboardEvent): void {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveState.forward = true; break;
    case 'ArrowLeft':
    case 'KeyA':
      moveState.left = true; break;
    case 'ArrowDown':
    case 'KeyS':
      moveState.backward = true; break;
    case 'ArrowRight':
    case 'KeyD':
      moveState.right = true; break;
    case 'ShiftLeft':
    case 'ShiftRight':
      moveState.sprint = true; break;
    case 'Space':
      if (canJump) {
        velocity.y += 12;
        canJump = false;
      }
      break;
  }
}

function onKeyUp(event: KeyboardEvent): void {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveState.forward = false; break;
    case 'ArrowLeft':
    case 'KeyA':
      moveState.left = false; break;
    case 'ArrowDown':
    case 'KeyS':
      moveState.backward = false; break;
    case 'ArrowRight':
    case 'KeyD':
      moveState.right = false; break;
    case 'ShiftLeft':
    case 'ShiftRight':
      moveState.sprint = false; break;
  }
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Initial spawn position
function resetSpawn(): void {
  const spawnX = 0;
  const spawnZ = 0;
  const groundH = heightAt(Math.round(spawnX), Math.round(spawnZ));
  const y = groundH * blockSize + playerHeight;
  controls.getObject().position.set(spawnX, y, spawnZ);
}
resetSpawn();

// Resize handler
window.addEventListener('resize', () => {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function updatePhysics(delta: number): void {
  // Apply friction to horizontal velocity
  velocity.x -= velocity.x * damping * delta;
  velocity.z -= velocity.z * damping * delta;

  // Gravity
  velocity.y -= gravity * delta;

  // Movement input
  direction.set(0, 0, 0);
  if (moveState.forward) direction.z -= 1;
  if (moveState.backward) direction.z += 1;
  if (moveState.left) direction.x -= 1;
  if (moveState.right) direction.x += 1;
  direction.normalize();

  const speed = (moveState.sprint ? walkSpeed * sprintMultiplier : walkSpeed) * delta;
  // Move in camera space (XZ plane)
  if (controls.isLocked) {
    if (direction.z !== 0) controls.moveForward(direction.z * speed);
    if (direction.x !== 0) controls.moveRight(direction.x * speed);
  } else if (useFallbackControls) {
    // Fallback movement using camera direction
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    forward.applyQuaternion(camera.quaternion);
    right.applyQuaternion(camera.quaternion);
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();
    
    const moveVector = new THREE.Vector3();
    if (direction.z !== 0) moveVector.addScaledVector(forward, direction.z * speed);
    if (direction.x !== 0) moveVector.addScaledVector(right, direction.x * speed);
    
    controls.getObject().position.add(moveVector);
  }

  // Vertical movement
  const obj = controls.getObject();
  obj.position.addScaledVector(upVector, velocity.y * delta);

  // Ground collision
  const gx = Math.round(obj.position.x / blockSize);
  const gz = Math.round(obj.position.z / blockSize);
  const ground = heightAt(gx, gz) * blockSize;
  const minY = ground + playerHeight;

  if (obj.position.y < minY) {
    velocity.y = 0;
    obj.position.y = minY;
    canJump = true;
  }
}

function animate(): void {
  requestAnimationFrame(animate);
  const delta = Math.min(0.05, clock.getDelta());
  updatePhysics(delta);
  renderer.render(scene, camera);
}

// Enable fallback controls by default and start game immediately
useFallbackControls = true;
setOverlayVisible(false);

animate();
