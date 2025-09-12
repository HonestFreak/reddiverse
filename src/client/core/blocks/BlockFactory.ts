import * as THREE from 'three';
import { TextureManager } from '../textures/TextureManager';

type BlockTexture = { type: 'color' | 'image'; value: string };
type BlockTextures = { top?: BlockTexture; side?: BlockTexture; bottom?: BlockTexture };
type BlockType = { id: string; name: string; textures: BlockTextures; fallbackColor?: string };
type BlockTypeRegistry = Record<string, BlockType>;

export class BlockFactory {
  private textureManager: TextureManager;
  private geometryCache = new Map<string, THREE.BufferGeometry>();
  private materialCache = new Map<string, THREE.Material[]>();

  constructor(blockTypes: BlockTypeRegistry) {
    this.textureManager = new TextureManager(blockTypes);
    this.initializeGeometryCache();
  }

  private initializeGeometryCache(): void {
    // Pre-create and cache common geometries
    this.geometryCache.set('box', new THREE.BoxGeometry(1, 1, 1));
    this.geometryCache.set('box_edges', new THREE.EdgesGeometry(this.geometryCache.get('box')!));
  }

  async createBlock(
    blockTypeId: string, 
    position: THREE.Vector3, 
    options: {
      showCollisionOutlines?: boolean;
      collisionOutlineColor?: number;
    } = {}
  ): Promise<{
    mesh: THREE.Mesh;
    collisionOutlines?: THREE.LineSegments[];
  }> {
    // Use cached geometry
    const geometry = this.geometryCache.get('box')!;
    
    // Check if we have cached materials for this block type
    const materialCacheKey = blockTypeId;
    let materials: THREE.Material[];
    
    if (this.materialCache.has(materialCacheKey)) {
      materials = this.materialCache.get(materialCacheKey)!;
    } else {
      // Create materials for each face (optimized to avoid duplicate material creation)
      const [sideMaterial, topMaterial, bottomMaterial] = await Promise.all([
        this.textureManager.getBlockMaterial(blockTypeId, 'side'),
        this.textureManager.getBlockMaterial(blockTypeId, 'top'),
        this.textureManager.getBlockMaterial(blockTypeId, 'bottom')
      ]);
      
      // Reuse materials for identical faces
      materials = [
        sideMaterial, // right
        sideMaterial, // left  
        topMaterial,  // top
        bottomMaterial, // bottom
        sideMaterial, // front
        sideMaterial  // back
      ];
      
      this.materialCache.set(materialCacheKey, materials);
    }

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.copy(position);
    mesh.userData = { blockType: blockTypeId, isPlaced: true };

    const result: { mesh: THREE.Mesh; collisionOutlines?: THREE.LineSegments[] } = { mesh };

    // Add collision outlines if requested
    if (options.showCollisionOutlines) {
      const collisionOutlines: THREE.LineSegments[] = [];
      
      // Use cached edges geometry
      const edges = this.geometryCache.get('box_edges')!;
      const outline = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ 
          color: options.collisionOutlineColor || 0x00ff00, 
          linewidth: 2 
        })
      );
      outline.position.copy(position);
      collisionOutlines.push(outline);

      // Collision box visualization (reuse geometry)
      const collisionBox = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ 
          color: 0xff0000, 
          linewidth: 3, 
          transparent: true, 
          opacity: 0.8 
        })
      );
      collisionBox.position.copy(position);
      collisionOutlines.push(collisionBox);

      result.collisionOutlines = collisionOutlines;
    }

    return result;
  }

  async createInstancedBlock(
    blockTypeId: string,
    instances: Array<{ position: THREE.Vector3; matrix: THREE.Matrix4 }>,
    options: {
      showCollisionOutlines?: boolean;
    } = {}
  ): Promise<{
    mesh: THREE.InstancedMesh;
    collisionOutlines?: THREE.LineSegments;
  }> {
    // Use cached geometry
    const geometry = this.geometryCache.get('box')!;
    
    // Use separate materials per face so top/bottom can differ from sides
    // Cache the materials array per block type
    const materialCacheKey = `instanced_${blockTypeId}`;
    let materials: THREE.Material[];
    if (this.materialCache.has(materialCacheKey)) {
      materials = this.materialCache.get(materialCacheKey)!;
    } else {
      const [sideMaterial, topMaterial, bottomMaterial] = await Promise.all([
        this.textureManager.getBlockMaterial(blockTypeId, 'side'),
        this.textureManager.getBlockMaterial(blockTypeId, 'top'),
        this.textureManager.getBlockMaterial(blockTypeId, 'bottom'),
      ]);
      // BoxGeometry material order: right, left, top, bottom, front, back
      materials = [
        sideMaterial,
        sideMaterial,
        topMaterial,
        bottomMaterial,
        sideMaterial,
        sideMaterial,
      ];
      this.materialCache.set(materialCacheKey, materials);
    }
    
    const mesh = new THREE.InstancedMesh(geometry, materials, instances.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Set instance matrices (optimized batch operation)
    const matrixArray = mesh.instanceMatrix.array as Float32Array;
    instances.forEach((instance, index) => {
      instance.matrix.toArray(matrixArray, index * 16);
    });

    mesh.instanceMatrix.needsUpdate = true;

    const result: { mesh: THREE.InstancedMesh; collisionOutlines?: THREE.LineSegments } = { mesh };

    // Add collision outline for the entire instanced mesh if requested
    if (options.showCollisionOutlines && instances.length > 0) {
      // Calculate bounding box for all instances (optimized)
      const box = new THREE.Box3();
      const tempBox = new THREE.Box3();
      const tempVector = new THREE.Vector3();
      
      instances.forEach(instance => {
        tempBox.setFromCenterAndSize(instance.position, tempVector.set(1, 1, 1));
        box.union(tempBox);
      });

      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      
      // Reuse geometry for chunk outline
      const chunkOutlineGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const chunkOutline = new THREE.LineSegments(
        new THREE.EdgesGeometry(chunkOutlineGeo),
        new THREE.LineBasicMaterial({ 
          color: 0x00ff00, 
          linewidth: 1, 
          transparent: true, 
          opacity: 0.3 
        })
      );
      chunkOutline.position.copy(center);
      result.collisionOutlines = chunkOutline;
    }

    return result;
  }

  getTextureManager(): TextureManager {
    return this.textureManager;
  }

  async preloadBlockType(blockTypeId: string): Promise<void> {
    return this.textureManager.preloadBlockType(blockTypeId);
  }

  async preloadAllBlockTypes(): Promise<void> {
    return this.textureManager.preloadAllBlockTypes();
  }

  dispose(): void {
    // Dispose of cached geometries
    this.geometryCache.forEach(geometry => geometry.dispose());
    this.geometryCache.clear();
    
    // Dispose of cached materials
    this.materialCache.forEach(materials => {
      materials.forEach(material => material.dispose());
    });
    this.materialCache.clear();
    
    this.textureManager.dispose();
  }
}
