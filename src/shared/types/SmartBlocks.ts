export type BlockTexture = {
  type: 'color' | 'image';
  value: string; // hex color or absolute/relative URL
};

export type BlockTextures = {
  top?: BlockTexture;
  side?: BlockTexture;
  bottom?: BlockTexture;
};

// Declarative, safe action set that Smart Blocks can execute
export type SmartAction =
  | { type: 'setLife'; mode: 'set' | 'add' | 'subtract'; value: number }
  | { type: 'setWinner'; value: boolean }
  | { type: 'setBadge'; value: string }
  | { type: 'impulse'; axis: 'y'; amount: number }
  | {
      type: 'placeBlock';
      blockType: string;
      offset: { dx: number; dy: number; dz: number };
      persist?: boolean;
    }
  | {
      type: 'removeBlock';
      offset: { dx: number; dy: number; dz: number };
      persist?: boolean;
    };

export type SmartBlockDefinition = {
  id: string; // unique per post
  name: string;
  textures: BlockTextures;
  onClick?: SmartAction[];
  onTouch?: SmartAction[];
};

export type SmartBlocksResponse = {
  blocks: SmartBlockDefinition[];
};

export type PlayerState = {
  life: number; // 0..100
  isWinner: boolean;
  badge: string;
};


