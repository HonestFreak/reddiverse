import { Perlin2D } from '../noise/Perlin';
import { TerrainConfig } from '../../config/gameConfig';

export class TerrainGenerator {
  private readonly perlin: Perlin2D;
  private readonly config: TerrainConfig;

  constructor(config: TerrainConfig) {
    this.config = config;
    this.perlin = new Perlin2D(config.seed);
  }

  getSeed(): number {
    return this.config.seed;
  }

  private fbm(nx: number, nz: number): number {
    const { octaves, persistence, lacunarity, useRidged } = this.config;
    let amplitude = 1.0;
    let frequency = 1.0;
    let sum = 0.0;
    let norm = 0.0;

    for (let i = 0; i < octaves; i++) {
      // 2D noise
      let n = this.perlin.noise2D(nx * frequency, nz * frequency);
      // Normalize noise from [-1, 1] to [-1, 1] still; apply ridged if requested
      if (useRidged) {
        // ridged multifractal: 1 - |noise|
        n = 1 - Math.abs(n);
        // bring back to [-1, 1]
        n = n * 2 - 1;
      }
      sum += n * amplitude;
      norm += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return sum / (norm || 1);
  }

  private shapeCurve(t: number): number {
    // Optional curve to flatten lowlands and highlight hills
    // t in [0,1]
    // Use smoothstep-like curve to increase plains area
    // y = 1 - (1 - t)^2 (ease-out)
    return 1 - (1 - t) * (1 - t);
  }

  heightAt(x: number, z: number): number {
    const { scale, heightScale, offsetX, offsetZ, useErosionCurve } = this.config;
    const nx = (x + offsetX) / scale;
    const nz = (z + offsetZ) / scale;
    // noise in [-1,1] -> [0,1]
    let n = (this.fbm(nx, nz) + 1) * 0.5;
    if (useErosionCurve) n = this.shapeCurve(n);
    const h = Math.floor(n * heightScale);
    if (!Number.isFinite(h)) return 0;
    return h;
  }
}


