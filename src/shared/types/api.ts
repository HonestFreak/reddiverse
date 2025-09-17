export type InitResponse = {
  type: "init";
  postId: string;
  username: string;
  count?: number; // kept for backward compatibility
};

// Multiplayer realtime types
export type PlayerPosition = {
  x: number;
  y: number;
  z: number;
  // Y-axis rotation in radians, camera yaw
  yaw: number;
};

export type GameRealtimeMessage =
  | {
      type: "join";
      user: string;
      position: PlayerPosition;
    }
  | {
      type: "leave";
      user: string;
    }
  | {
      type: "pos";
      user: string;
      position: PlayerPosition;
    };

// Blocks persistence types
export type VoxelBlock = {
  x: number;
  y: number;
  z: number;
  // Optional semantic type and color used by the client to render
  type?: string | undefined;
  color?: string | undefined;
};

export type BlocksResponse = {
  blocks: VoxelBlock[];
};

export type AddBlockRequest = {
  x: number;
  y: number;
  z: number;
  type?: string;
  color?: string;
};

export type RemoveBlockRequest = {
  x: number;
  y: number;
  z: number;
};

// Server forms: declare names for reference
export type ServerForms = {
  worldConfigCreateForm: string;
  smartBlockCreateForm: string;
};
