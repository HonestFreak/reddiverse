import { TerrainConfig } from '../config/gameConfig';

export type TerrainType = 'greenery' | 'desert' | 'mountains';

export type WorldConfig = {
  seed: number;
  terrainType: TerrainType;
  worldName: string;
  buildingPermission: 'public' | 'restricted';
  builders: string[];
  owner: string;
};

export type FoliageType =
  | { kind: 'none' }
  | { kind: 'tree'; variants: string[] }
  | { kind: 'cactus'; variants: string[] };

export function presetFoliage(terrainType: TerrainType): FoliageType {
  switch (terrainType) {
    case 'greenery':
      return { kind: 'tree', variants: ['oak', 'pine'] };
    case 'desert':
      return { kind: 'cactus', variants: ['saguaro', 'barrel'] };
    case 'mountains':
      return { kind: 'tree', variants: ['pine'] };
    default:
      return { kind: 'none' };
  }
}

export type OverlayConfig = {
  snowThresholdHeight: number; // y > threshold qualifies for snow
  snowDepth: number; // number of top blocks to convert to snow
};

export function presetOverlay(terrainType: TerrainType): OverlayConfig | null {
  switch (terrainType) {
    case 'mountains':
      return { snowThresholdHeight: 3, snowDepth: 3 };
    default:
      return null;
  }
}

export function getTerrainParamsForPreset(terrainType: TerrainType, seed: number): TerrainConfig {
  // Common defaults
  const base: Omit<TerrainConfig, 'seed'> = {
    scale: 48,
    heightScale: 18,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    offsetX: 0,
    offsetZ: 0,
    useRidged: false,
    useErosionCurve: true,
  };

  switch (terrainType) {
    case 'desert':
      return {
        seed,
        scale: 64,
        heightScale: 12,
        octaves: 3,
        persistence: 0.45,
        lacunarity: 2.2,
        offsetX: 0,
        offsetZ: 0,
        useRidged: false,
        useErosionCurve: false,
      };
      case 'mountains':
        return {
          seed,
          scale: 120,              // Larger scale → broader mountain ranges, not too noisy
          heightScale: 40,        // Higher peaks than greenery (try 40–80 range)
          octaves: 5,             // More detail across scales
          persistence: 0.45,      // How much each octave contributes (lower = less smooth)
          lacunarity: 2.0,        // Frequency growth per octave (higher = jaggier)
          offsetX: base.offsetX,  // Keep world offset consistent
          offsetZ: base.offsetZ,
          useRidged: true,        // Ridged noise is great for sharp mountain ridges
          useErosionCurve: true,  // Adds natural slope/erosion feel
        };
    case 'greenery':
    default:
      return { seed, ...base };
  }
}

export function presetSurfaceBlockId(terrainType: TerrainType): string {
  switch (terrainType) {
    case 'desert':
      return 'sand';
    case 'mountains':
      return 'stone';
    case 'greenery':
    default:
      return 'grass';
  }
}


