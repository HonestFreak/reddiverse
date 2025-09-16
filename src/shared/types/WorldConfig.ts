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
    scale: 120,
    heightScale: 40,
    octaves: 5,
    persistence: 0.5,
    lacunarity: 2.0,
    offsetX: 0,
    offsetZ: 0,
    useRidged: false,
    useErosionCurve: true,
    seaLevel: 9,
    continentalnessScale: 512,
    erosionScale: 256,
    peaksScale: 192,
    temperatureScale: 1024,
    humidityScale: 1024,
    caveScale: 96,
    caveDetailScale: 32,
    caveThreshold: 0.1,
    biomePreset: terrainType,
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
        seaLevel: 2,
        continentalnessScale: 600,
        erosionScale: 300,
        peaksScale: 220,
        temperatureScale: 800,
        humidityScale: 900,
        caveScale: 110,
        caveDetailScale: 36,
        caveThreshold: 0.12,
        biomePreset: 'desert',
      };
      case 'mountains':
        return {
          seed,
          scale: 80,
          heightScale: 64,
          octaves: 6,
          persistence: 0.38,
          lacunarity: 2.25,
          offsetX: base.offsetX,
          offsetZ: base.offsetZ,
          useRidged: true,
          // Disable erosion curve; we shape with smootherstep in generator for S-profile
          useErosionCurve: false,
          seaLevel: 8,
          continentalnessScale: 700,
          erosionScale: 260,
          peaksScale: 170,
          temperatureScale: 1200,
          humidityScale: 1000,
          caveScale: 90,
          caveDetailScale: 28,
          caveThreshold: 0.08,
          biomePreset: 'mountains',
        };
    case 'greenery':
    default:
      // For greenery, keep erosion curve off to allow deeper basins; sea level from base is higher
      return { seed, ...base, useErosionCurve: false, biomePreset: 'greenery' };
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


