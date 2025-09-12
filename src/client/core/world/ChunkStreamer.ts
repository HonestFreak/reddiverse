import { ChunkManager } from './ChunkManager';

export class ChunkStreamer {
  private readonly manager: ChunkManager;
  private readonly radius: number;
  private readonly sizeX: number;
  private readonly sizeZ: number;
  private readonly halfX: number;
  private readonly halfZ: number;

  constructor(manager: ChunkManager, sizeX: number, sizeZ: number, radius: number = 1) {
    this.manager = manager;
    this.radius = Math.max(0, Math.floor(radius));
    this.sizeX = sizeX;
    this.sizeZ = sizeZ;
    this.halfX = Math.floor(sizeX / 2);
    this.halfZ = Math.floor(sizeZ / 2);
  }

  private worldToChunk(wx: number, wz: number): { cx: number; cz: number } {
    const cx = Math.floor((wx + this.halfX) / this.sizeX);
    const cz = Math.floor((wz + this.halfZ) / this.sizeZ);
    return { cx, cz };
  }

  async ensureAroundWorld(wx: number, wz: number): Promise<void> {
    const { cx, cz } = this.worldToChunk(wx, wz);
    const promises: Promise<void>[] = [];
    
    for (let dz = -this.radius; dz <= this.radius; dz++) {
      for (let dx = -this.radius; dx <= this.radius; dx++) {
        promises.push(this.manager.ensureChunk(cx + dx, cz + dz));
      }
    }
    
    await Promise.all(promises);
  }
}


