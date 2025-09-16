import { Perlin2D, Perlin3D } from '../noise/Perlin';
import { TerrainConfig } from '../../config/gameConfig';

export class TerrainGenerator {
  private readonly config: TerrainConfig;

  // Multi-noise fields
  private readonly continentalness: Perlin2D;
  private readonly erosion: Perlin2D;
  private readonly peaks: Perlin2D;
  private readonly temperature: Perlin2D;
  private readonly humidity: Perlin2D;
  private readonly cavesPrimary: Perlin3D;
  private readonly cavesDetail: Perlin3D;

  constructor(config: TerrainConfig) {
    this.config = config;
    // Offsets for determinism across noise domains
    const s = config.seed >>> 0;
    this.continentalness = new Perlin2D((s + 0x9e3779b9) >>> 0);
    this.erosion = new Perlin2D((s + 0x85ebca6b) >>> 0);
    this.peaks = new Perlin2D((s + 0xc2b2ae35) >>> 0);
    this.temperature = new Perlin2D((s + 0x27d4eb2f) >>> 0);
    this.humidity = new Perlin2D((s + 0x165667b1) >>> 0);
    this.cavesPrimary = new Perlin3D((s + 0x27d4eb2f ^ 0x9e3779b9) >>> 0);
    this.cavesDetail = new Perlin3D((s + 0x94d049bb ^ 0x85ebca6b) >>> 0);
  }

  getSeed(): number {
    return this.config.seed;
  }

  getMaxHeight(): number {
    return this.config.heightScale;
  }

  private fbm2D(perlin: Perlin2D, nx: number, nz: number, octaves: number, persistence: number, lacunarity: number, ridged: boolean = false): number {
    let amplitude = 1.0;
    let frequency = 1.0;
    let sum = 0.0;
    let norm = 0.0;
    for (let i = 0; i < octaves; i++) {
      let n = perlin.noise2D(nx * frequency, nz * frequency);
      if (ridged) { n = 1 - Math.abs(n); n = n * 2 - 1; }
      sum += n * amplitude; norm += amplitude; amplitude *= persistence; frequency *= lacunarity;
    }
    return sum / (norm || 1);
  }

  private shapeCurve(t: number): number {
    // Biome-aware elevation shaping
    // Mountains: smootherstep for smooth -> steep -> smooth profile
    // Others: smoothstep to keep gentle lowlands (helps expose water)
    const cfg: any = this.config as any;
    const preset = cfg.biomePreset as ('greenery' | 'desert' | 'mountains' | undefined);
    const clamped = Math.max(0, Math.min(1, t));
    if (preset === 'mountains') {
      // smootherstep: 6t^5 - 15t^4 + 10t^3
      const a = clamped;
      return a * a * a * (a * (6 * a - 15) + 10);
    }
    // smoothstep: 3t^2 - 2t^3
    const a = clamped;
    return a * a * (3 - 2 * a);
  }

  // Legacy-compatible surface height query based on multi-noise
  heightAt(x: number, z: number): number {
    const cfg = this.config;
    const wx = x + cfg.offsetX;
    const wz = z + cfg.offsetZ;
    // Sea level is used only in voxel fill; here we compute normalized height
    // Use world-unit scales directly for clear control
    const cont = this.fbm2D(this.continentalness, wx / (cfg.continentalnessScale || 512), wz / (cfg.continentalnessScale || 512), cfg.octaves, cfg.persistence, cfg.lacunarity, false);
    const ero = this.fbm2D(this.erosion, wx / (cfg.erosionScale || 256), wz / (cfg.erosionScale || 256), cfg.octaves, cfg.persistence, cfg.lacunarity, false);
    const pk = this.fbm2D(this.peaks, wx / (cfg.peaksScale || 192), wz / (cfg.peaksScale || 192), cfg.octaves, cfg.persistence, cfg.lacunarity, true);
    // Local relief (hills) at smaller scale so chunks aren't flat
    const reliefScale = Math.max(24, (cfg.scale || 48));
    const relief = this.fbm2D(this.peaks, wx / reliefScale, wz / reliefScale, 3, 0.5, 2.0, false);

    // Normalize to [0,1]
    const cont01 = (cont + 1) * 0.5; // 0..1 (ocean->land)
    const ero01 = (ero + 1) * 0.5;   // 0..1 (eroded->not)
    const pk01 = (pk + 1) * 0.5;     // 0..1 (valleys->peaks)

    // Base elevation primarily by continentalness (ocean vs land)
    const base = cont01;
    // Peaks amplified in low-erosion regions
    const mountain = Math.max(0, pk01 - 0.5) * (1.0 - ero01);
    // Local relief contribution
    const relief01 = (relief + 1) * 0.5;
    // Emphasize dramatic mountain steepness under mountains preset
    const heightPreset = (this.config as any).biomePreset as ('greenery' | 'desert' | 'mountains' | undefined);
    const baseWeight = heightPreset === 'mountains' ? 0.4 : 0.5;
    const mountainWeight = heightPreset === 'mountains' ? 0.9 : 0.6;
    const reliefWeight = heightPreset === 'mountains' ? 0.5 : 0.6;
    let n = base * baseWeight + mountain * mountainWeight + (relief01 - 0.5) * reliefWeight;
    if (cfg.useErosionCurve) n = this.shapeCurve(n);
    n = Math.min(1, Math.max(0, n));
    // Map normalized elevation directly into [0, heightScale]
    // Sea level is a separate threshold; this allows ground < sea for lakes/ocean
    const h = Math.floor(n * Math.max(0, cfg.heightScale));
    return Number.isFinite(h) ? h : 0;
  }

  // 3D voxel generation API. Returns a dense voxel field and column heights.
  // Note: The caller is responsible for positioning via chunk transforms; we use local indices here.
  generateChunkVoxels(cx: number, cz: number, opts: { sizeX: number; sizeZ: number; sizeY?: number }): { sizeX: number; sizeY: number; sizeZ: number; voxels: Uint8Array; heights: Uint16Array; seaLevel: number } {
    const cfg = this.config;
    const sizeX = opts.sizeX; const sizeZ = opts.sizeZ; const sizeY = Math.max(1, opts.sizeY ?? (cfg.heightScale + 16));
    const halfX = Math.floor(sizeX / 2); const halfZ = Math.floor(sizeZ / 2);
    const seaLevel = cfg.seaLevel ?? Math.floor(cfg.heightScale * 0.5);
    const voxels = new Uint8Array(sizeX * sizeY * sizeZ);
    const heights = new Uint16Array(sizeX * sizeZ);

    // Helper lambdas
    const idx3 = (x: number, y: number, z: number) => z * sizeX * sizeY + y * sizeX + x;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const wx = cx * sizeX + x - halfX;
        const wz = cz * sizeZ + z - halfZ;
        const wox = wx + cfg.offsetX;
        const woz = wz + cfg.offsetZ;

        // Multi-noise fields (use dedicated scales)
        const cont = this.fbm2D(this.continentalness, wox / (cfg.continentalnessScale || 512), woz / (cfg.continentalnessScale || 512), cfg.octaves, cfg.persistence, cfg.lacunarity, false);
        const ero = this.fbm2D(this.erosion, wox / (cfg.erosionScale || 256), woz / (cfg.erosionScale || 256), cfg.octaves, cfg.persistence, cfg.lacunarity, false);
        const pk = this.fbm2D(this.peaks, wox / (cfg.peaksScale || 192), woz / (cfg.peaksScale || 192), cfg.octaves, cfg.persistence, cfg.lacunarity, true);
        const temp = this.fbm2D(this.temperature, wox / (cfg.temperatureScale || 1024), woz / (cfg.temperatureScale || 1024), 3, 0.55, 2.1, false);
        const humid = this.fbm2D(this.humidity, wox / (cfg.humidityScale || 1024), woz / (cfg.humidityScale || 1024), 3, 0.6, 2.0, false);
        // Local relief to avoid flat chunks
        const reliefScale = Math.max(24, (cfg.scale || 48));
        const relief = this.fbm2D(this.peaks, wox / reliefScale, woz / reliefScale, 3, 0.5, 2.0, false);

        const cont01 = (cont + 1) * 0.5;
        const ero01 = (ero + 1) * 0.5;
        const pk01 = (pk + 1) * 0.5;
        const temp01 = (temp + 1) * 0.5;
        const humid01 = (humid + 1) * 0.5;

        // Height shaping
        const base = cont01;
        const mountain = Math.max(0, pk01 - 0.5) * (1.0 - ero01);
        const relief01 = (relief + 1) * 0.5;
        const biomePreset = (cfg as any).biomePreset as ('greenery' | 'desert' | 'mountains' | undefined);
        const baseWeight = biomePreset === 'mountains' ? 0.4 : 0.5;
        const mountainWeight = biomePreset === 'mountains' ? 0.9 : 0.6;
        const reliefWeight = biomePreset === 'mountains' ? 0.5 : 0.6;
        let elevation = base * baseWeight + mountain * mountainWeight + (relief01 - 0.5) * reliefWeight;
        if (cfg.useErosionCurve) elevation = this.shapeCurve(clamp01(elevation));
        // Map normalized elevation directly into [0, heightScale]
        // Sea level handled during fill to create visible water bodies
        const groundH = Math.floor(clamp01(elevation) * Math.max(0, cfg.heightScale));

        // Biome selection
        let biome: 'desert' | 'mountain' | 'snow' | 'greenery' = 'greenery';
        const isMountain = mountain > 0.25 && groundH > seaLevel + 8;
        if (temp01 > 0.65 && humid01 < 0.35 && cont01 > 0.45) biome = 'desert';
        else if (isMountain && temp01 < 0.45) biome = 'snow';
        else if (isMountain) biome = 'mountain';
        // Apply hard preset override when provided via world config
        const hardPreset = (cfg as any).biomePreset as ('greenery' | 'desert' | 'mountains' | undefined);
        if (hardPreset === 'desert') biome = 'desert';
        else if (hardPreset === 'greenery') biome = 'greenery';
        else if (hardPreset === 'mountains') biome = (groundH > seaLevel + 10) ? 'snow' : 'mountain';

        // Column fill
        let topSolid = -1;
        for (let y = 0; y < sizeY; y++) {
          const iw = idx3(x, y, z);
          // Allow bedrock-ish bottom
          if (y === 0) { voxels[iw] = 3; continue; } // Stone
          if (y > groundH) {
            // Underwater fill up to sea level
            if (y <= seaLevel) {
              voxels[iw] = 5; // Water
            } else {
              voxels[iw] = 0; // Air
            }
            continue;
          }

          // Determine cave carving
          // World-relative coordinates for 3D noise; scale controls cavity size
          const caveScale = (cfg.caveScale || 96);
          const caveDetailScale = (cfg.caveDetailScale || 32);
          const cpx = (wx + cfg.offsetX) / caveScale;
          const cpy = (y + 0) / caveScale;
          const cpz = (wz + cfg.offsetZ) / caveScale;
          const dpx = (wx + cfg.offsetX) / caveDetailScale;
          const dpy = (y + 0) / caveDetailScale;
          const dpz = (wz + cfg.offsetZ) / caveDetailScale;
          const c1 = this.cavesPrimary.noise3D(cpx, cpy, cpz);
          const c2 = this.cavesDetail.noise3D(dpx, dpy, dpz);
          const caveValue = Math.abs(c1 * 0.8 + c2 * 0.2);
          const caveThreshold = (cfg.caveThreshold ?? 0.1);
          const carve = caveValue > (1.0 - caveThreshold);

          if (carve && y < groundH - 1 && y > 4) {
            voxels[iw] = (y <= seaLevel) ? 5 : 0; // Carve; water if below sea
            continue;
          }

          // Surface and subsurface composition
          const depthFromTop = groundH - y;
          if (depthFromTop === 0) {
            // Top block by biome
            if (biome === 'desert') voxels[iw] = 4; // Sand
            else if (biome === 'snow') voxels[iw] = 6; // Snow (surface)
            else if (biome === 'mountain') voxels[iw] = 3; // Stone top
            else voxels[iw] = 1; // Grass
            topSolid = Math.max(topSolid, y);
          } else if (depthFromTop <= 3) {
            // Subsurface: dirt or sand depending on biome
            voxels[iw] = (biome === 'desert') ? 4 : 2; // Sand or Dirt
            topSolid = Math.max(topSolid, y);
          } else {
            voxels[iw] = 3; // Stone
            topSolid = Math.max(topSolid, y);
          }
        }

        heights[z * sizeX + x] = Math.max(0, topSolid);
      }
    }

    return { sizeX, sizeY, sizeZ, voxels, heights, seaLevel };
  }

  sampleClimate(x: number, z: number): { cont01: number; ero01: number; pk01: number; temp01: number; humid01: number; mountain: number; biome: 'desert' | 'mountain' | 'snow' | 'greenery' } {
    const cfg = this.config;
    const wox = x + cfg.offsetX; const woz = z + cfg.offsetZ;
    const cont = this.fbm2D(this.continentalness, wox / (cfg.continentalnessScale || 512), woz / (cfg.continentalnessScale || 512), cfg.octaves, cfg.persistence, cfg.lacunarity, false);
    const ero = this.fbm2D(this.erosion, wox / (cfg.erosionScale || 256), woz / (cfg.erosionScale || 256), cfg.octaves, cfg.persistence, cfg.lacunarity, false);
    const pk = this.fbm2D(this.peaks, wox / (cfg.peaksScale || 192), woz / (cfg.peaksScale || 192), cfg.octaves, cfg.persistence, cfg.lacunarity, true);
    const temp = this.fbm2D(this.temperature, wox / (cfg.temperatureScale || 1024), woz / (cfg.temperatureScale || 1024), 3, 0.55, 2.1, false);
    const humid = this.fbm2D(this.humidity, wox / (cfg.humidityScale || 1024), woz / (cfg.humidityScale || 1024), 3, 0.6, 2.0, false);
    const cont01 = (cont + 1) * 0.5; const ero01 = (ero + 1) * 0.5; const pk01 = (pk + 1) * 0.5; const temp01 = (temp + 1) * 0.5; const humid01 = (humid + 1) * 0.5;
    const mountain = Math.max(0, pk01 - 0.5) * (1.0 - ero01);
    let biome: 'desert' | 'mountain' | 'snow' | 'greenery' = 'greenery';
    if (temp01 > 0.65 && humid01 < 0.35 && cont01 > 0.45) biome = 'desert';
    else if (mountain > 0.25 && temp01 < 0.45) biome = 'snow';
    else if (mountain > 0.25) biome = 'mountain';
    const preset = (cfg as any).biomePreset as ('greenery' | 'desert' | 'mountains' | undefined);
    if (preset === 'desert') biome = 'desert';
    else if (preset === 'greenery') biome = 'greenery';
    else if (preset === 'mountains') biome = (this.heightAt(x, z) > (cfg.seaLevel ?? Math.floor(cfg.heightScale * 0.5)) + 10) ? 'snow' : 'mountain';
    return { cont01, ero01, pk01, temp01, humid01, mountain, biome };
  }

  getBiomeAt(x: number, z: number): 'desert' | 'mountain' | 'snow' | 'greenery' {
    return this.sampleClimate(x, z).biome;
  }
}


