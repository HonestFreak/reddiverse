import * as THREE from 'three';
import { Snail } from './Snail';
import type { SnailConfig } from '../../../shared/config/gameConfig';

export class SnailManager {
  private readonly scene: THREE.Scene;
  private readonly config: SnailConfig;
  private readonly worldSeed: number;
  private readonly heightAt: (x: number, z: number) => number;
  private readonly onPlayerDeath: () => void;
  
  private snails: Map<string, Snail> = new Map();
  private activeChunks: Set<string> = new Set();
  private lastPlayerChunk: { x: number; z: number } | null = null;
  
  constructor(
    scene: THREE.Scene,
    config: SnailConfig,
    worldSeed: number,
    heightAt: (x: number, z: number) => number,
    onPlayerDeath: () => void
  ) {
    this.scene = scene;
    this.config = config;
    this.worldSeed = worldSeed;
    this.heightAt = heightAt;
    this.onPlayerDeath = onPlayerDeath;
  }
  
  public update(
    deltaTime: number,
    currentTime: number,
    playerPosition: THREE.Vector3,
    playerRadius: number,
    chunkSize: { x: number; z: number }
  ): void {
    // Determine current player chunk
    const playerChunkX = Math.floor(playerPosition.x / chunkSize.x);
    const playerChunkZ = Math.floor(playerPosition.z / chunkSize.z);
    
    // Update active chunks if player moved to a new chunk
    if (!this.lastPlayerChunk || 
        this.lastPlayerChunk.x !== playerChunkX || 
        this.lastPlayerChunk.z !== playerChunkZ) {
      this.updateActiveChunks(playerChunkX, playerChunkZ, chunkSize);
      this.lastPlayerChunk = { x: playerChunkX, z: playerChunkZ };
    }
    
    // Update all active snails
    for (const snail of this.snails.values()) {
      snail.update(deltaTime, currentTime, this.heightAt);
      
      // Check collision with player
      if (snail.checkCollisionWithPlayer(playerPosition, playerRadius)) {
        this.onPlayerDeath();
      }
    }
  }
  
  private updateActiveChunks(playerChunkX: number, playerChunkZ: number, chunkSize: { x: number; z: number }): void {
    const renderDistance = 2; // Load snails in 5x5 area around player
    const newActiveChunks = new Set<string>();
    
    // Mark chunks that should be active
    for (let dx = -renderDistance; dx <= renderDistance; dx++) {
      for (let dz = -renderDistance; dz <= renderDistance; dz++) {
        const chunkX = playerChunkX + dx;
        const chunkZ = playerChunkZ + dz;
        const chunkKey = `${chunkX}_${chunkZ}`;
        newActiveChunks.add(chunkKey);
        
        // Create snails for this chunk if it's not already active
        if (!this.activeChunks.has(chunkKey)) {
          this.createSnailsForChunk(chunkX, chunkZ, chunkSize);
        }
      }
    }
    
    // Remove snails from chunks that are no longer active
    for (const chunkKey of this.activeChunks) {
      if (!newActiveChunks.has(chunkKey)) {
        this.removeSnailsFromChunk(chunkKey);
      }
    }
    
    this.activeChunks = newActiveChunks;
  }
  
  private createSnailsForChunk(chunkX: number, chunkZ: number, chunkSize: { x: number; z: number }): void {
    const chunkKey = `${chunkX}_${chunkZ}`;
    
    // Calculate number of snails for this chunk based on density
    const numSnails = Math.floor(this.config.density + Math.random() * 0.5); // Add some randomness
    
    for (let i = 0; i < numSnails; i++) {
      // Generate deterministic position within chunk
      const position = this.generateSnailPosition(chunkX, chunkZ, i, chunkSize);
      
      // Only create snail if position is valid (on solid ground)
      if (this.isValidSnailPosition(position)) {
        const snail = new Snail(
          this.config,
          this.worldSeed,
          chunkX,
          chunkZ,
          i,
          position
        );
        
        this.snails.set(snail.id, snail);
        this.scene.add(snail.mesh);
      }
    }
  }
  
  private generateSnailPosition(chunkX: number, chunkZ: number, localIndex: number, chunkSize: { x: number; z: number }): THREE.Vector3 {
    // Use deterministic random based on chunk and index
    const seed = this.hashCode(`${this.worldSeed}_${chunkX}_${chunkZ}_${localIndex}`);
    const rng = this.createSeededRandom(seed);
    
    // Position within chunk (with some margin from edges)
    const margin = 2;
    const x = chunkX * chunkSize.x + margin + rng() * (chunkSize.x - 2 * margin);
    const z = chunkZ * chunkSize.z + margin + rng() * (chunkSize.z - 2 * margin);
    const y = this.heightAt(x, z) + 0.5 + 0.3; // Top of terrain block + small offset
    
    return new THREE.Vector3(x, y, z);
  }
  
  private isValidSnailPosition(position: THREE.Vector3): boolean {
    // Check if position is on solid ground (not in water or air)
    const groundHeight = this.heightAt(position.x, position.z);
    const expectedY = groundHeight + 0.5 + 0.3; // Top of terrain block + small offset
    return Math.abs(position.y - expectedY) < 0.5; // Within 0.5 blocks of expected position
  }
  
  private removeSnailsFromChunk(chunkKey: string): void {
    const snailsToRemove: string[] = [];
    
    for (const [snailId, snail] of this.snails.entries()) {
      if (snailId.startsWith(`snail_${chunkKey.split('_')[0]}_${chunkKey.split('_')[1]}_`)) {
        snailsToRemove.push(snailId);
      }
    }
    
    for (const snailId of snailsToRemove) {
      const snail = this.snails.get(snailId);
      if (snail) {
        this.scene.remove(snail.mesh);
        snail.dispose();
        this.snails.delete(snailId);
      }
    }
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
  
  public getSnailCount(): number {
    return this.snails.size;
  }
  
  public dispose(): void {
    for (const snail of this.snails.values()) {
      this.scene.remove(snail.mesh);
      snail.dispose();
    }
    this.snails.clear();
    this.activeChunks.clear();
  }
}
