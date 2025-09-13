import * as THREE from 'three';
import { BlockTexture, BlockTypeRegistry } from '../../../shared/types/BlockTypes';

export class TextureManager {
  private textureCache = new Map<string, THREE.Texture>();
  private materialCache = new Map<string, THREE.Material>();
  private blockTypes: BlockTypeRegistry;
  private loadingPromises = new Map<string, Promise<THREE.Texture | null>>();

  constructor(blockTypes: BlockTypeRegistry) {
    this.blockTypes = blockTypes;
  }

  async loadTexture(texture: BlockTexture): Promise<THREE.Texture | null> {
    if (texture.type === 'color') {
      return null; // Color textures are handled differently
    }

    const cacheKey = texture.value;
    
    // Return cached texture if available
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }

    // Return existing loading promise if texture is already being loaded
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // Create new loading promise
    const loadingPromise = new Promise<THREE.Texture | null>((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        texture.value,
        (loadedTexture) => {
          // Optimize texture settings for voxel blocks
          loadedTexture.wrapS = THREE.RepeatWrapping;
          loadedTexture.wrapT = THREE.RepeatWrapping;
          loadedTexture.magFilter = THREE.NearestFilter;
          loadedTexture.minFilter = THREE.NearestFilter;
          loadedTexture.generateMipmaps = false; // Disable mipmaps for pixel art
          loadedTexture.anisotropy = 1; // Disable anisotropic filtering for pixel art
          
          this.textureCache.set(cacheKey, loadedTexture);
          this.loadingPromises.delete(cacheKey);
          resolve(loadedTexture);
        },
        undefined,
        (error) => {
          console.warn(`Failed to load texture: ${texture.value}`, error);
          this.loadingPromises.delete(cacheKey);
          resolve(null);
        }
      );
    });

    this.loadingPromises.set(cacheKey, loadingPromise);
    return loadingPromise;
  }

  async getBlockMaterial(blockTypeId: string, face: 'top' | 'side' | 'bottom' = 'side'): Promise<THREE.Material> {
    const cacheKey = `${blockTypeId}_${face}`;
    if (this.materialCache.has(cacheKey)) {
      return this.materialCache.get(cacheKey)!;
    }

    const blockType = this.blockTypes[blockTypeId];
    if (!blockType) {
      console.warn(`Unknown block type: ${blockTypeId}`);
      return this.createColorMaterial('#ff0000'); // Red fallback
    }

    const texture = blockType.textures[face] || blockType.textures.side || blockType.textures.top;
    if (!texture) {
      return this.createColorMaterial(blockType.fallbackColor || '#ff0000');
    }

    if (texture.type === 'color') {
      // Allow special handling for color-based materials like water
      if (blockTypeId === 'water') {
        const material = new THREE.MeshLambertMaterial({
          color: texture.value,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
          side: THREE.FrontSide,
        });
        this.materialCache.set(cacheKey, material);
        return material;
      }
      const material = this.createColorMaterial(texture.value);
      this.materialCache.set(cacheKey, material);
      return material;
    } else {
      const loadedTexture = await this.loadTexture(texture);
      if (loadedTexture) {
        const material = new THREE.MeshLambertMaterial({ map: loadedTexture });
        // Special handling for cutout foliage
        if (blockTypeId === 'leaf') {
          material.transparent = true;
          material.alphaTest = 0.4;
          material.depthWrite = true; // keep correct sorting for cutouts
          (material as THREE.MeshLambertMaterial).side = THREE.FrontSide;
        } else if (blockTypeId === 'water') {
          material.transparent = true;
          material.opacity = 0.35;
          material.depthWrite = false;
          (material as THREE.MeshLambertMaterial).side = THREE.FrontSide;
        }
        this.materialCache.set(cacheKey, material);
        return material;
      } else {
        // Fallback to color
        const material = this.createColorMaterial(blockType.fallbackColor || '#ff0000');
        this.materialCache.set(cacheKey, material);
        return material;
      }
    }
  }

  private createColorMaterial(color: string): THREE.MeshLambertMaterial {
    // Use optimized material settings for better performance
    return new THREE.MeshLambertMaterial({ 
      color,
      transparent: false,
      alphaTest: 0.1
    });
  }

  async preloadBlockType(blockTypeId: string): Promise<void> {
    const blockType = this.blockTypes[blockTypeId];
    if (!blockType) return;

    const promises: Promise<THREE.Texture | null>[] = [];
    
    Object.values(blockType.textures).forEach(texture => {
      if (texture.type === 'image') {
        promises.push(this.loadTexture(texture));
      }
    });

    await Promise.all(promises);
  }

  async preloadAllBlockTypes(): Promise<void> {
    // Batch load all textures for better performance
    const allTextures: BlockTexture[] = [];
    
    Object.values(this.blockTypes).forEach(blockType => {
      Object.values(blockType.textures).forEach(texture => {
        if (texture.type === 'image' && !this.textureCache.has(texture.value)) {
          allTextures.push(texture);
        }
      });
    });

    // Load all textures in parallel
    const promises = allTextures.map(texture => this.loadTexture(texture));
    await Promise.all(promises);
  }

  dispose(): void {
    // Dispose of all cached textures
    this.textureCache.forEach(texture => texture.dispose());
    this.textureCache.clear();

    // Dispose of all cached materials
    this.materialCache.forEach(material => material.dispose());
    this.materialCache.clear();

    // Clear loading promises
    this.loadingPromises.clear();
  }
}
