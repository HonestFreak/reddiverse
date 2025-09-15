export type TerrainConfig = {
  seed: number;
  scale: number; // world units per noise unit (bigger = smoother)
  heightScale: number; // maximum terrain height in blocks
  octaves: number; // number of layers in fBm
  persistence: number; // amplitude falloff per octave
  lacunarity: number; // frequency increase per octave
  offsetX: number; // global offset for x
  offsetZ: number; // global offset for z
  useRidged: boolean; // if true, combine abs noise for ridged look
  useErosionCurve: boolean; // if true, curve heights for more plains
};

export type ChunkConfig = {
  sizeX: number; // blocks in X
  sizeZ: number; // blocks in Z
  blockSize: number; // world units per block (usually 1)
};

export type RenderConfig = {
  instanceColorSaturation: number; // HSL saturation for grass coloring
  minLightness: number; // HSL lightness at height 0
  maxLightness: number; // HSL lightness at height = heightScale
  baseHue: number; // 0..1 (0.33 ~ green)
  hueSlope: number; // hue delta across height [negative tilts towards yellow]
  showCollisionOutlines: boolean; // Show collision box outlines
};

export type ControlsConfig = {
  playerHeight: number;
  gravity: number;
  walkSpeed: number;
  sprintMultiplier: number;
  damping: number;
};

export type GameConfig = {
  terrain: TerrainConfig;
  chunk: ChunkConfig;
  render: RenderConfig;
  controls: ControlsConfig;
};

export const defaultGameConfig: GameConfig = {
  terrain: {
    seed: 1337,
    scale: 48,
    heightScale: 18,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    offsetX: 0,
    offsetZ: 0,
    useRidged: false,
    useErosionCurve: true,
  },
  chunk: {
    sizeX: 64,
    sizeZ: 64,
    blockSize: 1,
  },
  render: {
    instanceColorSaturation: 0.6,
    minLightness: 0.35,
    maxLightness: 0.8,
    baseHue: 0.33,
    hueSlope: -0.05,
    showCollisionOutlines: false,
  },
  controls: {
    playerHeight: 1.7,
    gravity: 30,
    walkSpeed: 8,
    sprintMultiplier: 1.7,
    damping: 8,
  },
};


