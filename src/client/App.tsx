import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

// Simple voxel component
function Voxel({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

// Simplified voxel terrain - smaller for testing
function VoxelTerrain() {
  const voxels = [];
  const chunkSize = 16; // Reduced from 64
  const half = Math.floor(chunkSize / 2);
  const maxHeight = 8; // Reduced height

  // Height function
  function heightAt(gridX: number, gridZ: number): number {
    const n1 = Math.sin(gridX * 0.2) + Math.cos(gridZ * 0.2);
    const n2 = Math.sin(gridX * 0.1) * Math.cos(gridZ * 0.1);
    const base = 3 + n1 * 2 + n2 * 1;
    return Math.floor(THREE.MathUtils.clamp(base, 0, maxHeight));
  }

  // Generate voxels
  for (let gz = -half; gz < half; gz++) {
    for (let gx = -half; gx < half; gx++) {
      const h = heightAt(gx, gz);
      if (h > 0) { // Only create voxels above ground
        const hue = 0.33 - (h / maxHeight) * 0.1;
        const lightness = 0.4 + (h / maxHeight) * 0.3;
        const color = new THREE.Color().setHSL(hue, 0.7, lightness);
        
        voxels.push({
          position: [gx, h, gz] as [number, number, number],
          color: `#${color.getHexString()}`
        });
      }
    }
  }

  console.log('Generated', voxels.length, 'voxels');

  return (
    <group>
      {voxels.map((voxel, index) => (
        <Voxel key={index} position={voxel.position} color={voxel.color} />
      ))}
    </group>
  );
}

// Player controller
function PlayerController() {
  const controlsRef = useRef<any>(null);
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const [moveState, setMoveState] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });
  const [canJump, setCanJump] = useState(false);

  const playerHeight = 1.7;
  const gravity = 30;
  const walkSpeed = 8;
  const sprintMultiplier = 1.7;
  const damping = 8;

  // Height function for collision
  function heightAt(gridX: number, gridZ: number): number {
    const n1 = Math.sin(gridX * 0.2) + Math.cos(gridZ * 0.2);
    const n2 = Math.sin(gridX * 0.1) * Math.cos(gridZ * 0.1);
    const base = 3 + n1 * 2 + n2 * 1;
    return Math.floor(THREE.MathUtils.clamp(base, 0, 8));
  }

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          setMoveState(prev => ({ ...prev, forward: true })); break;
        case 'ArrowLeft':
        case 'KeyA':
          setMoveState(prev => ({ ...prev, left: true })); break;
        case 'ArrowDown':
        case 'KeyS':
          setMoveState(prev => ({ ...prev, backward: true })); break;
        case 'ArrowRight':
        case 'KeyD':
          setMoveState(prev => ({ ...prev, right: true })); break;
        case 'ShiftLeft':
        case 'ShiftRight':
          setMoveState(prev => ({ ...prev, sprint: true })); break;
        case 'Space':
          if (canJump) {
            velocity.current.y += 12;
            setCanJump(false);
          }
          break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          setMoveState(prev => ({ ...prev, forward: false })); break;
        case 'ArrowLeft':
        case 'KeyA':
          setMoveState(prev => ({ ...prev, left: false })); break;
        case 'ArrowDown':
        case 'KeyS':
          setMoveState(prev => ({ ...prev, backward: false })); break;
        case 'ArrowRight':
        case 'KeyD':
          setMoveState(prev => ({ ...prev, right: false })); break;
        case 'ShiftLeft':
        case 'ShiftRight':
          setMoveState(prev => ({ ...prev, sprint: false })); break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [canJump]);

  useFrame((_state, delta) => {
    if (!controlsRef.current?.isLocked) return;

    // Apply friction to horizontal velocity
    velocity.current.x -= velocity.current.x * damping * delta;
    velocity.current.z -= velocity.current.z * damping * delta;

    // Gravity
    velocity.current.y -= gravity * delta;

    // Movement input
    direction.current.set(0, 0, 0);
    if (moveState.forward) direction.current.z -= 1;
    if (moveState.backward) direction.current.z += 1;
    if (moveState.left) direction.current.x -= 1;
    if (moveState.right) direction.current.x += 1;
    direction.current.normalize();

    const speed = (moveState.sprint ? walkSpeed * sprintMultiplier : walkSpeed) * delta;
    
    // Move in camera space
    if (direction.current.z !== 0) controlsRef.current.moveForward(direction.current.z * speed);
    if (direction.current.x !== 0) controlsRef.current.moveRight(direction.current.x * speed);

    // Vertical movement
    const obj = controlsRef.current.getObject();
    obj.position.addScaledVector(new THREE.Vector3(0, 1, 0), velocity.current.y * delta);

    // Ground collision
    const gx = Math.round(obj.position.x);
    const gz = Math.round(obj.position.z);
    const ground = heightAt(gx, gz);
    const minY = ground + playerHeight;

    if (obj.position.y < minY) {
      velocity.current.y = 0;
      obj.position.y = minY;
      setCanJump(true);
    }
  });

  return <PointerLockControls ref={controlsRef} />;
}

// Main App component
function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#87ceeb' }}>
      <Canvas
        camera={{ position: [0, 10, 10], fov: 75 }}
        style={{ background: 'transparent' }}
      >
        {/* Basic lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        {/* Ground plane */}
        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[100, 100]} />
          <meshLambertMaterial color="#4a7c59" />
        </mesh>

        {/* Voxel terrain */}
        <VoxelTerrain />

        {/* Player controller */}
        <PlayerController />

        {/* Test cube */}
        <mesh position={[0, 3, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial color="red" />
        </mesh>
      </Canvas>
    </div>
  );
}

export default App;