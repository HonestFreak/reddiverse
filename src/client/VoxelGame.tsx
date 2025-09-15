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
import { BlockFactory } from './core/blocks/BlockFactory';
import { defaultBlockTypes, type BlockTypeRegistry } from '../shared/types/BlockTypes';
import type { SmartBlocksResponse, SmartBlockDefinition } from '../shared/types/SmartBlocks';
import { getTerrainParamsForPreset, presetSurfaceBlockId } from '../shared/types/WorldConfig';
import { SpecialBlocksManager } from './core/blocks/special/SpecialBlocksManager';
import { LightBlock } from './core/blocks/special/LightBlock';
import { JumperBlock } from './core/blocks/special/JumperBlock';
import { WaterBlock } from './core/blocks/special/WaterBlock';
import { SkyManager } from './core/sky/SkyManager';
import { TimeManager } from './core/sky/TimeManager';
import StartOverlay from './ui/overlays/StartOverlay';
import ErrorOverlay from './ui/overlays/ErrorOverlay';
import WorldInfo from './ui/overlays/WorldInfo';
import DebugLog from './ui/overlays/DebugLog';
import PlayerStatusDesktop from './ui/panels/PlayerStatusDesktop';
import PlayerStatusMobile from './ui/panels/PlayerStatusMobile';
// Creator panels deprecated; kept imports removed to avoid bundle size
import MobileControls from './ui/controls/MobileControls';
import BuilderManagementModal from './ui/modals/BuilderManagementModal';
import SmartBlockCreateModal from './ui/modals/SmartBlockCreateModal';

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
  const [canBuild, setCanBuild] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [worldConfig, setWorldConfig] = useState<{ worldName: string; buildingPermission: 'public' | 'restricted'; builders: string[]; owner: string } | null>(null);
  const [showBuilderManagement, setShowBuilderManagement] = useState(false);
  const [builderInput, setBuilderInput] = useState('');
  const voxelDataRef = useRef<Map<string, { x: number; y: number; z: number; color: string }>>(new Map());
  const [selectedBlockType, setSelectedBlockType] = useState('grass');
  const [allBlockTypes, setAllBlockTypes] = useState<BlockTypeRegistry>(defaultBlockTypes);
  const smartDefsRef = useRef<SmartBlockDefinition[]>([]);
  const [showSmartCreate, setShowSmartCreate] = useState(false);
  const [playerState, setPlayerState] = useState({ life: 100, isWinner: false, badge: '' });
  const [smartCreateStatus, setSmartCreateStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [smartForm, setSmartForm] = useState<{
    name: string;
    side: { type: 'color' | 'image'; value: string } | null;
    top: { type: 'color' | 'image'; value: string } | null;
    bottom: { type: 'color' | 'image'; value: string } | null;
    onClick: string;
    onTouch: string;
  }>({ name: '', side: null, top: null, bottom: null, onClick: '', onTouch: '' });
  const skyManagerRef = useRef<SkyManager | null>(null);
  const blockFactoryRef = useRef<BlockFactory | null>(null);
  const specialManagerRef = useRef<SpecialBlocksManager | null>(null);
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

  const addBuilder = async () => {
    if (!builderInput.trim() || !worldConfig) return;
    
    const newBuilder = builderInput.trim();
    if (worldConfig.builders.includes(newBuilder)) {
      addDebugLog('Builder already exists');
      return;
    }
    
    try {
      const res = await fetch('/api/update-builders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ builders: [...worldConfig.builders, newBuilder] }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setWorldConfig({ ...worldConfig, builders: data.builders });
        setBuilderInput('');
        addDebugLog(`Added builder: ${newBuilder}`);
      } else {
        const error = await res.json();
        addDebugLog(`Failed to add builder: ${error.message}`);
      }
    } catch (e) {
      addDebugLog(`Failed to add builder: ${e}`);
    }
  };

  const removeBuilder = async (builder: string) => {
    if (!worldConfig) return;
    
    try {
      const res = await fetch('/api/update-builders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ builders: worldConfig.builders.filter(b => b !== builder) }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setWorldConfig({ ...worldConfig, builders: data.builders });
        addDebugLog(`Removed builder: ${builder}`);
      } else {
        const error = await res.json();
        addDebugLog(`Failed to remove builder: ${error.message}`);
      }
    } catch (e) {
      addDebugLog(`Failed to remove builder: ${e}`);
    }
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
    const run = async () => {
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

    // Load world config and check permissions
    const loadWorldConfig = async () => {
      try {
        const res = await fetch('/api/world-config');
        if (res.ok) {
          const config = await res.json();
          setWorldConfig(config);
          addDebugLog(`World loaded: ${config.worldName} (${config.buildingPermission})`);
        }
      } catch (e) {
        console.warn('Failed to load world config', e);
      }
    };

    const checkPermissions = async () => {
      try {
        const res = await fetch('/api/can-build');
        if (res.ok) {
          const data = await res.json();
          setCanBuild(data.canBuild);
          setIsOwner(data.isOwner);
          setIsPostCreator(data.canBuild); // Use canBuild for creator status
          isPostCreatorRef.current = data.canBuild;
          addDebugLog(`Permissions: canBuild=${data.canBuild}, isOwner=${data.isOwner}`);
        }
      } catch (e) {
        console.warn('Failed to check permissions', e);
        // Default to allowing building for backward compatibility
        setCanBuild(true);
        setIsPostCreator(true);
        isPostCreatorRef.current = true;
      }
    };

    loadWorldConfig();
    checkPermissions();

    const canvas = canvasRef.current;
    
    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    // Add distance fog to blend far terrain into the sky color
    scene.fog = new THREE.Fog(0x87ceeb, 120, 350);
    console.log('Scene created successfully');

    // Initialize sky system
    const skyMgr = new SkyManager(scene);
    const timeMgr = new TimeManager({
      // No need for timeScale or cycleDuration - using real-world time sync
      startTime: 0.5, // This will be overridden by real-world time
    });
    skyManagerRef.current = skyMgr;
    console.log('Sky system initialized');

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
        velocity.y += 18;
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
    const placedCollisionBoxes: THREE.LineSegments[] = [];
    let specialManager: SpecialBlocksManager | null = null;

    const gravity = defaultGameConfig.controls.gravity;
    const walkSpeed = defaultGameConfig.controls.walkSpeed;
    const sprintMultiplier = defaultGameConfig.controls.sprintMultiplier;
    const damping = defaultGameConfig.controls.damping;
    const cameraDistance = 3.5;
    const cameraHeight = 1.6;

    // Enhanced lighting for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    ambientLight.name = 'ambientLight';
    scene.add(ambientLight);
    
    // Additional hemisphere light for more even lighting
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a7c59, 0.6);
    scene.add(hemiLight);

    

    // Fetch world config (terrain preset + seed) from server
    let worldConfig: { terrainType: 'greenery' | 'desert' | 'mountains'; seed: number } | null = null;
    try {
      const wcRes = await fetch('/api/world-config');
      if (wcRes.ok) {
        worldConfig = await wcRes.json();
      }
    } catch (_) {}

    const terrainParams = getTerrainParamsForPreset(
      (worldConfig?.terrainType ?? 'greenery'),
      (worldConfig?.seed ?? defaultGameConfig.terrain.seed)
    );
    // Procedural terrain (Perlin fBm) via ChunkManager using preset params
    const terrain = new TerrainGenerator(terrainParams);
    const surfaceBlockId = presetSurfaceBlockId(worldConfig?.terrainType ?? 'greenery');
    // Snow only at the very top of mountains: dynamic threshold near max height
    const snowOverlayCfg = (worldConfig?.terrainType === 'mountains')
      ? {
          threshold: Math.max(
            Math.floor(terrainParams.heightScale - 3),
            Math.floor(terrainParams.heightScale * 0.8)
          ),
          depth: 2,
          blockId: 'snow',
        }
      : undefined;
    const chunkManager = new ChunkManager(
      scene,
      terrain,
      defaultGameConfig.chunk,
      defaultGameConfig.render,
      allBlockTypes,
      surfaceBlockId,
      snowOverlayCfg
    );
    
    // Create block factory for placing individual blocks
    const blockFactory = new BlockFactory(allBlockTypes);
    blockFactoryRef.current = blockFactory;
    
    // Generate central chunk; follow-ups can stream adjacent chunks
    void chunkManager.ensureChunk(0, 0);
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

    async function placeBlock(
      x: number,
      y: number,
      z: number,
      blockType: string,
      opts?: { color?: string; persist?: boolean; userData?: Record<string, unknown> }
    ) {
      addDebugLog(`placeBlock called: ${x}, ${y}, ${z}, isPostCreator: ${isPostCreatorRef.current}`);
      
      const key = getBlockKey(x, y, z);
      
      // Get block type info for fallback color
      const blockTypeInfo = defaultBlockTypes[blockType];
      const fallbackColor = blockTypeInfo?.fallbackColor || '#4a7c59';
      const color = opts?.color || fallbackColor;
      
      voxelDataRef.current.set(key, { x, y, z, color });
      
      try {
        // Create visual block using block factory
        const position = new THREE.Vector3(x, y, z);
        const result = await blockFactory.createBlock(blockType, position, {
          showCollisionOutlines: defaultGameConfig.render.showCollisionOutlines,
          collisionOutlineColor: 0x00ff00
        });
        
        const block = result.mesh;
        block.userData = { ...(block.userData || {}), key, isPlaced: true, ...(opts?.userData || {}) };
        scene.add(block);
        placedMeshes.push(block);
        if (specialManager) specialManager.onBlockPlaced(block, blockType);
        
        // Add collision outlines if they exist
        if (result.collisionOutlines) {
          result.collisionOutlines.forEach(outline => {
            scene.add(outline);
            placedOutlines.push(outline);
          });
        }
        
        addDebugLog(`Block created and added to scene at ${x}, ${y}, ${z}`);

        if (opts?.persist !== false) {
          void persistAddBlock(x, y, z, blockType, color);
        }
      } catch (error) {
        console.error('Failed to create block:', error);
        addDebugLog(`Failed to create block at ${x}, ${y}, ${z}: ${error}`);
      }
    }

    function removeBlock(x: number, y: number, z: number, opts?: { persist?: boolean; force?: boolean }) {
      if (!opts?.force && !isPostCreatorRef.current) return;
      
      const key = getBlockKey(x, y, z);
      
      voxelDataRef.current.delete(key);
      
      // Remove visual block and its outline
      const blockToRemove = placedMeshes.find(block => block.userData.key === key);
      if (blockToRemove) {
        if (specialManager) specialManager.onBlockRemoved(blockToRemove);
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
        
        // Remove corresponding collision box
        const collisionBoxToRemove = placedCollisionBoxes.find(collisionBox => 
          collisionBox.position.equals(blockToRemove.position)
        );
        if (collisionBoxToRemove) {
          scene.remove(collisionBoxToRemove);
          const collisionBoxIndex = placedCollisionBoxes.indexOf(collisionBoxToRemove);
          if (collisionBoxIndex > -1) placedCollisionBoxes.splice(collisionBoxIndex, 1);
        }
      }

      if (opts?.persist !== false) {
        void persistRemoveBlock(x, y, z);
      }
    }

    // Occupancy helper (for water flow and interactions)
    function isOccupiedCell(x: number, y: number, z: number): boolean {
      const rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      // Placed blocks occupancy
      for (const m of placedMeshes) {
        if (Math.round(m.position.x) === rx && Math.round(m.position.y) === ry && Math.round(m.position.z) === rz) {
          return true;
        }
      }
      // Terrain occupancy: any cell at or below surface height
      const h = heightAt(rx, rz);
      if (ry <= h) return true;
      // Foliage solid cells
      const fc = chunkManager.getFoliageCollisionCells();
      if (fc && fc.has(`${rx},${ry},${rz}`)) return true;
      return false;
    }

    function isSolidCell(x: number, y: number, z: number): boolean {
      const rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      // Placed block solidity: water is non-solid
      for (const m of placedMeshes) {
        if (Math.round(m.position.x) === rx && Math.round(m.position.y) === ry && Math.round(m.position.z) === rz) {
          return m.userData.blockType !== 'water';
        }
      }
      // Terrain is solid
      const h = heightAt(rx, rz);
      if (ry <= h) return true;
      // Foliage cells are solid
      const fc = chunkManager.getFoliageCollisionCells();
      if (fc && fc.has(`${rx},${ry},${rz}`)) return true;
      return false;
    }

    // Initialize special blocks manager and register behaviors
    const specialCtx = {
      scene,
      getPlayerBase: () => controller.playerBase,
      getVelocity: () => velocity,
      addUpwardImpulse: (impulse: number) => { velocity.y += impulse; },
      heightAt: (x: number, z: number) => heightAt(x, z),
      isOccupied: (x: number, y: number, z: number) => isOccupiedCell(x, y, z),
      isSolid: (x: number, y: number, z: number) => isSolidCell(x, y, z),
      placeBlock: async (x: number, y: number, z: number, type: string, extras?: { userData?: Record<string, unknown>; persist?: boolean }) => {
        await placeBlock(x, y, z, type, { persist: extras?.persist ?? false });
      },
      removeBlock: (x: number, y: number, z: number) => removeBlock(x, y, z, { persist: false, force: true }),
      persistBlock: async (x: number, y: number, z: number, type: string, color?: string) => {
        const blockTypeInfo = defaultBlockTypes[type];
        const fallbackColor = color || blockTypeInfo?.fallbackColor || '#4a7c59';
        await persistAddBlock(x, y, z, type, fallbackColor);
      },
    };
    specialManager = new SpecialBlocksManager(specialCtx);
    specialManagerRef.current = specialManager;
    specialManager.register('light', (ctx, _mesh) => new LightBlock(ctx));
    specialManager.register('jumper', (ctx, _mesh) => new JumperBlock(ctx));
    specialManager.register('water', (ctx, _mesh) => new WaterBlock(ctx));
    // Smart blocks will be registered dynamically below

    async function handleBlockInteraction(event: MouseEvent | TouchEvent) {
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
      
      // Get all terrain meshes for raycasting
      const allTerrainMeshes = chunkManager.getAllTerrainMeshes();
      
      // Check intersection with existing placed blocks and terrain
      const intersects = raycaster.intersectObjects([...placedMeshes, ...allTerrainMeshes], false);
      addDebugLog(`Found ${intersects.length} intersections`);
      
      if (intersects.length > 0) {
        const intersected = intersects[0];
        if (intersected) {
          const block = intersected.object as THREE.Mesh | THREE.InstancedMesh;
          const isTerrain = allTerrainMeshes.includes(block as THREE.InstancedMesh);
          
          if (event instanceof MouseEvent) {
            if (event.button === 0) { // Left click - place block adjacent to face
              const face = intersected.face;
              if (face) {
                const normal = face.normal.clone();
                // Transform normal to world space for all objects
                normal.transformDirection(block.matrixWorld);
                let base: THREE.Vector3;
                let offsetScalar = 1.0;

                if (isTerrain) {
                  // Use the intersection point for ground/terrain and half-block offset
                  base = intersected.point.clone();
                  offsetScalar = 0.5;
                } else {
                  // For placed blocks, use block center position and full-block offset
                  base = (block as THREE.Mesh).position.clone();
                  offsetScalar = 1.0;
                }

                const newPos = base.add(normal.multiplyScalar(offsetScalar));
                addDebugLog(`Placing block at ${Math.round(newPos.x)}, ${Math.round(newPos.y)}, ${Math.round(newPos.z)}`);
                placeBlock(Math.round(newPos.x), Math.round(newPos.y), Math.round(newPos.z), selectedBlockTypeRef.current);
              }
            } else if (event.button === 2) { // Right click - remove block
              if (!isTerrain) {
                addDebugLog(`Removing block at ${block.position.x}, ${block.position.y}, ${block.position.z}`);
                removeBlock(block.position.x, block.position.y, block.position.z);
              }
            }
          } else {
            // Touch - place block adjacent to face
            const face = intersected.face;
            if (face) {
              const normal = face.normal.clone();
              // Transform normal to world space for all objects
              normal.transformDirection(block.matrixWorld);
              let base: THREE.Vector3;
              let offsetScalar = 1.0;

              if (isTerrain) {
                // Use the intersection point for ground/terrain and half-block offset
                base = intersected.point.clone();
                offsetScalar = 0.5;
              } else {
                // For placed blocks, use block center position and full-block offset
                base = (block as THREE.Mesh).position.clone();
                offsetScalar = 1.0;
              }

              const newPos = base.add(normal.multiplyScalar(offsetScalar));
              addDebugLog(`Touch placing block at ${Math.round(newPos.x)}, ${Math.round(newPos.y)}, ${Math.round(newPos.z)}`);
              placeBlock(Math.round(newPos.x), Math.round(newPos.y), Math.round(newPos.z), selectedBlockTypeRef.current);
            }
          }
          // Trigger onClick for smart block if the target is a placed smart block
          if (!isTerrain) {
            const typeId = (block as any).userData?.blockType as string | undefined;
            if (typeId && smartDefsRef.current.some((d) => d.id === typeId)) {
              const inst = (specialManager as any)?.instances?.get((block as any).uuid);
              if (inst && typeof inst.click === 'function') {
                await inst.click();
              }
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

    // Player collision sphere visualization
    let playerCollisionBox: THREE.LineSegments | null = null;
    if (defaultGameConfig.render.showCollisionOutlines) {
      const playerRadius = 0.4; // Match the actual player sphere radius
      
      const playerSphereGeo = new THREE.SphereGeometry(playerRadius, 16, 12);
      const playerSphereEdges = new THREE.EdgesGeometry(playerSphereGeo);
      playerCollisionBox = new THREE.LineSegments(
        playerSphereEdges,
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
            velocity.y += 18;
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
        heightAt,
        placedMeshes.filter((m) => m.userData.blockType !== 'water'),
        streamer ? chunkManager.getFoliageCollisionCells() : undefined
      );
      // Sync back yaw/pitch for UI/inputs that still use local yaw/pitch
      yaw = controller.yaw;
      pitch = controller.pitch;

      // Update self avatar position
      if (selfGroup) selfGroup.position.copy(controller.playerBase);
      
      // Update self shadow position (always at ground level)
      if (selfShadow) {
        const gx = Math.round(controller.playerBase.x);
        const gz = Math.round(controller.playerBase.z);
        const groundY = heightAt(gx, gz) + 0.5; // Top surface of terrain blocks
        selfShadow.position.set(controller.playerBase.x, groundY + 0.01, controller.playerBase.z);
      }
      
      // Update player collision sphere visualization
      if (playerCollisionBox) {
        playerCollisionBox.position.copy(controller.playerBase);
        playerCollisionBox.position.y += 0.4; // Center the sphere on the player (playerBase is at feet, sphere radius is 0.4)
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
    let selfShadow: THREE.Mesh | null = null;
    let selfUsername: string | null = null;
    let postId: string | null = null;
    let realtimeConnection: { disconnect: () => Promise<void> } | null = null;
    let posInterval: number | null = null;
    let presencePollInterval: number | null = null;
    let blocksPollInterval: number | null = null;
    let playerStatePollInterval: number | null = null;

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
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d ctx');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Remove background box - just draw the text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, canvas.width / 2, canvas.height / 2);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.0, 0.5, 1);
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
        
        // Create player shadow
        const shadowGeometry = new THREE.CircleGeometry(0.3, 16);
        const shadowMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x000000, 
          transparent: true, 
          opacity: 0.3,
          side: THREE.DoubleSide
        });
        const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadow.position.set(0, 0.01, 0); // Slightly above ground to avoid z-fighting
        shadow.rotation.x = -Math.PI / 2; // Rotate to lie flat on ground
        
        const label = makeNameSprite(user);
        group.add(body);
        group.add(shadow);
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
      return { x: controller.playerBase.x, y: controller.playerBase.y, z: controller.playerBase.z, yaw };
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
          selfGroup.position.copy(controller.playerBase);
          scene.add(selfGroup);
        }
        
        // Create separate shadow for self player
        if (selfUsername && !selfShadow) {
          const shadowGeometry = new THREE.CircleGeometry(0.3, 16);
          const shadowMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.3,
            side: THREE.DoubleSide
          });
          selfShadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
          selfShadow.rotation.x = -Math.PI / 2; // Rotate to lie flat on ground
          scene.add(selfShadow);
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
      if (specialManager) specialManager.update(delta);
      
      // Update sky system
      if (timeMgr && skyMgr) {
        const timeOfDay = timeMgr.update();
        skyMgr.updateTimeOfDay(timeOfDay);
        skyMgr.updatePlayerPosition(controller.playerBase);
        skyMgr.update(delta);
      }
      
      // Stream chunks around player base
      void streamer.ensureAroundWorld(controller.playerBase.x, controller.playerBase.z);
      renderer.render(scene, camera);
    }
    
    console.log('Starting animation loop');
    animate();

    // Initialize blocks from post data and set up polling for sync
    void loadPersistedBlocks();
    blocksPollInterval = window.setInterval(() => { void loadPersistedBlocks(); }, 3000);

    // Set up player state polling
    playerStatePollInterval = window.setInterval(() => { void loadPlayerState(); }, 1000);

    // Load smart blocks defs then realtime
    async function loadSmartBlocks(): Promise<void> {
      try {
        const res = await fetch('/api/smart-blocks');
        if (!res.ok) return;
        const data = (await res.json()) as SmartBlocksResponse;
        const defs = data.blocks ?? [];
        smartDefsRef.current = defs;
        // Merge into block types registry for textures
        const merged: BlockTypeRegistry = { ...defaultBlockTypes };
        for (const d of defs) {
          merged[d.id] = {
            id: d.id,
            name: d.name,
            textures: d.textures as any,
            fallbackColor: '#cccccc',
          };
        }
        setAllBlockTypes(merged);
        blockFactory.setBlockTypes(merged);
        // Register smart specials
        const { SmartSpecialBlock } = await import('./core/blocks/special/SmartSpecialBlock');
        for (const d of defs) {
          console.log(`Registering smart block behavior: ${d.id}`);
          specialManager?.register(d.id, (ctx, _mesh) => new SmartSpecialBlock(ctx, d));
        }
      } catch (e) {
        console.warn('loadSmartBlocks failed', e);
      }
    }

    // Load player state
    async function loadPlayerState(): Promise<void> {
      try {
        const res = await fetch('/api/player-state');
        if (res.ok) {
          const state = await res.json();
          setPlayerState(state);
        }
      } catch (e) {
        console.warn('loadPlayerState failed', e);
      }
    }

    await loadSmartBlocks();
    await loadPlayerState();

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
      if (playerStatePollInterval) window.clearInterval(playerStatePollInterval);
      if (realtimeConnection) realtimeConnection.disconnect().catch(() => {});
      if (skyMgr) skyMgr.dispose();
      input.detach();
    };
    };
    void run();
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ErrorOverlay message={sceneError} deviceLabel={isMobile ? 'mobile' : 'PC'} />

      <StartOverlay visible={!isPointerLocked && !isMobile && !sceneError} />

      {!sceneError && (
        <WorldInfo worldConfig={worldConfig} isMobile={isMobile} canBuild={canBuild} />
      )}

      {!sceneError && <DebugLog logs={debugLogs} />}

      {!sceneError && isMobile && (
        <PlayerStatusMobile
          playerState={playerState}
          isPostCreator={isPostCreator}
          mobileMoveState={mobileMoveState}
          mobileRotationState={mobileRotationState}
        />
      )}

      {!sceneError && !isMobile && (
        <PlayerStatusDesktop playerState={playerState} />
      )}

      {!sceneError && !isMobile && canBuild && (
        <CreatorPanelDesktop
          visible={true}
          isOwner={isOwner}
          worldConfig={worldConfig}
          allBlockTypes={allBlockTypes as any}
          selectedBlockType={selectedBlockType}
          onChangeBlockType={setSelectedBlockType}
          onAdd={() => addBlockAtPlayerRef.current()}
          onRemove={() => removeBlockAtPlayerRef.current()}
          onOpenSmart={() => setShowSmartCreate(true)}
          onOpenBuilderManagement={() => setShowBuilderManagement(true)}
        />
      )}

      {!sceneError && isMobile && canBuild && (
        <CreatorPanelMobile
          visible={true}
          allBlockTypes={allBlockTypes as any}
          selectedBlockType={selectedBlockType}
          onChangeBlockType={setSelectedBlockType}
          onAdd={() => addBlockAtPlayerRef.current()}
          onRemove={() => removeBlockAtPlayerRef.current()}
          onOpenSmart={() => setShowSmartCreate(true)}
        />
      )}
      {showSmartCreate && !sceneError && (
        <SmartBlockCreateModal
          visible={true}
          form={smartForm}
          status={smartCreateStatus}
          onChangeForm={setSmartForm as any}
          onClose={() => { setShowSmartCreate(false); setSmartCreateStatus({ type: null, message: '' }); }}
          onSubmit={async () => {
            setSmartCreateStatus({ type: null, message: '' });
            try {
              if (!smartForm.name.trim()) {
                setSmartCreateStatus({ type: 'error', message: 'Name is required' });
                return;
              }
              if (!smartForm.side && !smartForm.top && !smartForm.bottom) {
                setSmartCreateStatus({ type: 'error', message: 'At least one texture (side/top/bottom) is required' });
                return;
              }
              let onClick, onTouch;
              try { onClick = smartForm.onClick.trim() ? JSON.parse(smartForm.onClick) : undefined; } catch (e) { setSmartCreateStatus({ type: 'error', message: 'Invalid onClick JSON format' }); return; }
              try { onTouch = smartForm.onTouch.trim() ? JSON.parse(smartForm.onTouch) : undefined; } catch (e) { setSmartCreateStatus({ type: 'error', message: 'Invalid onTouch JSON format' }); return; }
              setSmartCreateStatus({ type: null, message: 'Creating smart block...' });
              const res = await fetch('/api/smart-blocks/create', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                  name: smartForm.name,
                  textures: { ...(smartForm.side ? { side: smartForm.side } : {}), ...(smartForm.top ? { top: smartForm.top } : {}), ...(smartForm.bottom ? { bottom: smartForm.bottom } : {}) },
                  onClick, onTouch,
                }),
              });
              if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                setSmartCreateStatus({ type: 'error', message: `Server error: ${errorData.message || res.statusText}` });
                return;
              }
              await res.json();
              setSmartCreateStatus({ type: 'success', message: `Smart block "${smartForm.name}" created successfully!` });
              try {
                const res2 = await fetch('/api/smart-blocks');
                const data = (await res2.json()) as SmartBlocksResponse;
                const defs = data.blocks ?? [];
                smartDefsRef.current = defs;
                const merged: BlockTypeRegistry = { ...defaultBlockTypes };
                for (const d of defs) { merged[d.id] = { id: d.id, name: d.name, textures: d.textures as any, fallbackColor: '#cccccc' }; }
                setAllBlockTypes(merged);
                blockFactoryRef.current?.setBlockTypes(merged);
                const { SmartSpecialBlock } = await import('./core/blocks/special/SmartSpecialBlock');
                for (const d of defs) { specialManagerRef.current?.register(d.id, (ctx: any, _mesh: any) => new SmartSpecialBlock(ctx, d)); }
                setSmartCreateStatus({ type: 'success', message: `Smart block "${smartForm.name}" created and loaded!` });
              } catch (e) {
                setSmartCreateStatus({ type: 'error', message: 'Created but failed to reload. Try refreshing.' });
              }
              setTimeout(() => { setShowSmartCreate(false); setSmartCreateStatus({ type: null, message: '' }); }, 2000);
            } catch (e) {
              setSmartCreateStatus({ type: 'error', message: `Network error: ${e instanceof Error ? e.message : 'Unknown error'}` });
            }
          }}
        />
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

      {/* Mobile joystick and controls */}
      {!sceneError && (
        <MobileControls
          isMobile={isMobile}
          joystickRef={joystickRef}
          joystickPosition={joystickPosition}
          isJoystickActive={isJoystickActive}
          onJoystickStart={handleJoystickStart}
          onJoystickMove={handleJoystickMove}
          onJoystickEnd={handleJoystickEnd}
          onJump={handleMobileJump}
          onSprintStart={(e) => {
            e.preventDefault();
            const newState = { ...mobileMoveState, sprint: true };
            setMobileMoveState(newState);
            mobileMoveStateRef.current = newState;
          }}
          onSprintEnd={(e) => {
            e.preventDefault();
            const newState = { ...mobileMoveState, sprint: false };
            setMobileMoveState(newState);
            mobileMoveStateRef.current = newState;
          }}
        />
      )}

      {showBuilderManagement && worldConfig && (
        <BuilderManagementModal
          visible={true}
          worldConfig={worldConfig}
          builderInput={builderInput}
          onChangeBuilderInput={setBuilderInput}
          onAddBuilder={addBuilder}
          onRemoveBuilder={removeBuilder}
          onClose={() => setShowBuilderManagement(false)}
        />
      )}
      
      {!sceneError && <canvas ref={canvasRef} style={{ 
        display: 'block', 
        width: '100%', 
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0
      }} />}
    </div>
  );
}

export default VoxelGame;
