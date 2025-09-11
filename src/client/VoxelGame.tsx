import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { connectRealtime } from '@devvit/web/client';
import { PlayerPosition } from '../shared/types/api';
import { TerrainGenerator } from '../shared/core/terrain/TerrainGenerator';
import { defaultGameConfig } from '../shared/config/gameConfig';
import { ChunkManager } from './core/world/ChunkManager';
import { ChunkStreamer } from './core/world/ChunkStreamer';
import { InputManager } from './core/input/InputManager';
import { ThirdPersonController } from './core/player/ThirdPersonController';

function VoxelGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMoveState, setMobileMoveState] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });
  const [mobileRotationState, setMobileRotationState] = useState({
    left: false,
    right: false,
  });
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const [isPostCreator, setIsPostCreator] = useState(false);
  const voxelDataRef = useRef<Map<string, { x: number; y: number; z: number; color: string }>>(new Map());
  const [selectedBlockType, setSelectedBlockType] = useState('grass');
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const selectedBlockTypeRef = useRef(selectedBlockType);
  const addBlockAtPlayerRef = useRef<() => void>(() => {});
  const removeBlockAtPlayerRef = useRef<() => void>(() => {});
  const jumpRef = useRef<() => void>(() => {});
  const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const canJumpRef = useRef<boolean>(false);
  const isMobileRef = useRef<boolean>(false);
  const isPostCreatorRef = useRef<boolean>(false);
  const mobileMoveStateRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });
  const mobileRotationStateRef = useRef({
    left: false,
    right: false,
  });

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev.slice(-4), `[${timestamp}] ${message}`]);
    console.log(message);
  };

  // Joystick handlers
  const handleJoystickStart = (event: React.TouchEvent) => {
    event.preventDefault();
    setIsJoystickActive(true);
    setIsPointerLocked(true);
  };

  const handleJoystickMove = (event: React.TouchEvent) => {
    if (!isJoystickActive || !joystickRef.current) return;
    
    event.preventDefault();
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const touch = event.touches[0];
    if (!touch) return;
    
    const deltaX = touch.clientX - centerX;
    const deltaY = touch.clientY - centerY;
    
    // Limit joystick movement to circle
    const maxDistance = 50;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const limitedDistance = Math.min(distance, maxDistance);
    
    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * limitedDistance;
    const y = Math.sin(angle) * limitedDistance;
    
    setJoystickPosition({ x, y });
    
    // Convert joystick position to movement (inverted for correct direction)
    const forward = y > 5;   // Push down = forward
    const backward = y < -5; // Push up = backward
    const rotateLeft = x < -5;     // Push left = rotate left
    const rotateRight = x > 5;     // Push right = rotate right
    
    const newMoveState = {
      forward,
      backward,
      left: false, // No longer used for movement
      right: false, // No longer used for movement
      sprint: mobileMoveState.sprint
    };
    
    setMobileMoveState(newMoveState);
    mobileMoveStateRef.current = newMoveState;
    
    // Set rotation state for mobile
    const newRotationState = {
      left: rotateLeft,
      right: rotateRight,
    };
    setMobileRotationState(newRotationState);
    mobileRotationStateRef.current = newRotationState;
    
    // Debug logging
    if (forward || backward || rotateLeft || rotateRight) {
      console.log('Joystick movement:', { x, y, forward, backward, rotateLeft, rotateRight });
    }
  };

  const handleJoystickEnd = (event: React.TouchEvent) => {
    event.preventDefault();
    setIsJoystickActive(false);
    setJoystickPosition({ x: 0, y: 0 });
    const newMoveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: mobileMoveState.sprint
    };
    setMobileMoveState(newMoveState);
    mobileMoveStateRef.current = newMoveState;
    
    // Reset rotation state
    const newRotationState = {
      left: false,
      right: false,
    };
    setMobileRotationState(newRotationState);
    mobileRotationStateRef.current = newRotationState;
  };

  // Mobile jump handler
  const handleMobileJump = () => {
    console.log('Mobile jump triggered, canJump:', canJumpRef.current);
    jumpRef.current();
  };

  useEffect(() => {
    selectedBlockTypeRef.current = selectedBlockType;
  }, [selectedBlockType]);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Detect mobile device
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                            ('ontouchstart' in window) || 
                            (navigator.maxTouchPoints > 0);
      console.log('Mobile detection:', {
        userAgent: navigator.userAgent,
        hasTouch: 'ontouchstart' in window,
        maxTouchPoints: navigator.maxTouchPoints,
        isMobile: isMobileDevice
      });
      setIsMobile(isMobileDevice);
      isMobileRef.current = isMobileDevice;
    };
    checkMobile();

    // Check if user is post creator (for now, always true for testing)
    // In a real app, this would check against the actual post data
    const checkPostCreator = () => {
      // TODO: Replace with actual post creator check
      setIsPostCreator(true); // For testing, everyone is a creator
      isPostCreatorRef.current = true; // Set ref immediately
      addDebugLog('Post creator status set to true');
    };
    checkPostCreator();

    const canvas = canvasRef.current;
    
    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    console.log('Scene created successfully');

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 10);
    console.log('Camera created successfully');

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ 
        canvas, 
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for mobile performance
      // Ensure correct output color space for modern Three.js
      if ('outputColorSpace' in renderer && (THREE as any).SRGBColorSpace) {
        (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
      }
      console.log('Renderer created successfully');
    } catch (error) {
      console.error('Error initializing Three.js renderer:', error);
      // Try with basic settings if advanced settings fail
      try {
        renderer = new THREE.WebGLRenderer({ canvas });
        renderer.setSize(window.innerWidth, window.innerHeight);
        console.log('Renderer created with basic settings');
      } catch (fallbackError) {
        console.error('Failed to create renderer even with basic settings:', fallbackError);
        setSceneError('Failed to initialize 3D graphics. Your device may not support WebGL.');
        return;
      }
    }

    // Player physics
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const clock = new THREE.Clock();
    const playerBase = new THREE.Vector3(0, 0, 0);
    let yaw = 0;
    let pitch = 0; // not heavily used; reserved for slight tilt
    
    // Update refs for mobile access
    velocityRef.current = velocity;
    
    let isMouseDown = false;
    // removed unused mouseX/mouseY
    const moveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
    };
    const rotationState = {
      left: false,
      right: false,
    };
    let canJump = false;
    
    // Set up jump function for mobile
    jumpRef.current = () => {
      if (canJump) {
        velocity.y += 12;
        canJump = false;
      }
    };

    // Mobile touch controls
    // removed unused touch start coords
    let lastTouchX = 0;
    let lastTouchY = 0;
    let isTouchActive = false;

    // Block placement/removal
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const placedMeshes: THREE.Mesh[] = [];
    const placedOutlines: THREE.LineSegments[] = [];

    const gravity = defaultGameConfig.controls.gravity;
    const walkSpeed = defaultGameConfig.controls.walkSpeed;
    const sprintMultiplier = defaultGameConfig.controls.sprintMultiplier;
    const damping = defaultGameConfig.controls.damping;
    const cameraDistance = 3.5;
    const cameraHeight = 1.6;

    // Enhanced lighting for better visibility
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = false; // Keep shadows off for performance
    scene.add(dirLight);
    
    // Additional hemisphere light for more even lighting
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a7c59, 0.6);
    scene.add(hemiLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x4a7c59 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.userData = { isGround: true };
    scene.add(ground);
    addDebugLog(`Ground added at ${ground.position.x}, ${ground.position.y}, ${ground.position.z}`);

    // Procedural terrain (Perlin fBm) via ChunkManager
    const terrain = new TerrainGenerator(defaultGameConfig.terrain);
    const chunkManager = new ChunkManager(
      scene,
      terrain,
      defaultGameConfig.chunk,
      defaultGameConfig.render
    );
    // Generate central chunk; follow-ups can stream adjacent chunks
    chunkManager.ensureChunk(0, 0);
    const streamer = new ChunkStreamer(
      chunkManager,
      defaultGameConfig.chunk.sizeX,
      defaultGameConfig.chunk.sizeZ,
      1
    );

    function heightAt(x: number, z: number): number {
      return terrain.heightAt(x, z);
    }

    const input = new InputManager();
    input.attach();
    const controller = new ThirdPersonController(camera, input);
    function resetSpawn() {
      const sx = 0;
      const sz = 0;
      const gy = heightAt(Math.round(sx), Math.round(sz)) + 0.5; // Top surface of terrain blocks
      controller.playerBase.set(sx, gy, sz);
      const camTarget = new THREE.Vector3().copy(controller.playerBase).add(new THREE.Vector3(0, cameraHeight, 0));
      camera.position.copy(new THREE.Vector3(camTarget.x, camTarget.y, camTarget.z + cameraDistance));
      camera.lookAt(camTarget);
    }
    resetSpawn();

    // Block placement/removal functions
    function getBlockKey(x: number, y: number, z: number): string {
      return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    }

    async function persistAddBlock(x: number, y: number, z: number, blockType: string, color: string) {
      try {
        await fetch('/api/blocks/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x, y, z, type: blockType, color }),
        });
      } catch (e) {
        console.warn('persist add block failed', e);
      }
    }

    async function persistRemoveBlock(x: number, y: number, z: number) {
      try {
        await fetch('/api/blocks/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x, y, z }),
        });
      } catch (e) {
        console.warn('persist remove block failed', e);
      }
    }

    function placeBlock(x: number, y: number, z: number, blockType: string, opts?: { color?: string; persist?: boolean }) {
      addDebugLog(`placeBlock called: ${x}, ${y}, ${z}, isPostCreator: ${isPostCreatorRef.current}`);
      
      const key = getBlockKey(x, y, z);
      const colors = {
        grass: '#4a7c59',
        stone: '#8a8a8a',
        wood: '#8b4513',
        sand: '#f4e4bc',
        water: '#4a90e2'
      };
      
      const color = opts?.color || colors[blockType as keyof typeof colors] || colors.grass;
      
      voxelDataRef.current.set(key, { x, y, z, color });
      
      // Create visual block
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshLambertMaterial({ color });
      const block = new THREE.Mesh(geometry, material);
      block.position.set(x, y, z);
      block.userData = { key, isPlaced: true };
      scene.add(block);
      placedMeshes.push(block);
      
      // Add collision outline if enabled
      if (defaultGameConfig.render.showCollisionOutlines) {
        const edges = new THREE.EdgesGeometry(geometry);
        const outline = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 })
        );
        outline.position.copy(block.position);
        scene.add(outline);
        placedOutlines.push(outline);
      }
      
      addDebugLog(`Block created and added to scene at ${x}, ${y}, ${z}`);

      if (opts?.persist !== false) {
        void persistAddBlock(x, y, z, blockType, color);
      }
    }

    function removeBlock(x: number, y: number, z: number, opts?: { persist?: boolean; force?: boolean }) {
      if (!opts?.force && !isPostCreatorRef.current) return;
      
      const key = getBlockKey(x, y, z);
      
      voxelDataRef.current.delete(key);
      
      // Remove visual block and its outline
      const blockToRemove = placedMeshes.find(block => block.userData.key === key);
      if (blockToRemove) {
        scene.remove(blockToRemove);
        const index = placedMeshes.indexOf(blockToRemove);
        if (index > -1) placedMeshes.splice(index, 1);
        
        // Remove corresponding outline
        const outlineToRemove = placedOutlines.find(outline => 
          outline.position.equals(blockToRemove.position)
        );
        if (outlineToRemove) {
          scene.remove(outlineToRemove);
          const outlineIndex = placedOutlines.indexOf(outlineToRemove);
          if (outlineIndex > -1) placedOutlines.splice(outlineIndex, 1);
        }
      }

      if (opts?.persist !== false) {
        void persistRemoveBlock(x, y, z);
      }
    }

    function handleBlockInteraction(event: MouseEvent | TouchEvent) {
      addDebugLog(`Click detected - isPostCreator: ${isPostCreatorRef.current}`);
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      let clientX: number, clientY: number;
      
      if (event instanceof MouseEvent) {
        clientX = event.clientX;
        clientY = event.clientY;
      } else {
        const touch = event.touches[0];
        if (!touch) return;
        clientX = touch.clientX;
        clientY = touch.clientY;
      }
      
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      addDebugLog(`Mouse: ${mouse.x.toFixed(2)}, ${mouse.y.toFixed(2)}`);
      
      raycaster.setFromCamera(mouse, camera);
      
      // Check intersection with existing placed blocks and ground
      const intersects = raycaster.intersectObjects([ground as unknown as THREE.Object3D, ...placedMeshes], false);
      addDebugLog(`Found ${intersects.length} intersections`);
      
      if (intersects.length > 0) {
        const intersected = intersects[0];
        if (intersected) {
          const block = intersected.object as THREE.Mesh;
          
          if (event instanceof MouseEvent) {
            if (event.button === 0) { // Left click - place block adjacent to face
              const face = intersected.face;
              if (face) {
                const normal = face.normal.clone();
                const base = block === ground ? intersected.point.clone() : block.position.clone();
                if (block !== ground) normal.transformDirection(block.matrixWorld);
                const newPos = base.add(normal);
                addDebugLog(`Placing block at ${Math.round(newPos.x)}, ${Math.round(newPos.y)}, ${Math.round(newPos.z)}`);
                placeBlock(Math.round(newPos.x), Math.round(newPos.y), Math.round(newPos.z), selectedBlockTypeRef.current);
              }
            } else if (event.button === 2) { // Right click - remove block
              if (block !== ground) {
                addDebugLog(`Removing block at ${block.position.x}, ${block.position.y}, ${block.position.z}`);
                removeBlock(block.position.x, block.position.y, block.position.z);
              }
            }
          } else {
            // Touch - place block adjacent to face
            const face = intersected.face;
            if (face) {
              const normal = face.normal.clone();
              const base = block === ground ? intersected.point.clone() : block.position.clone();
              if (block !== ground) normal.transformDirection(block.matrixWorld);
              const newPos = base.add(normal);
              addDebugLog(`Touch placing block at ${Math.round(newPos.x)}, ${Math.round(newPos.y)}, ${Math.round(newPos.z)}`);
              placeBlock(Math.round(newPos.x), Math.round(newPos.y), Math.round(newPos.z), selectedBlockTypeRef.current);
            }
          }
        }
      } else {
        // No block hit - place block at ground level
        const groundY = heightAt(Math.round(camera.position.x), Math.round(camera.position.z));
        placeBlock(Math.round(camera.position.x), groundY + 1, Math.round(camera.position.z), selectedBlockTypeRef.current);
      }
    }

    // Expose add/remove helpers for UI buttons
    addBlockAtPlayerRef.current = () => {
      if (!isPostCreatorRef.current) return;
      const x = Math.round(camera.position.x);
      const z = Math.round(camera.position.z);
      const y = heightAt(x, z) + 1;
      placeBlock(x, y, z, selectedBlockTypeRef.current);
    };
    removeBlockAtPlayerRef.current = () => {
      if (!isPostCreatorRef.current) return;
      const x = Math.round(camera.position.x);
      const z = Math.round(camera.position.z);
      const y = heightAt(x, z);
      removeBlock(x, y, z);
    };

    // Terrain geometry is provided by ChunkManager's instanced meshes; we only track placed blocks here

    // Test cube with collision outline
    const testGeo = new THREE.BoxGeometry(1, 1, 1);
    const testMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const testCube = new THREE.Mesh(testGeo, testMat);
    testCube.position.set(0, 3, 0);
    scene.add(testCube);
    
    // Add collision box outline for test cube if enabled
    if (defaultGameConfig.render.showCollisionOutlines) {
      const testCubeEdges = new THREE.EdgesGeometry(testGeo);
      const testCubeLine = new THREE.LineSegments(
        testCubeEdges,
        new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
      );
      testCubeLine.position.copy(testCube.position);
      scene.add(testCubeLine);
    }

    // Player collision box visualization
    let playerCollisionBox: THREE.LineSegments | null = null;
    if (defaultGameConfig.render.showCollisionOutlines) {
      const playerHeight = defaultGameConfig.controls.playerHeight;
      const playerWidth = 0.6; // Approximate player width
      const playerDepth = 0.6; // Approximate player depth
      
      const playerBoxGeo = new THREE.BoxGeometry(playerWidth, playerHeight, playerDepth);
      const playerBoxEdges = new THREE.EdgesGeometry(playerBoxGeo);
      playerCollisionBox = new THREE.LineSegments(
        playerBoxEdges,
        new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 })
      );
      scene.add(playerCollisionBox);
    }

    // Ground collision visualization - show ground height at player position
    let groundCollisionIndicator: THREE.LineSegments | null = null;
    if (defaultGameConfig.render.showCollisionOutlines) {
      const groundBoxGeo = new THREE.BoxGeometry(1, 0.1, 1);
      const groundBoxEdges = new THREE.EdgesGeometry(groundBoxGeo);
      groundCollisionIndicator = new THREE.LineSegments(
        groundBoxEdges,
        new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
      );
      scene.add(groundCollisionIndicator);
    }

    // Terrain wireframe visualization - show actual terrain blocks
    let terrainWireframes: THREE.LineSegments[] = [];
    if (defaultGameConfig.render.showCollisionOutlines) {
      // Create wireframes for a small area around the player
      const wireframeSize = 5; // 5x5 area
      for (let x = -wireframeSize; x <= wireframeSize; x++) {
        for (let z = -wireframeSize; z <= wireframeSize; z++) {
          const terrainHeight = heightAt(x, z);
          if (terrainHeight > 0) {
            const blockGeo = new THREE.BoxGeometry(1, 1, 1);
            const blockEdges = new THREE.EdgesGeometry(blockGeo);
            const blockWireframe = new THREE.LineSegments(
              blockEdges,
              new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 1, transparent: true, opacity: 0.3 })
            );
            blockWireframe.position.set(x, terrainHeight, z); // Position wireframe at bottom of block (same as actual terrain)
            scene.add(blockWireframe);
            terrainWireframes.push(blockWireframe);
          }
        }
      }
    }

    // Mouse look
    function onMouseMove(event: MouseEvent) {
      const isLocked = document.pointerLockElement === canvas;
      if (!isLocked && !isMouseDown) return;
      
      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;
      
      yaw -= movementX * 0.0025;
      pitch -= movementY * 0.0025;
      const maxPitch = Math.PI / 3;
      if (pitch > maxPitch) pitch = maxPitch;
      if (pitch < -maxPitch) pitch = -maxPitch;
    }

    function onMouseDown(event: MouseEvent) {
      if (event.button === 0) {
        isMouseDown = true;
        canvas.requestPointerLock();
        setIsPointerLocked(true);
      }
      // Don't prevent default - let click events work
    }

    function onMouseUp() {
      isMouseDown = false;
    }

    // Mobile touch controls
    function onTouchStart(event: TouchEvent) {
      event.preventDefault();
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        if (touch) {
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
          isTouchActive = true;
          setIsPointerLocked(true);
        }
      }
    }

    function onTouchMove(event: TouchEvent) {
      event.preventDefault();
      if (isTouchActive && event.touches.length === 1) {
        const touch = event.touches[0];
        if (touch) {
          const deltaX = touch.clientX - lastTouchX;
          const deltaY = touch.clientY - lastTouchY;
          
          yaw -= deltaX * 0.003;
          pitch -= deltaY * 0.003;
          const maxPitch = Math.PI / 3;
          if (pitch > maxPitch) pitch = maxPitch;
          if (pitch < -maxPitch) pitch = -maxPitch;
          
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
        }
      }
    }

    function onTouchEnd(event: TouchEvent) {
      event.preventDefault();
      isTouchActive = false;
      setIsPointerLocked(false);
    }


    // Keyboard controls
    function onKeyDown(event: KeyboardEvent) {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          moveState.forward = true; break;
        case 'ArrowLeft':
        case 'KeyA':
          rotationState.left = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          moveState.backward = true; break;
        case 'ArrowRight':
        case 'KeyD':
          rotationState.right = true;
          break;
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

    function onKeyUp(event: KeyboardEvent) {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          moveState.forward = false; break;
        case 'ArrowLeft':
        case 'KeyA':
          rotationState.left = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          moveState.backward = false; break;
        case 'ArrowRight':
        case 'KeyD':
          rotationState.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.sprint = false; break;
      }
    }

    // Physics update
    function updatePhysics(delta: number) {
      // Apply friction to horizontal velocity
      velocity.x -= velocity.x * damping * delta;
      velocity.z -= velocity.z * damping * delta;

      // Gravity
      velocity.y -= gravity * delta;

      // Rotation input - A and D keys now rotate instead of strafe
      const currentRotationState = isMobileRef.current ? mobileRotationStateRef.current : rotationState;
      if (currentRotationState.left) {
        yaw += 2.0 * delta; // Rotate right (A key)
      }
      if (currentRotationState.right) {
        yaw -= 2.0 * delta; // Rotate left (D key)
      }

      // Movement input - use mobile state if on mobile
      const currentMoveState = isMobileRef.current ? mobileMoveStateRef.current : moveState;
      direction.set(0, 0, 0);
      if (currentMoveState.forward) direction.z -= 1;
      if (currentMoveState.backward) direction.z += 1;
      // Removed left/right movement for A/D keys - they now rotate instead
      direction.normalize();
      
      // Debug mobile movement in physics
      if (isMobileRef.current && (currentMoveState.forward || currentMoveState.backward || currentMoveState.left || currentMoveState.right)) {
        console.log('Physics mobile movement:', { 
          forward: currentMoveState.forward, 
          backward: currentMoveState.backward, 
          left: currentMoveState.left, 
          right: currentMoveState.right,
          direction: { x: direction.x, y: direction.y, z: direction.z }
        });
      }

      // Delegate movement to controller (keeping mobile support outside for now)
      controller.yaw = yaw;
      controller.pitch = pitch;
      controller.updatePhysics(
        delta,
        { gravity, walkSpeed, sprintMultiplier, damping, cameraDistance, cameraHeight, playerHeight: defaultGameConfig.controls.playerHeight, canJumpRef },
        velocity,
        heightAt
      );
      // Sync back yaw/pitch for UI/inputs that still use local yaw/pitch
      yaw = controller.yaw;
      pitch = controller.pitch;

      // Update self avatar position
      if (selfGroup) selfGroup.position.copy(controller.playerBase);
      
      // Update player collision box visualization
      if (playerCollisionBox) {
        playerCollisionBox.position.copy(controller.playerBase);
        playerCollisionBox.position.y += defaultGameConfig.controls.playerHeight / 2; // Center the box on the player (playerBase is at feet)
      }
      
      // Update ground collision indicator
      if (groundCollisionIndicator) {
        const gx = Math.round(controller.playerBase.x);
        const gz = Math.round(controller.playerBase.z);
        const groundY = heightAt(gx, gz) + 0.5; // Top surface of terrain blocks
        groundCollisionIndicator.position.set(gx, groundY, gz);
        
        // Debug: log the collision values
        console.log(`Collision debug: playerBase.y=${controller.playerBase.y.toFixed(2)}, ground=${heightAt(gx, gz)}, surface=${groundY}`);
      }
    }

    // Remote players state
    const remotePlayers = new Map<string, THREE.Group>();
    let selfGroup: THREE.Group | null = null;
    let selfUsername: string | null = null;
    let postId: string | null = null;
    let realtimeConnection: { disconnect: () => Promise<void> } | null = null;
    let posInterval: number | null = null;
    let presencePollInterval: number | null = null;
    let blocksPollInterval: number | null = null;

    function hashColorFromString(str: string): number {
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
      const hue = Math.abs(hash) % 360;
      const color = new THREE.Color().setHSL(hue / 360, 0.6, 0.5);
      return color.getHex();
    }

    function makeNameSprite(name: string): THREE.Sprite {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d ctx');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 4;
      const pad = 8;
      const w = canvas.width - pad * 2;
      const h = canvas.height - pad * 2;
      ctx.beginPath();
      ctx.roundRect(pad, pad, w, h, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, canvas.width / 2, canvas.height / 2);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.6, 0.8, 1);
      sprite.position.set(0, 1.1, 0);
      return sprite;
    }

    function addOrUpdateRemote(user: string, position: PlayerPosition): void {
      if (user === selfUsername) return;
      let group = remotePlayers.get(user);
      if (!group) {
        group = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 20, 20),
          new THREE.MeshLambertMaterial({ color: hashColorFromString(user) })
        );
        body.position.set(0, 0.4, 0);
        const label = makeNameSprite(user);
        group.add(body);
        group.add(label);
        scene.add(group);
        remotePlayers.set(user, group);
      }
      group.position.set(position.x, position.y, position.z);
    }

    function removeRemote(user: string): void {
      const group = remotePlayers.get(user);
      if (group) {
        scene.remove(group);
        remotePlayers.delete(user);
      }
    }

    function getPlayerPosition(): PlayerPosition {
      return { x: playerBase.x, y: playerBase.y, z: playerBase.z, yaw };
    }

    async function initRealtime(): Promise<void> {
      try {
        const initRes = await fetch('/api/init');
        const initData = await initRes.json();
        selfUsername = initData.username as string;
        postId = initData.postId as string;

        // Load existing presence
        try {
          const pr = await fetch('/api/presence');
          const pdata = await pr.json();
          const players = (pdata.players ?? []) as { user: string; position: PlayerPosition }[];
          players.forEach((p) => addOrUpdateRemote(p.user, p.position));
        } catch (e) {
          console.warn('presence fetch failed', e);
        }

        // Create local self avatar
        if (selfUsername && !selfGroup) {
          selfGroup = new THREE.Group();
          const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 20, 20),
            new THREE.MeshLambertMaterial({ color: hashColorFromString(selfUsername) })
          );
          body.position.set(0, 0.4, 0);
          const label = makeNameSprite(selfUsername);
          selfGroup.add(body);
          selfGroup.add(label);
          selfGroup.position.copy(playerBase);
          scene.add(selfGroup);
        }

        // Join
        await fetch('/api/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: getPlayerPosition() }),
        });

        // Realtime connect (with CORS error handling)
        if (!postId) return;
        try {
          realtimeConnection = await connectRealtime({
            channel: `game:${postId}`,
            onConnect: () => addDebugLog('Realtime connected'),
            onDisconnect: () => addDebugLog('Realtime disconnected'),
            onMessage: (data: any) => {
              if (!data || typeof data !== 'object') return;
              if (data.type === 'join') addOrUpdateRemote(data.user, data.position);
              else if (data.type === 'pos') addOrUpdateRemote(data.user, data.position);
              else if (data.type === 'leave') removeRemote(data.user);
            },
          });
          addDebugLog('Realtime connection established');
        } catch (error) {
          addDebugLog(`Realtime failed: ${error}`);
          console.warn('Realtime connection failed:', error);
        }

        // Periodic position updates
        posInterval = window.setInterval(async () => {
          try {
            await fetch('/api/pos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ position: getPlayerPosition() }),
            });
          } catch (_) {}
        }, 125);

        // Fallback presence polling (in case realtime is unavailable)
        presencePollInterval = window.setInterval(async () => {
          try {
            const pr2 = await fetch('/api/presence');
            const pdata2 = await pr2.json();
            const players2 = (pdata2.players ?? []) as { user: string; position: PlayerPosition }[];
            players2.forEach((p) => addOrUpdateRemote(p.user, p.position));
          } catch (_) {}
        }, 2000);

        // Leave on unload
        const leave = async () => {
          try {
            await fetch('/api/leave', { method: 'POST' });
          } catch (_) {}
        };
        window.addEventListener('beforeunload', leave);
      } catch (e) {
        console.error('realtime init failed', e);
      }
    }

    async function loadPersistedBlocks(): Promise<void> {
      try {
        const res = await fetch('/api/blocks');
        const data = await res.json();
        const blocks = (data?.blocks ?? []) as { x: number; y: number; z: number; type?: string; color?: string }[];
        const serverKeys = new Set(blocks.map((b) => getBlockKey(b.x, b.y, b.z)));

        // Add missing blocks from server
        for (const b of blocks) {
          const key = getBlockKey(b.x, b.y, b.z);
          const already = placedMeshes.find((m) => m.userData.isPlaced && m.userData.key === key);
          if (!already) {
            const options = b.color ? { color: b.color, persist: false } : { persist: false };
            placeBlock(Math.floor(b.x), Math.floor(b.y), Math.floor(b.z), (b.type ?? 'grass'), options as { color?: string; persist?: boolean });
          }
        }

        // Remove local blocks that server no longer has
        const localPlacedKeys = new Set(
          placedMeshes.filter((m) => m.userData.isPlaced).map((m) => m.userData.key as string)
        );
        for (const key of localPlacedKeys) {
          if (!serverKeys.has(key)) {
            const parts = key.split(',');
            const sx = parseInt(parts[0] ?? '0', 10);
            const sy = parseInt(parts[1] ?? '0', 10);
            const sz = parseInt(parts[2] ?? '0', 10);
            removeBlock(sx, sy, sz, { persist: false, force: true });
          }
        }
      } catch (e) {
        console.warn('Failed to load persisted blocks', e);
      }
    }

    // Animation
    function animate() {
      requestAnimationFrame(animate);
      const delta = Math.min(0.05, clock.getDelta());
      updatePhysics(delta);
      // Stream chunks around player base
      streamer.ensureAroundWorld(controller.playerBase.x, controller.playerBase.z);
      renderer.render(scene, camera);
    }
    
    console.log('Starting animation loop');
    animate();

    // Initialize blocks from post data and set up polling for sync
    void loadPersistedBlocks();
    blocksPollInterval = window.setInterval(() => { void loadPersistedBlocks(); }, 3000);

    // Initialize realtime multiplayer (postId/username + presence + realtime)
    initRealtime();

    // Event listeners
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    canvas.addEventListener('touchend', onTouchEnd);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    
    // Block interaction listeners
    canvas.addEventListener('click', (e) => {
      addDebugLog('Click event received on canvas');
      handleBlockInteraction(e);
    });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      addDebugLog('Right click event received on canvas');
      handleBlockInteraction(e);
    });
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        addDebugLog('Touch event received on canvas');
        handleBlockInteraction(e);
      }
    });

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', handleResize);
      if (posInterval) window.clearInterval(posInterval);
      if (presencePollInterval) window.clearInterval(presencePollInterval);
      if (blocksPollInterval) window.clearInterval(blocksPollInterval);
      if (realtimeConnection) realtimeConnection.disconnect().catch(() => {});
      input.detach();
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Error fallback */}
      {sceneError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          textAlign: 'center',
          zIndex: 1000,
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          background: 'rgba(0,0,0,0.8)',
          padding: '20px',
          borderRadius: '10px',
          maxWidth: '300px'
        }}>
          <h2>⚠️ Graphics Error</h2>
          <p>{sceneError}</p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>
            Device: {isMobile ? 'mobile' : 'PC'}
          </p>
        </div>
      )}

      {!isPointerLocked && !isMobile && !sceneError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          textAlign: 'center',
          zIndex: 1000,
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          background: 'rgba(0,0,0,0.5)',
          padding: '20px',
          borderRadius: '10px'
        }}>
          <h1>Voxel Game</h1>
          <p>Click to start playing</p>
          <p>W/S to move • A/D to rotate • Space to jump • Shift to sprint</p>
        </div>
      )}

      {/* Device type indicator */}
      {!sceneError && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          color: 'white',
          textAlign: 'center',
          zIndex: 1000,
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          background: 'rgba(0,0,0,0.7)',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 'bold'
        }}>
          {isMobile ? 'mobile' : 'PC'}
        </div>
      )}

      {/* Debug logs */}
      {!sceneError && debugLogs.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          color: 'white',
          zIndex: 1000,
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
          background: 'rgba(0,0,0,0.8)',
          padding: '10px',
          borderRadius: '8px',
          fontSize: '12px',
          fontFamily: 'monospace',
          maxWidth: '400px',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Debug Logs:</div>
          {debugLogs.map((log, index) => (
            <div key={index} style={{ marginBottom: '2px', opacity: 0.9 }}>
              {log}
            </div>
          ))}
        </div>
      )}

      {isMobile && !sceneError && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          textAlign: 'center',
          zIndex: 1000,
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          background: 'rgba(0,0,0,0.5)',
          padding: '10px 20px',
          borderRadius: '10px'
        }}>
          <h2>Voxel Game</h2>
          <p>Touch and drag to look • Use joystick to move and rotate</p>
          {isPostCreator && <p style={{ color: '#4CAF50', fontWeight: 'bold' }}>✏️ Creator Mode - Tap blocks to edit</p>}
          
          {/* Debug mobile movement state */}
          <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.7 }}>
            Movement: {mobileMoveState.forward ? 'W' : ''}{mobileMoveState.backward ? 'S' : ''}
            {mobileRotationState.left ? 'A(rot)' : ''}{mobileRotationState.right ? 'D(rot)' : ''}
            {!mobileMoveState.forward && !mobileMoveState.backward && !mobileRotationState.left && !mobileRotationState.right && 'None'}
            {mobileMoveState.sprint && ' (Sprint)'}
          </div>
        </div>
      )}

      {/* Desktop creator controls */}
      {!isMobile && isPostCreator && !sceneError && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          color: 'white',
          zIndex: 1000,
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          background: 'rgba(0,0,0,0.7)',
          padding: '15px',
          borderRadius: '10px',
          minWidth: '200px'
        }}>
          <h3 style={{ color: '#4CAF50', margin: '0 0 10px 0' }}>✏️ Creator Mode</h3>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Left click: Remove block<br/>Right click: Place block</p>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Block Type:</label>
            <select 
              value={selectedBlockType} 
              onChange={(e) => setSelectedBlockType(e.target.value)}
              style={{
                width: '100%',
                padding: '5px',
                borderRadius: '5px',
                border: '1px solid #ccc',
                background: 'white',
                color: 'black'
              }}
            >
              <option value="grass">Grass</option>
              <option value="stone">Stone</option>
              <option value="wood">Wood</option>
              <option value="sand">Sand</option>
              <option value="water">Water</option>
            </select>
          </div>
          
          <div style={{ 
            padding: '8px', 
            background: 'rgba(76, 175, 80, 0.2)', 
            borderRadius: '5px',
            fontSize: '12px',
            border: '1px solid #4CAF50'
          }}>
            Selected: <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{selectedBlockType}</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              onClick={() => addBlockAtPlayerRef.current()}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              + Add Block
            </button>
            <button
              onClick={() => removeBlockAtPlayerRef.current()}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              - Remove
            </button>
          </div>
        </div>
      )}

      {/* Mobile creator controls */}
      {isMobile && isPostCreator && !sceneError && (
        <div style={{
          position: 'absolute',
          top: '80px',
          right: '20px',
          color: 'white',
          zIndex: 1000,
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          background: 'rgba(0,0,0,0.7)',
          padding: '10px',
          borderRadius: '10px',
          minWidth: '150px'
        }}>
          <h4 style={{ color: '#4CAF50', margin: '0 0 8px 0', fontSize: '14px' }}>✏️ Creator</h4>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>Tap blocks to edit</p>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '3px', fontSize: '12px' }}>Block:</label>
            <select 
              value={selectedBlockType} 
              onChange={(e) => setSelectedBlockType(e.target.value)}
              style={{
                width: '100%',
                padding: '3px',
                borderRadius: '3px',
                border: '1px solid #ccc',
                background: 'white',
                color: 'black',
                fontSize: '12px'
              }}
            >
              <option value="grass">Grass</option>
              <option value="stone">Stone</option>
              <option value="wood">Wood</option>
              <option value="sand">Sand</option>
              <option value="water">Water</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onTouchStart={() => addBlockAtPlayerRef.current()}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 'bold',
                touchAction: 'none'
              }}
            >
              + Add
            </button>
            <button
              onTouchStart={() => removeBlockAtPlayerRef.current()}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 'bold',
                touchAction: 'none'
              }}
            >
              - Remove
            </button>
          </div>
        </div>
      )}
      
      {/* Crosshair hidden for third-person */}
      {false && isPointerLocked && !isMobile && !sceneError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '20px',
          height: '20px',
          border: '2px solid white',
          borderRadius: '50%',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '2px',
            height: '10px',
            background: 'white'
          }}></div>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '10px',
            height: '2px',
            background: 'white'
          }}></div>
        </div>
      )}

      {/* Mobile joystick and controls - always visible on mobile */}
      {isMobile && !sceneError && (
        <>
          {/* Virtual Joystick */}
          <div
            ref={joystickRef}
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
            style={{
              position: 'absolute',
              bottom: '30px',
              left: '30px',
              width: '120px',
              height: '120px',
              background: 'rgba(255,255,255,0.2)',
              border: '3px solid rgba(255,255,255,0.5)',
              borderRadius: '50%',
              zIndex: 1000,
              touchAction: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Joystick knob */}
            <div
              style={{
                width: '40px',
                height: '40px',
                background: 'rgba(255,255,255,0.8)',
                border: '2px solid white',
                borderRadius: '50%',
                transform: `translate(${joystickPosition.x}px, ${joystickPosition.y}px)`,
                transition: isJoystickActive ? 'none' : 'transform 0.2s ease',
                pointerEvents: 'none'
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{
            position: 'absolute',
            bottom: '30px',
            right: '30px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            <button
              onTouchStart={handleMobileJump}
              style={{
                background: 'rgba(255,255,255,0.3)',
                border: '3px solid rgba(255,255,255,0.6)',
                borderRadius: '50%',
                color: 'white',
                width: '60px',
                height: '60px',
                fontSize: '14px',
                fontWeight: 'bold',
                touchAction: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              JUMP
            </button>
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                const newState = { ...mobileMoveState, sprint: true };
                setMobileMoveState(newState);
                mobileMoveStateRef.current = newState;
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                const newState = { ...mobileMoveState, sprint: false };
                setMobileMoveState(newState);
                mobileMoveStateRef.current = newState;
              }}
              style={{
                background: 'rgba(255,255,255,0.3)',
                border: '3px solid rgba(255,255,255,0.6)',
                borderRadius: '50%',
                color: 'white',
                width: '60px',
                height: '60px',
                fontSize: '12px',
                fontWeight: 'bold',
                touchAction: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              SPRINT
            </button>
          </div>
        </>
      )}
      
      {!sceneError && <canvas ref={canvasRef} style={{ display: 'block' }} />}
    </div>
  );
}

export default VoxelGame;
