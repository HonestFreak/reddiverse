import * as THREE from 'three';
import type { SnailConfig } from '../../../shared/config/gameConfig';

export class Snail {
  public readonly mesh: THREE.Mesh;
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
  private directionChangeTimer: number = 0;
  private directionChangeInterval: number = 0;
  private lastUpdateTime: number = 0;
  
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
    this.velocity = new THREE.Vector3();
    this.id = `snail_${chunkX}_${chunkZ}_${localIndex}`;
    
    // Create deterministic initial direction and timing
    this.initializeDeterministicState();
    
    // Create snail mesh (small cuboid)
    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
  }
  
  private createMesh(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(
      this.config.size,
      this.config.size * 0.6, // slightly shorter than wide
      this.config.size * 0.8  // slightly shorter than long
    );
    
    // Create a brownish color for the snail
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x8B4513 // Saddle brown
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  private initializeDeterministicState(): void {
    // Use deterministic random based on world seed, chunk position, and local index
    const seed = this.hashCode(`${this.worldSeed}_${this.chunkX}_${this.chunkZ}_${this.localIndex}`);
    const rng = this.createSeededRandom(seed);
    
    // Initial direction
    const angle = rng() * Math.PI * 2;
    this.direction.set(Math.cos(angle), Math.sin(angle));
    
    // Direction change interval (2-8 seconds)
    this.directionChangeInterval = 2 + rng() * 6;
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
    // Update direction periodically
    this.directionChangeTimer += deltaTime;
    if (this.directionChangeTimer >= this.directionChangeInterval) {
      this.changeDirection();
      this.directionChangeTimer = 0;
    }
    
    // Move snail
    const speed = this.config.speed * deltaTime;
    const moveVector = new THREE.Vector3(
      this.direction.x * speed,
      0,
      this.direction.y * speed
    );
    
    this.position.add(moveVector);
    
    // Keep snail on ground
    const groundHeight = heightAt(this.position.x, this.position.z);
    this.position.y = groundHeight + 0.5 + 0.3; // Top of terrain block + small offset
    
    // Update mesh position
    this.mesh.position.copy(this.position);
    
    // Simple rotation based on movement direction
    if (this.direction.length() > 0) {
      const targetRotation = Math.atan2(this.direction.x, this.direction.y);
      this.mesh.rotation.y = targetRotation;
    }
    
    this.lastUpdateTime = currentTime;
  }
  
  private changeDirection(): void {
    // Use current time and position for deterministic direction changes
    const seed = this.hashCode(`${this.worldSeed}_${this.position.x}_${this.position.z}_${this.lastUpdateTime}`);
    const rng = this.createSeededRandom(seed);
    
    // Random direction change (not too sharp)
    const currentAngle = Math.atan2(this.direction.x, this.direction.y);
    const angleChange = (rng() - 0.5) * Math.PI * 0.5; // ±45 degrees
    const newAngle = currentAngle + angleChange;
    
    this.direction.set(Math.sin(newAngle), Math.cos(newAngle));
    
    // New direction change interval
    this.directionChangeInterval = 2 + rng() * 6;
  }
  
  public checkCollisionWithPlayer(playerPosition: THREE.Vector3, playerRadius: number): boolean {
    const distance = this.position.distanceTo(playerPosition);
    return distance < (this.config.detectionRadius + playerRadius);
  }
  
  public dispose(): void {
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach(mat => mat.dispose());
    } else {
      this.mesh.material.dispose();
    }
  }
}
