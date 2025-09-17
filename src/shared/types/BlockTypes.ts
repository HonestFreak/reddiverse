export interface BlockTexture {
  type: 'color' | 'image';
  value: string; // Color hex string or image path (public URL)
}

export interface BlockTextures {
  top?: BlockTexture;
  side?: BlockTexture;
  bottom?: BlockTexture;
}

export interface BlockType {
  id: string;
  name: string;
  textures: BlockTextures;
  fallbackColor?: string;
}

export type BlockTypeRegistry = Record<string, BlockType>;

export const defaultBlockTypes: BlockTypeRegistry = {
  grass: {
    id: 'grass',
    name: 'Grass',
    textures: {
      top: { type: 'image', value: '/grass_top.png' },
      side: { type: 'image', value: '/grass_side.png' },
      bottom: { type: 'color', value: '#4a7c59' }
    },
    fallbackColor: '#4a7c59'
  },
  stone: {
    id: 'stone',
    name: 'Stone',
    textures: {
      top: { type: 'color', value: '#8a8a8a' },
      side: { type: 'color', value: '#8a8a8a' },
      bottom: { type: 'color', value: '#8a8a8a' }
    },
    fallbackColor: '#8a8a8a'
  },
  wood: {
    id: 'wood',
    name: 'Wood',
    textures: {
      top: { type: 'color', value: '#8b4513' },
      side: { type: 'color', value: '#8b4513' },
      bottom: { type: 'color', value: '#8b4513' }
    },
    fallbackColor: '#8b4513'
  },
  sand: {
    id: 'sand',
    name: 'Sand',
    textures: {
      top: { type: 'color', value: '#f4e4bc' },
      side: { type: 'color', value: '#f4e4bc' },
      bottom: { type: 'color', value: '#f4e4bc' }
    },
    fallbackColor: '#f4e4bc'
  },
  water: {
    id: 'water',
    name: 'Water',
    textures: {
      top: { type: 'color', value: '#4a90e2' },
      side: { type: 'color', value: '#4a90e2' },
      bottom: { type: 'color', value: '#4a90e2' }
    },
    fallbackColor: '#4a90e2'
  },
  light: {
    id: 'light',
    name: 'Light',
    textures: {
      top: { type: 'color', value: '#fff6b3' },
      side: { type: 'color', value: '#fff6b3' },
      bottom: { type: 'color', value: '#fff6b3' }
    },
    fallbackColor: '#fff6b3'
  },
  jumper: {
    id: 'jumper',
    name: 'Jumper',
    textures: {
      top: { type: 'image', value: '/jumper_top.png' },
      side: { type: 'color', value: '#6a5acd' },
      bottom: { type: 'color', value: '#6a5acd' }
    },
    fallbackColor: '#6a5acd'
  },
  lava: {
    id: 'lava',
    name: 'Lava',
    textures: {
      top: { type: 'image', value: '/lava.png' },
      side: { type: 'image', value: '/lava.png' },
      bottom: { type: 'image', value: '/lava.png' }
    },
    fallbackColor: '#ff2d55'
  },
  winner: {
    id: 'winner',
    name: 'Winner',
    textures: {
      top: { type: 'color', value: '#34c759' },
      side: { type: 'color', value: '#34c759' },
      bottom: { type: 'color', value: '#34c759' }
    },
    fallbackColor: '#34c759'
  },
  snow: {
    id: 'snow',
    name: 'Snow',
    textures: {
      top: { type: 'color', value: '#ffffff' },
      side: { type: 'color', value: '#e6f0ff' },
      bottom: { type: 'color', value: '#ffffff' }
    },
    fallbackColor: '#ffffff'
  },
  leaf: {
    id: 'leaf',
    name: 'Leaf',
    textures: {
      top: { type: 'image', value: '/leaf.png' },
      side: { type: 'image', value: '/leaf.png' },
      bottom: { type: 'image', value: '/leaf.png' }
    },
    fallbackColor: '#3ba84a'
  },
  cactus: {
    id: 'cactus',
    name: 'Cactus',
    textures: {
      top: { type: 'image', value: '/cactus.png' },
      side: { type: 'image', value: '/cactus.png' },
      bottom: { type: 'image', value: '/cactus.png' }
    },
    fallbackColor: '#3ba84a'
  },
  chiseled_stone: {
    id: 'chiseled_stone',
    name: 'Chiseled Stone',
    textures: {
      top: { type: 'image', value: '/chiseled_stone.png' },
      side: { type: 'image', value: '/chiseled_stone.png' },
      bottom: { type: 'image', value: '/chiseled_stone.png' }
    },
    fallbackColor: '#8a8a8a'
  },
  dirt: {
    id: 'dirt',
    name: 'Dirt',
    textures: {
      top: { type: 'image', value: '/dirt.png' },
      side: { type: 'image', value: '/dirt.png' },
      bottom: { type: 'image', value: '/dirt.png' }
    },
    fallbackColor: '#8b4513'
  }
};


