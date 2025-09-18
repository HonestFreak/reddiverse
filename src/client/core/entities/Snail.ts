import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import type { SnailConfig } from '../../../shared/config/gameConfig';

export class Snail {
  public mesh: THREE.Object3D | null = null;
  public readonly position: THREE.Vector3;
  public readonly velocity: THREE.Vector3;
  public readonly id: string;
  
  private readonly config: SnailConfig;
  private readonly worldSeed: number;
  private readonly chunkX: number;
  private readonly chunkZ: number;
  private readonly localIndex: number;
  
  // Deterministic movement state
  private direction: THREE.Vector2 = new THREE.Vector2();
  private targetDirection: THREE.Vector2 = new THREE.Vector2();
  private directionChangeTimer: number = 0;
  private directionChangeInterval: number = 0;
  private lastUpdateTime: number = 0;
  
  // Smooth movement interpolation
  private currentSpeed: number = 0;
  private targetSpeed: number = 0;
  private speedInterpolationSpeed: number = 2.0; // How fast speed changes
  private directionInterpolationSpeed: number = 1.5; // How fast direction changes
  
  // Wandering behavior
  private spawnPosition: THREE.Vector3 = new THREE.Vector3();
  private maxWanderDistance: number = 15; // Maximum distance from spawn point
  
  // Model loading state
  private modelLoaded: boolean = false;
  private static modelCache: THREE.Group | null = null;
  private static loadingPromise: Promise<THREE.Group> | null = null;
  
  constructor(
    config: SnailConfig,
    worldSeed: number,
    chunkX: number,
    chunkZ: number,
    localIndex: number,
    initialPosition: THREE.Vector3
  ) {
    this.config = config;
    this.worldSeed = worldSeed;
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.localIndex = localIndex;
    this.position = initialPosition.clone();
    this.spawnPosition = initialPosition.clone();
    this.velocity = new THREE.Vector3();
    this.id = `snail_${chunkX}_${chunkZ}_${localIndex}`;
    
    // Create deterministic initial direction and timing
    this.initializeDeterministicState();
    
    // Load the 3D model asynchronously
    this.loadModel();
  }
  
  private async loadModel(): Promise<void> {
    try {
      const model = await Snail.loadSnailModel();
      this.mesh = model.clone();
      
      // Scale the model to match the snail size configuration
      const scale = this.config.size * 0.02; // Much smaller scale factor
      this.mesh.scale.setScalar(scale);
      
      // Position the mesh - place snail directly on ground
      this.mesh.position.copy(this.position);
      const groundHeight = this.position.y - 0.1; // Get actual ground height
      this.mesh.position.y = groundHeight; // Place snail exactly on ground level
      
      // Enable shadows
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      this.modelLoaded = true;
    } catch (error) {
      console.error('Failed to load snail model:', error);
      // Fallback to box geometry if model loading fails
      this.createFallbackMesh();
    }
  }
  
  private createFallbackMesh(): void {
    const geometry = new THREE.BoxGeometry(
      this.config.size,
      this.config.size * 0.6, // slightly shorter than wide
      this.config.size * 0.8  // slightly shorter than long
    );
    
    // Create a brownish color for the snail
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x8B4513 // Saddle brown
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.copy(this.position);
    // Place fallback mesh on ground level
    const groundHeight = this.position.y - 0.1;
    this.mesh.position.y = groundHeight;
    this.modelLoaded = true;
  }
  
  private static async loadSnailModel(): Promise<THREE.Group> {
    // Return cached model if already loaded
    if (Snail.modelCache) {
      return Snail.modelCache;
    }
    
    // Return existing loading promise if already loading
    if (Snail.loadingPromise) {
      return Snail.loadingPromise;
    }
    
    // Start loading the model
    Snail.loadingPromise = new Promise((resolve, reject) => {
      const mtlLoader = new MTLLoader();
      const objLoader = new OBJLoader();
      
      // Load materials first
      mtlLoader.load(
        '/snail.mtl',
        (materials) => {
          materials.preload();
          objLoader.setMaterials(materials);
          
          // Load the OBJ model
          objLoader.load(
            '/snail.obj',
            (object) => {
              Snail.modelCache = object;
              resolve(object);
            },
            undefined,
            (error) => {
              console.error('Error loading snail.obj:', error);
              reject(error);
            }
          );
        },
        undefined,
        (error) => {
          console.error('Error loading snail.mtl:', error);
          reject(error);
        }
      );
    });
    
    return Snail.loadingPromise;
  }
  
  private initializeDeterministicState(): void {
    // Use deterministic random based on world seed, chunk position, and local index
    const seed = this.hashCode(`${this.worldSeed}_${this.chunkX}_${this.chunkZ}_${this.localIndex}`);
    const rng = this.createSeededRandom(seed);
    
    // Initial direction and target direction
    const angle = rng() * Math.PI * 2;
    this.direction.set(Math.cos(angle), Math.sin(angle));
    this.targetDirection.copy(this.direction);
    
    // Initial speed
    this.targetSpeed = this.config.speed * (0.8 + rng() * 0.4); // 80-120% of base speed
    this.currentSpeed = this.targetSpeed;
    
    // Direction change interval (5-15 seconds for more natural movement)
    this.directionChangeInterval = 5 + rng() * 10;
    this.directionChangeTimer = rng() * this.directionChangeInterval;
  }
  
  private createSeededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
  
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  public update(deltaTime: number, currentTime: number, heightAt: (x: number, z: number) => number): void {
    // Always update position and collision detection, even if model isn't loaded yet
    
    // Update direction change timer
    this.directionChangeTimer += deltaTime;
    if (this.directionChangeTimer >= this.directionChangeInterval) {
      this.changeDirection();
      this.directionChangeTimer = 0;
    }
    
    // Smoothly interpolate direction towards target
    this.direction.lerp(this.targetDirection, this.directionInterpolationSpeed * deltaTime);
    
    // Smoothly interpolate speed towards target
    this.currentSpeed += (this.targetSpeed - this.currentSpeed) * this.speedInterpolationSpeed * deltaTime;
    
    // Move snail with smooth movement
    const moveVector = new THREE.Vector3(
      this.direction.x * this.currentSpeed * deltaTime,
      0,
      this.direction.y * this.currentSpeed * deltaTime
    );
    
    this.position.add(moveVector);
    
    // Check if snail has wandered too far from spawn point
    const distanceFromSpawn = this.position.distanceTo(this.spawnPosition);
    if (distanceFromSpawn > this.maxWanderDistance) {
      // Turn back towards spawn point
      const directionToSpawn = new THREE.Vector3()
        .subVectors(this.spawnPosition, this.position)
        .normalize();
      this.targetDirection.set(directionToSpawn.x, directionToSpawn.z);
    }
    
    // Keep snail on ground
    const groundHeight = heightAt(this.position.x, this.position.z);
    this.position.y = groundHeight + 0.1; // Just slightly above ground
    
    // Only update mesh if it's loaded
    if (this.modelLoaded && this.mesh) {
      // Update mesh position - place snail directly on ground
      this.mesh.position.copy(this.position);
      this.mesh.position.y = groundHeight; // Place snail exactly on ground level
      
      // Smooth rotation based on movement direction
      if (this.direction.length() > 0.01) { // Only rotate if moving significantly
        const targetRotation = Math.atan2(this.direction.x, this.direction.y);
        // Smooth rotation interpolation
        const rotationSpeed = 3.0; // How fast to rotate
        const angleDiff = targetRotation - this.mesh.rotation.y;
        const normalizedAngleDiff = ((angleDiff % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
        const shortestAngle = normalizedAngleDiff > Math.PI ? normalizedAngleDiff - (Math.PI * 2) : normalizedAngleDiff;
        this.mesh.rotation.y += shortestAngle * rotationSpeed * deltaTime;
      }
    }
    
    this.lastUpdateTime = currentTime;
  }
  
  private changeDirection(): void {
    // Use current time and position for deterministic direction changes
    const seed = this.hashCode(`${this.worldSeed}_${this.position.x}_${this.position.z}_${this.lastUpdateTime}`);
    const rng = this.createSeededRandom(seed);
    
    // More natural direction changes
    const currentAngle = Math.atan2(this.direction.x, this.direction.y);
    
    // 70% chance for gentle turn, 30% chance for sharper turn
    let angleChange: number;
    if (rng() < 0.7) {
      // Gentle turn (±30 degrees)
      angleChange = (rng() - 0.5) * Math.PI * 0.33;
    } else {
      // Sharper turn (±90 degrees)
      angleChange = (rng() - 0.5) * Math.PI;
    }
    
    const newAngle = currentAngle + angleChange;
    this.targetDirection.set(Math.sin(newAngle), Math.cos(newAngle));
    
    // Vary speed slightly for more natural movement
    this.targetSpeed = this.config.speed * (0.7 + rng() * 0.6); // 70-130% of base speed
    
    // New direction change interval (3-12 seconds)
    this.directionChangeInterval = 3 + rng() * 9;
  }
  
  public checkCollisionWithPlayer(playerPosition: THREE.Vector3, playerRadius: number): boolean {
    const distance = this.position.distanceTo(playerPosition);
    return distance < (this.config.detectionRadius + playerRadius);
  }
  
  public dispose(): void {
    if (this.mesh) {
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }
  }
}
