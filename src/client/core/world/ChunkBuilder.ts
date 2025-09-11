import * as THREE from 'three';
import { ChunkData, indexOf } from './ChunkTypes';
import { RenderConfig } from '../../../shared/config/gameConfig';

export type BuildResult = {
  mesh: THREE.InstancedMesh;
  outline?: THREE.LineSegments;
};

export function buildSurfaceInstancedMesh(
  chunk: ChunkData,
  render: RenderConfig
): BuildResult {
  const { sizeX, sizeZ, blockSize, heights } = chunk;
  const instanceCount = sizeX * sizeZ;

  const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
  // Provide a default per-vertex color attribute so USE_COLOR has valid data
  const vertexCount = (geometry.attributes.position?.count ?? 0);
  if (vertexCount > 0) {
    const ones = new Float32Array(vertexCount * 3);
    ones.fill(1);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(ones, 3));
  }
  
  // Enable instanced colors - this is crucial for terrain visibility
  const material = new THREE.MeshLambertMaterial({ 
    vertexColors: true,
    side: THREE.DoubleSide
  });
  
  const mesh = new THREE.InstancedMesh(geometry, material, instanceCount);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  let i = 0;
  for (let z = 0; z < sizeZ; z++) {
    for (let x = 0; x < sizeX; x++) {
      const h = heights[indexOf(x, z, sizeX)] ?? 0;

      dummy.position.set(
        (x - Math.floor(sizeX / 2)) * blockSize,
        h * blockSize,
        (z - Math.floor(sizeZ / 2)) * blockSize
      );
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const t = Math.min(1, Math.max(0, h / Math.max(1, render.maxLightness - render.minLightness + 1)));
      const lightness = THREE.MathUtils.lerp(render.minLightness, render.maxLightness, t);
      const hue = render.baseHue + render.hueSlope * t;
      color.setHSL(hue, render.instanceColorSaturation, lightness);
      mesh.setColorAt(i, color);
      i++;
    }
  }

  // Ensure GPU picks up instance transforms and colors
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  material.needsUpdate = true;
  
  // Create collision outline for the chunk (optional, for debugging)
  let chunkOutline: THREE.LineSegments | undefined;
  if (render.showCollisionOutlines) {
    const maxHeight = Math.max(...Array.from(heights));
    const chunkOutlineGeo = new THREE.BoxGeometry(
      sizeX * blockSize, 
      maxHeight * blockSize + blockSize, 
      sizeZ * blockSize
    );
    chunkOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(chunkOutlineGeo),
      new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 1, transparent: true, opacity: 0.3 })
    );
    chunkOutline.position.set(0, maxHeight * blockSize / 2, 0);
  }
  
  const result: BuildResult = chunkOutline ? { mesh, outline: chunkOutline } : { mesh };
  return result;
}


