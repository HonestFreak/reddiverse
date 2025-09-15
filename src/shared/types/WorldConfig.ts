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
    seaLevel: 9,
    continentalnessScale: 512,
    erosionScale: 256,
    peaksScale: 192,
    temperatureScale: 1024,
    humidityScale: 1024,
    caveScale: 96,
    caveDetailScale: 32,
    caveThreshold: 0.1,
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
        seaLevel: 5,
        continentalnessScale: 600,
        erosionScale: 300,
        peaksScale: 220,
        temperatureScale: 800,
        humidityScale: 900,
        caveScale: 110,
        caveDetailScale: 36,
        caveThreshold: 0.12,
      };
      case 'mountains':
        return {
          seed,
          scale: 120,
          heightScale: 40,
          octaves: 5,
          persistence: 0.45,
          lacunarity: 2.0,
          offsetX: base.offsetX,
          offsetZ: base.offsetZ,
          useRidged: true,
          useErosionCurve: true,
          seaLevel: 12,
          continentalnessScale: 700,
          erosionScale: 300,
          peaksScale: 180,
          temperatureScale: 1200,
          humidityScale: 1000,
          caveScale: 90,
          caveDetailScale: 28,
          caveThreshold: 0.08,
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


