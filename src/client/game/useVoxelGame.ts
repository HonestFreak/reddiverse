import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { connectRealtime } from '@devvit/web/client';
import type { PlayerPosition } from '../../shared/types/api';
import { TerrainGenerator } from '../../shared/core/terrain/TerrainGenerator';
import { defaultGameConfig } from '../../shared/config/gameConfig';
import { ChunkManager } from '../core/world/ChunkManager';
import { ChunkStreamer } from '../core/world/ChunkStreamer';
import { InputManager } from '../core/input/InputManager';
import { ThirdPersonController } from '../core/player/ThirdPersonController';
import { BlockFactory } from '../core/blocks/BlockFactory';
import { defaultBlockTypes, type BlockTypeRegistry } from '../../shared/types/BlockTypes';
import type { SmartBlocksResponse, SmartBlockDefinition } from '../../shared/types/SmartBlocks';
import { getTerrainParamsForPreset, presetSurfaceBlockId } from '../../shared/types/WorldConfig';
import { SpecialBlocksManager } from '../core/blocks/special/SpecialBlocksManager';
import { LightBlock } from '../core/blocks/special/LightBlock';
import { JumperBlock } from '../core/blocks/special/JumperBlock';
import { WaterBlock } from '../core/blocks/special/WaterBlock';
import { SkyManager } from '../core/sky/SkyManager';
import { TimeManager } from '../core/sky/TimeManager';

export type VoxelGameHook = {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  isPointerLocked: boolean;
  isMobile: boolean;
  mobileMoveState: { forward: boolean; backward: boolean; left: boolean; right: boolean; sprint: boolean };
  mobileRotationState: { left: boolean; right: boolean };
  joystickPosition: { x: number; y: number };
  isJoystickActive: boolean;
  joystickRef: React.MutableRefObject<HTMLDivElement | null>;
  isPostCreator: boolean;
  canBuild: boolean;
  isOwner: boolean;
  worldConfig: { worldName: string; buildingPermission: 'public' | 'restricted'; builders: string[]; owner: string } | null;
  showBuilderManagement: boolean;
  setShowBuilderManagement: (v: boolean) => void;
  builderInput: string;
  setBuilderInput: (v: string) => void;
  addBuilder: () => Promise<void>;
  removeBuilder: (builder: string) => Promise<void>;
  selectedBlockType: string;
  setSelectedBlockType: (id: string) => void;
  allBlockTypes: BlockTypeRegistry;
  showSmartCreate: boolean;
  setShowSmartCreate: (v: boolean) => void;
  playerState: { life: number; isWinner: boolean; badge: string };
  smartCreateStatus: { type: 'success' | 'error' | null; message: string };
  smartForm: { name: string; side: { type: 'color' | 'image'; value: string } | null; top: { type: 'color' | 'image'; value: string } | null; bottom: { type: 'color' | 'image'; value: string } | null; onClick: string; onTouch: string };
  setSmartForm: (f: VoxelGameHook['smartForm']) => void;
  setSmartCreateStatus: (s: VoxelGameHook['smartCreateStatus']) => void;
  sceneError: string | null;
  debugLogs: string[];
  handleJoystickStart: (e: React.TouchEvent) => void;
  handleJoystickMove: (e: React.TouchEvent) => void;
  handleJoystickEnd: (e: React.TouchEvent) => void;
  handleMobileJump: () => void;
  addBlockAtPlayerRef: React.MutableRefObject<() => void>;
  removeBlockAtPlayerRef: React.MutableRefObject<() => void>;
};

export function useVoxelGame(): VoxelGameHook {
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
    const maxDistance = 50;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const limitedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * limitedDistance;
    const y = Math.sin(angle) * limitedDistance;
    setJoystickPosition({ x, y });
    const forward = y > 5;
    const backward = y < -5;
    const rotateLeft = x < -5;
    const rotateRight = x > 5;
    const newMoveState = { forward, backward, left: false, right: false, sprint: mobileMoveState.sprint };
    setMobileMoveState(newMoveState);
    mobileMoveStateRef.current = newMoveState;
    const newRotationState = { left: rotateLeft, right: rotateRight };
    setMobileRotationState(newRotationState);
    mobileRotationStateRef.current = newRotationState;
  };

  const handleJoystickEnd = (event: React.TouchEvent) => {
    event.preventDefault();
    setIsJoystickActive(false);
    setJoystickPosition({ x: 0, y: 0 });
    const newMoveState = { forward: false, backward: false, left: false, right: false, sprint: mobileMoveState.sprint };
    setMobileMoveState(newMoveState);
    mobileMoveStateRef.current = newMoveState;
    const newRotationState = { left: false, right: false };
    setMobileRotationState(newRotationState);
    mobileRotationStateRef.current = newRotationState;
  };

  const handleMobileJump = () => {
    jumpRef.current();
  };

  useEffect(() => {
    selectedBlockTypeRef.current = selectedBlockType;
  }, [selectedBlockType]);

  useEffect(() => {
    const run = async () => {
      if (!canvasRef.current) return;

      const checkMobile = () => {
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        setIsMobile(isMobileDevice);
        isMobileRef.current = isMobileDevice;
      };
      checkMobile();

      const loadWorldConfig = async () => {
        try {
          const res = await fetch('/api/world-config');
          if (res.ok) {
            const config = await res.json();
            setWorldConfig(config);
            addDebugLog(`World loaded: ${config.worldName} (${config.buildingPermission})`);
          }
        } catch (_) {}
      };

      const checkPermissions = async () => {
        try {
          const res = await fetch('/api/can-build');
          if (res.ok) {
            const data = await res.json();
            setCanBuild(data.canBuild);
            setIsOwner(data.isOwner);
            setIsPostCreator(data.canBuild);
            isPostCreatorRef.current = data.canBuild;
            addDebugLog(`Permissions: canBuild=${data.canBuild}, isOwner=${data.isOwner}`);
          }
        } catch (_) {
          setCanBuild(true);
          setIsPostCreator(true);
          isPostCreatorRef.current = true;
        }
      };

      loadWorldConfig();
      checkPermissions();

      const canvas = canvasRef.current;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87ceeb);
      scene.fog = new THREE.Fog(0x87ceeb, 120, 350);

      const skyMgr = new SkyManager(scene);
      const timeMgr = new TimeManager({ startTime: 0.5 });
      skyManagerRef.current = skyMgr;

      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 10, 10);

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        if ('outputColorSpace' in renderer && (THREE as any).SRGBColorSpace) {
          (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
        }
      } catch (_) {
        try {
          renderer = new THREE.WebGLRenderer({ canvas });
          renderer.setSize(window.innerWidth, window.innerHeight);
        } catch (_) {
          setSceneError('Failed to initialize 3D graphics. Your device may not support WebGL.');
          return;
        }
      }

      const velocity = new THREE.Vector3();
      const direction = new THREE.Vector3();
      const clock = new THREE.Clock();
      let yaw = 0;
      let pitch = 0;
      velocityRef.current = velocity;
      let isMouseDown = false;
      const moveState = { forward: false, backward: false, left: false, right: false, sprint: false };
      const rotationState = { left: false, right: false };
      let canJump = false;
      jumpRef.current = () => { if (canJump) { velocity.y += 12; canJump = false; } };
      let lastTouchX = 0;
      let lastTouchY = 0;
      let isTouchActive = false;

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

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      ambientLight.name = 'ambientLight';
      scene.add(ambientLight);
      const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a7c59, 0.6);
      scene.add(hemiLight);

      let serverWorldCfg: { terrainType: 'greenery' | 'desert' | 'mountains'; seed: number } | null = null;
      try {
        const wcRes = await fetch('/api/world-config');
        if (wcRes.ok) serverWorldCfg = await wcRes.json();
      } catch (_) {}

      const terrainParams = getTerrainParamsForPreset((serverWorldCfg?.terrainType ?? 'greenery'), (serverWorldCfg?.seed ?? defaultGameConfig.terrain.seed));
      const terrain = new TerrainGenerator(terrainParams);
      const surfaceBlockId = presetSurfaceBlockId(serverWorldCfg?.terrainType ?? 'greenery');
      const snowOverlayCfg = (serverWorldCfg?.terrainType === 'mountains')
        ? { threshold: Math.max(Math.floor(terrainParams.heightScale - 3), Math.floor(terrainParams.heightScale * 0.8)), depth: 2, blockId: 'snow' }
        : undefined;
      const chunkManager = new ChunkManager(scene, terrain, defaultGameConfig.chunk, defaultGameConfig.render, allBlockTypes, surfaceBlockId, snowOverlayCfg);
      const blockFactory = new BlockFactory(allBlockTypes);
      blockFactoryRef.current = blockFactory;
      void chunkManager.ensureChunk(0, 0);
      const streamer = new ChunkStreamer(chunkManager, defaultGameConfig.chunk.sizeX, defaultGameConfig.chunk.sizeZ, 1);

      function heightAt(x: number, z: number): number { return terrain.heightAt(x, z); }

      const input = new InputManager();
      input.attach();
      const controller = new ThirdPersonController(camera, input);
      function resetSpawn() {
        const sx = 0; const sz = 0; const gy = heightAt(Math.round(sx), Math.round(sz)) + 0.5;
        controller.playerBase.set(sx, gy, sz);
        const camTarget = new THREE.Vector3().copy(controller.playerBase).add(new THREE.Vector3(0, cameraHeight, 0));
        camera.position.copy(new THREE.Vector3(camTarget.x, camTarget.y, camTarget.z + cameraDistance));
        camera.lookAt(camTarget);
      }
      resetSpawn();

      function getBlockKey(x: number, y: number, z: number): string { return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`; }
      async function persistAddBlock(x: number, y: number, z: number, blockType: string, color: string) {
        try { await fetch('/api/blocks/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x, y, z, type: blockType, color }) }); } catch (_) {}
      }
      async function persistRemoveBlock(x: number, y: number, z: number) {
        try { await fetch('/api/blocks/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x, y, z }) }); } catch (_) {}
      }

      async function placeBlock(x: number, y: number, z: number, blockType: string, opts?: { color?: string; persist?: boolean; userData?: Record<string, unknown> }) {
        const key = getBlockKey(x, y, z);
        const blockTypeInfo = defaultBlockTypes[blockType];
        const fallbackColor = blockTypeInfo?.fallbackColor || '#4a7c59';
        const color = opts?.color || fallbackColor;
        voxelDataRef.current.set(key, { x, y, z, color });
        try {
          const position = new THREE.Vector3(x, y, z);
          const result = await blockFactory.createBlock(blockType, position, { showCollisionOutlines: defaultGameConfig.render.showCollisionOutlines, collisionOutlineColor: 0x00ff00 });
          const block = result.mesh;
          (block as any).userData = { ...((block as any).userData || {}), key, isPlaced: true, ...(opts?.userData || {}) };
          scene.add(block);
          placedMeshes.push(block);
          if (specialManager) specialManager.onBlockPlaced(block, blockType);
          if (result.collisionOutlines) {
            result.collisionOutlines.forEach(outline => { scene.add(outline); placedOutlines.push(outline); });
          }
          if (opts?.persist !== false) { void persistAddBlock(x, y, z, blockType, color); }
        } catch (error) {
          addDebugLog(`Failed to create block at ${x}, ${y}, ${z}: ${error}`);
        }
      }

      function removeBlock(x: number, y: number, z: number, opts?: { persist?: boolean; force?: boolean }) {
        if (!opts?.force && !isPostCreatorRef.current) return;
        const key = getBlockKey(x, y, z);
        voxelDataRef.current.delete(key);
        const blockToRemove = placedMeshes.find(block => (block as any).userData.key === key);
        if (blockToRemove) {
          if (specialManager) specialManager.onBlockRemoved(blockToRemove);
          scene.remove(blockToRemove);
          const index = placedMeshes.indexOf(blockToRemove);
          if (index > -1) placedMeshes.splice(index, 1);
          const outlineToRemove = placedOutlines.find(outline => outline.position.equals(blockToRemove.position));
          if (outlineToRemove) {
            scene.remove(outlineToRemove);
            const outlineIndex = placedOutlines.indexOf(outlineToRemove);
            if (outlineIndex > -1) placedOutlines.splice(outlineIndex, 1);
          }
          const collisionBoxToRemove = placedCollisionBoxes.find(collisionBox => collisionBox.position.equals(blockToRemove.position));
          if (collisionBoxToRemove) {
            scene.remove(collisionBoxToRemove);
            const collisionBoxIndex = placedCollisionBoxes.indexOf(collisionBoxToRemove);
            if (collisionBoxIndex > -1) placedCollisionBoxes.splice(collisionBoxIndex, 1);
          }
        }
        if (opts?.persist !== false) { void persistRemoveBlock(x, y, z); }
      }

      function isOccupiedCell(x: number, y: number, z: number): boolean {
        const rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
        for (const m of placedMeshes) {
          if (Math.round(m.position.x) === rx && Math.round(m.position.y) === ry && Math.round(m.position.z) === rz) return true;
        }
        const h = heightAt(rx, rz);
        if (ry <= h) return true;
        const fc = chunkManager.getFoliageCollisionCells();
        if (fc && fc.has(`${rx},${ry},${rz}`)) return true;
        return false;
      }

      function isSolidCell(x: number, y: number, z: number): boolean {
        const rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
        for (const m of placedMeshes) {
          if (Math.round(m.position.x) === rx && Math.round(m.position.y) === ry && Math.round(m.position.z) === rz) return (m as any).userData.blockType !== 'water';
        }
        const h = heightAt(rx, rz);
        if (ry <= h) return true;
        const fc = chunkManager.getFoliageCollisionCells();
        if (fc && fc.has(`${rx},${ry},${rz}`)) return true;
        return false;
      }

      const specialCtx = {
        scene,
        getPlayerBase: () => controller.playerBase,
        getVelocity: () => velocity,
        addUpwardImpulse: (impulse: number) => { velocity.y += impulse; },
        heightAt: (x: number, z: number) => heightAt(x, z),
        isOccupied: (x: number, y: number, z: number) => isOccupiedCell(x, y, z),
        isSolid: (x: number, y: number, z: number) => isSolidCell(x, y, z),
        placeBlock: async (x: number, y: number, z: number, type: string, extras?: { userData?: Record<string, unknown>; persist?: boolean }) => { await placeBlock(x, y, z, type, { persist: extras?.persist ?? false }); },
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

      async function handleBlockInteraction(event: MouseEvent | TouchEvent) {
        const canvas = canvasRef.current; if (!canvas) return;
        let clientX: number, clientY: number;
        if (event instanceof MouseEvent) { clientX = event.clientX; clientY = event.clientY; }
        else { const touch = event.touches[0]; if (!touch) return; clientX = touch.clientX; clientY = touch.clientY; }
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const allTerrainMeshes = chunkManager.getAllTerrainMeshes();
        const intersects = raycaster.intersectObjects([...placedMeshes, ...allTerrainMeshes], false);
        if (intersects.length > 0) {
          const intersected = intersects[0];
          if (!intersected) return;
          const block = intersected.object as THREE.Mesh | THREE.InstancedMesh;
          const isTerrain = allTerrainMeshes.includes(block as THREE.InstancedMesh);
          if (event instanceof MouseEvent) {
            if (event.button === 0) {
              const face = intersected && intersected.face; if (face) {
                const normal = face.normal.clone(); normal.transformDirection((block as any).matrixWorld);
                let base: THREE.Vector3; let offsetScalar = 1.0;
                if (isTerrain) { base = intersected.point.clone(); offsetScalar = 0.5; }
                else { base = (block as THREE.Mesh).position.clone(); offsetScalar = 1.0; }
                const newPos = base.add(normal.multiplyScalar(offsetScalar));
                void placeBlock(Math.round(newPos.x), Math.round(newPos.y), Math.round(newPos.z), selectedBlockTypeRef.current);
              }
            } else if (event.button === 2) {
              if (!isTerrain) { removeBlock((block as any).position.x, (block as any).position.y, (block as any).position.z); }
            }
          } else {
            const face = intersected && intersected.face; if (face) {
              const normal = face.normal.clone(); normal.transformDirection((block as any).matrixWorld);
              let base: THREE.Vector3; let offsetScalar = 1.0;
              if (isTerrain) { base = intersected.point.clone(); offsetScalar = 0.5; }
              else { base = (block as THREE.Mesh).position.clone(); offsetScalar = 1.0; }
              const newPos = base.add(normal.multiplyScalar(offsetScalar));
              void placeBlock(Math.round(newPos.x), Math.round(newPos.y), Math.round(newPos.z), selectedBlockTypeRef.current);
            }
          }
          if (!isTerrain) {
            const typeId = (block as any).userData?.blockType as string | undefined;
            if (typeId && smartDefsRef.current.some((d) => d.id === typeId)) {
              const inst = (specialManager as any)?.instances?.get((block as any).uuid);
              if (inst && typeof inst.click === 'function') { await inst.click(); }
            }
          }
        } else {
          const groundY = heightAt(Math.round(camera.position.x), Math.round(camera.position.z));
          void placeBlock(Math.round(camera.position.x), groundY + 1, Math.round(camera.position.z), selectedBlockTypeRef.current);
        }
      }

      addBlockAtPlayerRef.current = () => {
        if (!isPostCreatorRef.current) return;
        const x = Math.round(camera.position.x);
        const z = Math.round(camera.position.z);
        const y = heightAt(x, z) + 1;
        void placeBlock(x, y, z, selectedBlockTypeRef.current);
      };
      removeBlockAtPlayerRef.current = () => {
        if (!isPostCreatorRef.current) return;
        const x = Math.round(camera.position.x);
        const z = Math.round(camera.position.z);
        const y = heightAt(x, z);
        removeBlock(x, y, z);
      };

      const testGeo = new THREE.BoxGeometry(1, 1, 1);
      const testMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
      const testCube = new THREE.Mesh(testGeo, testMat);
      testCube.position.set(0, 3, 0);
      scene.add(testCube);
      if (defaultGameConfig.render.showCollisionOutlines) {
        const testCubeEdges = new THREE.EdgesGeometry(testGeo);
        const testCubeLine = new THREE.LineSegments(testCubeEdges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
        testCubeLine.position.copy(testCube.position);
        scene.add(testCubeLine);
      }
      let playerCollisionBox: THREE.LineSegments | null = null;
      if (defaultGameConfig.render.showCollisionOutlines) {
        const playerHeight = defaultGameConfig.controls.playerHeight;
        const playerWidth = 0.6; const playerDepth = 0.6;
        const playerBoxGeo = new THREE.BoxGeometry(playerWidth, playerHeight, playerDepth);
        const playerBoxEdges = new THREE.EdgesGeometry(playerBoxGeo);
        playerCollisionBox = new THREE.LineSegments(playerBoxEdges, new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 }));
        scene.add(playerCollisionBox);
      }
      let groundCollisionIndicator: THREE.LineSegments | null = null;
      if (defaultGameConfig.render.showCollisionOutlines) {
        const groundBoxGeo = new THREE.BoxGeometry(1, 0.1, 1);
        const groundBoxEdges = new THREE.EdgesGeometry(groundBoxGeo);
        groundCollisionIndicator = new THREE.LineSegments(groundBoxEdges, new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 }));
        scene.add(groundCollisionIndicator);
      }
      let terrainWireframes: THREE.LineSegments[] = [];
      if (defaultGameConfig.render.showCollisionOutlines) {
        const wireframeSize = 5;
        for (let x = -wireframeSize; x <= wireframeSize; x++) {
          for (let z = -wireframeSize; z <= wireframeSize; z++) {
            const terrainHeight = heightAt(x, z);
            if (terrainHeight > 0) {
              const blockGeo = new THREE.BoxGeometry(1, 1, 1);
              const blockEdges = new THREE.EdgesGeometry(blockGeo);
              const blockWireframe = new THREE.LineSegments(blockEdges, new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 1, transparent: true, opacity: 0.3 }));
              blockWireframe.position.set(x, terrainHeight, z);
              scene.add(blockWireframe);
              terrainWireframes.push(blockWireframe);
            }
          }
        }
      }

      function onMouseMove(event: MouseEvent) {
        const isLocked = document.pointerLockElement === canvas; if (!isLocked && !isMouseDown) return;
        const movementX = (event as any).movementX || 0; const movementY = (event as any).movementY || 0;
        yaw -= movementX * 0.0025; pitch -= movementY * 0.0025; const maxPitch = Math.PI / 3;
        if (pitch > maxPitch) pitch = maxPitch; if (pitch < -maxPitch) pitch = -maxPitch;
      }
      function onMouseDown(event: MouseEvent) { if (event.button === 0) { isMouseDown = true; canvas.requestPointerLock(); setIsPointerLocked(true); } }
      function onMouseUp() { isMouseDown = false; }

      function onTouchStart(event: TouchEvent) {
        event.preventDefault(); if (event.touches.length === 1) { const touch = event.touches[0]; if (touch) { lastTouchX = touch.clientX; lastTouchY = touch.clientY; isTouchActive = true; setIsPointerLocked(true); } }
      }
      function onTouchMove(event: TouchEvent) {
        event.preventDefault(); if (isTouchActive && event.touches.length === 1) { const touch = event.touches[0]; if (touch) {
          const deltaX = touch.clientX - lastTouchX; const deltaY = touch.clientY - lastTouchY;
          yaw -= deltaX * 0.003; pitch -= deltaY * 0.003; const maxPitch = Math.PI / 3; if (pitch > maxPitch) pitch = maxPitch; if (pitch < -maxPitch) pitch = -maxPitch;
          lastTouchX = touch.clientX; lastTouchY = touch.clientY; } }
      }
      function onTouchEnd(event: TouchEvent) { event.preventDefault(); isTouchActive = false; setIsPointerLocked(false); }

      function onKeyDown(event: KeyboardEvent) {
        switch (event.code) {
          case 'ArrowUp': case 'KeyW': moveState.forward = true; break;
          case 'ArrowLeft': case 'KeyA': rotationState.left = true; break;
          case 'ArrowDown': case 'KeyS': moveState.backward = true; break;
          case 'ArrowRight': case 'KeyD': rotationState.right = true; break;
          case 'ShiftLeft': case 'ShiftRight': moveState.sprint = true; break;
          case 'Space': if (canJump) { velocity.y += 12; canJump = false; } break;
        }
      }
      function onKeyUp(event: KeyboardEvent) {
        switch (event.code) {
          case 'ArrowUp': case 'KeyW': moveState.forward = false; break;
          case 'ArrowLeft': case 'KeyA': rotationState.left = false; break;
          case 'ArrowDown': case 'KeyS': moveState.backward = false; break;
          case 'ArrowRight': case 'KeyD': rotationState.right = false; break;
          case 'ShiftLeft': case 'ShiftRight': moveState.sprint = false; break;
        }
      }

      function updatePhysics(delta: number) {
        velocity.x -= velocity.x * damping * delta; velocity.z -= velocity.z * damping * delta;
        velocity.y -= gravity * delta;
        const currentRotationState = isMobileRef.current ? mobileRotationStateRef.current : rotationState;
        if (currentRotationState.left) { yaw += 2.0 * delta; }
        if (currentRotationState.right) { yaw -= 2.0 * delta; }
        const currentMoveState = isMobileRef.current ? mobileMoveStateRef.current : moveState;
        direction.set(0, 0, 0);
        if (currentMoveState.forward) direction.z -= 1;
        if (currentMoveState.backward) direction.z += 1;
        direction.normalize();
        controller.yaw = yaw; controller.pitch = pitch;
        controller.updatePhysics(
          delta,
          { gravity, walkSpeed, sprintMultiplier, damping, cameraDistance, cameraHeight, playerHeight: defaultGameConfig.controls.playerHeight, canJumpRef },
          velocity,
          heightAt,
          placedMeshes.filter((m) => (m as any).userData.blockType !== 'water'),
          streamer ? chunkManager.getFoliageCollisionCells() : undefined
        );
        yaw = controller.yaw; pitch = controller.pitch;
        // Keep local avatar in sync with player position
        if (selfGroup) { selfGroup.position.copy(controller.playerBase); }
        if (playerCollisionBox) { playerCollisionBox.position.copy(controller.playerBase); playerCollisionBox.position.y += defaultGameConfig.controls.playerHeight / 2; }
        if (groundCollisionIndicator) {
          const gx = Math.round(controller.playerBase.x); const gz = Math.round(controller.playerBase.z);
          const groundY = heightAt(gx, gz) + 0.5; groundCollisionIndicator.position.set(gx, groundY, gz);
        }
      }

      const remotePlayers = new Map<string, THREE.Group>();
      let selfGroup: THREE.Group | null = null; let selfUsername: string | null = null; let postId: string | null = null; let realtimeConnection: { disconnect: () => Promise<void> } | null = null;
      let posInterval: number | null = null; let presencePollInterval: number | null = null; let blocksPollInterval: number | null = null; let playerStatePollInterval: number | null = null;

      function hashColorFromString(str: string): number {
        let hash = 0; for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
        const hue = Math.abs(hash) % 360; const color = new THREE.Color().setHSL(hue / 360, 0.6, 0.5); return color.getHex();
      }
      function makeNameSprite(name: string): THREE.Sprite {
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64; const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('no 2d ctx');
        ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'white'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name, canvas.width / 2, canvas.height / 2);
        const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true; const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false }); const sprite = new THREE.Sprite(mat); sprite.scale.set(1.0, 0.5, 1); sprite.position.set(0, 1.1, 0); return sprite;
      }
      function addOrUpdateRemote(user: string, position: PlayerPosition): void {
        if (user === selfUsername) return; let group = remotePlayers.get(user);
        if (!group) { group = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 20), new THREE.MeshLambertMaterial({ color: hashColorFromString(user) })); body.position.set(0, 0.4, 0); const label = makeNameSprite(user); group.add(body); group.add(label); scene.add(group); remotePlayers.set(user, group); }
        group.position.set(position.x, position.y, position.z);
      }
      function removeRemote(user: string): void { const group = remotePlayers.get(user); if (group) { scene.remove(group); remotePlayers.delete(user); } }
      function getPlayerPosition(): PlayerPosition { return { x: controller.playerBase.x, y: controller.playerBase.y, z: controller.playerBase.z, yaw }; }

      async function initRealtime(): Promise<void> {
        try {
          const initRes = await fetch('/api/init'); const initData = await initRes.json(); selfUsername = initData.username as string; postId = initData.postId as string;
          try { const pr = await fetch('/api/presence'); const pdata = await pr.json(); const players = (pdata.players ?? []) as { user: string; position: PlayerPosition }[]; players.forEach((p) => addOrUpdateRemote(p.user, p.position)); } catch (_) {}
          if (selfUsername && !selfGroup) { selfGroup = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 20), new THREE.MeshLambertMaterial({ color: hashColorFromString(selfUsername) })); body.position.set(0, 0.4, 0); const label = makeNameSprite(selfUsername); selfGroup.add(body); selfGroup.add(label); selfGroup.position.copy(controller.playerBase); scene.add(selfGroup); }
          await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: getPlayerPosition() }) });
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
          } catch (error) { addDebugLog(`Realtime failed: ${error}`); }
          posInterval = window.setInterval(async () => { try { await fetch('/api/pos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: getPlayerPosition() }) }); } catch (_) {} }, 125);
          presencePollInterval = window.setInterval(async () => { try { const pr2 = await fetch('/api/presence'); const pdata2 = await pr2.json(); const players2 = (pdata2.players ?? []) as { user: string; position: PlayerPosition }[]; players2.forEach((p) => addOrUpdateRemote(p.user, p.position)); } catch (_) {} }, 2000);
          const leave = async () => { try { await fetch('/api/leave', { method: 'POST' }); } catch (_) {} };
          window.addEventListener('beforeunload', leave);
        } catch (_) {}
      }

      async function loadPersistedBlocks(): Promise<void> {
        try {
          const res = await fetch('/api/blocks'); const data = await res.json();
          const blocks = (data?.blocks ?? []) as { x: number; y: number; z: number; type?: string; color?: string }[];
          const serverKeys = new Set(blocks.map((b) => getBlockKey(b.x, b.y, b.z)));
          for (const b of blocks) {
            const key = getBlockKey(b.x, b.y, b.z);
            const already = placedMeshes.find((m) => (m as any).userData.isPlaced && (m as any).userData.key === key);
            if (!already) { const options = b.color ? { color: b.color, persist: false } : { persist: false }; void placeBlock(Math.floor(b.x), Math.floor(b.y), Math.floor(b.z), (b.type ?? 'grass'), options as { color?: string; persist?: boolean }); }
          }
          const localPlacedKeys = new Set(placedMeshes.filter((m) => (m as any).userData.isPlaced).map((m) => (m as any).userData.key as string));
          for (const key of localPlacedKeys) {
            if (!serverKeys.has(key)) { const parts = key.split(','); const sx = parseInt(parts[0] ?? '0', 10); const sy = parseInt(parts[1] ?? '0', 10); const sz = parseInt(parts[2] ?? '0', 10); removeBlock(sx, sy, sz, { persist: false, force: true }); }
          }
        } catch (_) {}
      }

      function animate() {
        requestAnimationFrame(animate);
        const delta = Math.min(0.05, clock.getDelta());
        updatePhysics(delta);
        if (specialManager) specialManager.update(delta);
        if (timeMgr && skyMgr) {
          const timeOfDay = timeMgr.update();
          skyMgr.updateTimeOfDay(timeOfDay);
          skyMgr.updatePlayerPosition(controller.playerBase);
          skyMgr.update(delta);
        }
        void streamer.ensureAroundWorld(controller.playerBase.x, controller.playerBase.z);
        renderer.render(scene, camera);
      }
      animate();
      void loadPersistedBlocks();
      blocksPollInterval = window.setInterval(() => { void loadPersistedBlocks(); }, 3000);
      const loadPlayerState = async () => { try { const res = await fetch('/api/player-state'); if (res.ok) { const state = await res.json(); setPlayerState(state); } } catch (_) {} };
      playerStatePollInterval = window.setInterval(() => { void loadPlayerState(); }, 1000);

      async function loadSmartBlocks(): Promise<void> {
        try {
          const res = await fetch('/api/smart-blocks'); if (!res.ok) return; const data = (await res.json()) as SmartBlocksResponse; const defs = data.blocks ?? [];
          smartDefsRef.current = defs; const merged: BlockTypeRegistry = { ...defaultBlockTypes };
          for (const d of defs) { merged[d.id] = { id: d.id, name: d.name, textures: d.textures as any, fallbackColor: '#cccccc' }; }
          setAllBlockTypes(merged); blockFactory.setBlockTypes(merged);
          const { SmartSpecialBlock } = await import('../core/blocks/special/SmartSpecialBlock');
          for (const d of defs) { specialManager?.register(d.id, (ctx, _mesh) => new SmartSpecialBlock(ctx, d)); }
        } catch (_) {}
      }

      await loadSmartBlocks();
      await loadPlayerState();
      initRealtime();

      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('mousedown', onMouseDown);
      canvas.addEventListener('mouseup', onMouseUp);
      canvas.addEventListener('touchstart', onTouchStart);
      canvas.addEventListener('touchmove', onTouchMove);
      canvas.addEventListener('touchend', onTouchEnd);
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      canvas.addEventListener('click', (e) => { handleBlockInteraction(e); });
      canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); handleBlockInteraction(e); });
      canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { handleBlockInteraction(e); } });
      const handleResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
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
        if (skyMgr) skyMgr.dispose();
        input.detach();
        if (realtimeConnection) { realtimeConnection.disconnect().catch(() => {}); }
      };
    };
    void run();
  }, []);

  return {
    canvasRef,
    isPointerLocked,
    isMobile,
    mobileMoveState,
    mobileRotationState,
    joystickPosition,
    isJoystickActive,
    joystickRef,
    isPostCreator,
    canBuild,
    isOwner,
    worldConfig,
    showBuilderManagement,
    setShowBuilderManagement,
    builderInput,
    setBuilderInput,
    addBuilder,
    removeBuilder,
    selectedBlockType,
    setSelectedBlockType,
    allBlockTypes,
    showSmartCreate,
    setShowSmartCreate,
    playerState,
    smartCreateStatus,
    smartForm,
    setSmartForm: (f) => setSmartForm(f),
    setSmartCreateStatus: (s) => setSmartCreateStatus(s),
    sceneError,
    debugLogs,
    handleJoystickStart,
    handleJoystickMove,
    handleJoystickEnd,
    handleMobileJump,
    addBlockAtPlayerRef,
    removeBlockAtPlayerRef,
  };
}


