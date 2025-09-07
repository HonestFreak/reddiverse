# Voxel Game - Reddit Devvit App

A multiplayer voxel-based 3D game built for Reddit's Devvit platform. Players can explore a procedurally generated voxel world, place and remove blocks, and interact with other players in real-time.

## 🎮 Features

### Core Gameplay
- **3D Voxel World**: Procedurally generated terrain with height-based coloring
- **Multiplayer Support**: Real-time player presence and movement synchronization
- **Block Building**: Place and remove voxel blocks (grass, stone, wood, sand, water)
- **Physics**: Gravity, jumping, collision detection, and smooth movement
- **Cross-Platform**: Works on both desktop and mobile devices

### Controls

#### Desktop
- **W/S**: Move forward/backward
- **A/D**: Rotate left/right
- **Space**: Jump
- **Shift**: Sprint
- **Mouse**: Look around (click to lock pointer)
- **Left Click**: Place block
- **Right Click**: Remove block

#### Mobile
- **Touch & Drag**: Look around
- **Virtual Joystick**: Move and rotate
- **Jump Button**: Jump
- **Sprint Button**: Sprint
- **Tap Blocks**: Place/remove blocks

### Creator Mode
- **Block Selection**: Choose from different block types
- **Visual Block Editor**: Real-time block placement and removal
- **Persistent Building**: Blocks are saved and synchronized across all players

## 🏗️ Architecture

### Project Structure
```
src/
├── client/           # Frontend webview (Three.js)
│   ├── App.tsx       # React Three Fiber implementation
│   ├── FallbackVoxel.tsx  # Main working implementation
│   └── main.tsx      # Entry point
├── server/           # Backend API (Express.js)
│   ├── index.ts      # Main server with all endpoints
│   └── core/post.ts  # Post creation logic
└── shared/           # Shared types
    └── types/api.ts  # TypeScript interfaces
```

### Technology Stack
- **Frontend**: React, Three.js, TypeScript, Vite
- **Backend**: Express.js, Node.js
- **Platform**: Reddit Devvit
- **Real-time**: WebSocket-like realtime connections
- **Storage**: Redis for presence, Reddit post data for blocks
- **3D Graphics**: Three.js with custom physics

## 🚀 How It Works

### 1. Game Initialization
- The app loads in a Reddit post context
- Initializes 3D scene with Three.js
- Detects device type (mobile/desktop) for appropriate controls
- Connects to realtime multiplayer system

### 2. World Generation
- **Procedural Terrain**: Uses sine/cosine functions to generate height maps
- **Voxel Rendering**: Creates individual 1x1x1 blocks for terrain
- **Color Variation**: Height-based coloring (darker at higher elevations)
- **Ground Plane**: Large flat surface as the base

### 3. Player System
- **Physics Engine**: Custom physics with gravity, velocity, and collision
- **Camera System**: Third-person chase camera that follows the player
- **Movement**: Smooth WASD movement with sprint and jump mechanics
- **Collision Detection**: Ground collision and block interaction

### 4. Multiplayer Architecture
- **Presence System**: Tracks all players in the current post
- **Real-time Updates**: Position updates every 125ms
- **Player Avatars**: Colored spheres with usernames
- **Synchronization**: All players see each other's movements in real-time

### 5. Block System
- **Persistence**: Blocks are stored in Reddit post data
- **Real-time Sync**: Block changes are synchronized across all players
- **Raycasting**: Click/touch detection for precise block placement
- **Creator Mode**: Only post creators can place/remove blocks

### 6. Mobile Support
- **Touch Controls**: Virtual joystick for movement and rotation
- **Responsive UI**: Mobile-optimized interface
- **Performance**: Optimized rendering for mobile devices

## 🔧 Development

### Prerequisites
- Node.js 22+
- Reddit Developer Account
- Devvit CLI

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Login to Devvit: `npm run login`
4. Start development: `npm run dev`

### Available Scripts
- `npm run dev`: Start development server with hot reload
- `npm run build`: Build client and server
- `npm run deploy`: Deploy to Reddit
- `npm run launch`: Publish for review
- `npm run check`: Type check and lint

### Key Files

#### `FallbackVoxel.tsx` (Main Implementation)
This is the primary working implementation that includes:
- Complete 3D scene setup
- Physics and movement system
- Mobile and desktop controls
- Multiplayer integration
- Block building system
- Real-time synchronization

#### `src/server/index.ts`
Backend API endpoints:
- `/api/init`: Initialize game session
- `/api/presence`: Get current players
- `/api/join`/`/api/leave`: Player session management
- `/api/pos`: Update player position
- `/api/blocks/*`: Block persistence

#### `src/shared/types/api.ts`
TypeScript interfaces for:
- Player positions and movement
- Block data structures
- Real-time message types
- API request/response formats

## 🎯 Game Mechanics

### Physics System
- **Gravity**: Constant downward acceleration
- **Jumping**: Upward velocity with ground collision detection
- **Movement**: Smooth acceleration/deceleration with damping
- **Collision**: Ground and block collision detection

### Block Building
- **Raycasting**: Precise block placement using 3D ray intersection
- **Adjacent Placement**: Blocks are placed adjacent to clicked faces
- **Persistence**: All blocks are saved to Reddit post data
- **Synchronization**: Changes are broadcast to all players

### Multiplayer
- **Presence Tracking**: Redis stores current player positions
- **Real-time Updates**: WebSocket-like connections for live updates
- **Player Avatars**: Visual representation with color-coded usernames
- **Smooth Interpolation**: Players see smooth movement of others

## 🔮 Future Enhancements

- **Inventory System**: Collect and manage different block types
- **Advanced Physics**: Water, lava, and other environmental effects
- **World Persistence**: Save and load custom worlds
- **Social Features**: Chat, friend systems, achievements
- **Performance Optimization**: Chunk loading, LOD systems
- **Mobile Improvements**: Better touch controls, UI optimization

## 📱 Platform Integration

This app is built for Reddit's Devvit platform, which provides:
- **Post Context**: Each game instance is tied to a Reddit post
- **User Authentication**: Automatic Reddit user identification
- **Real-time Infrastructure**: Built-in WebSocket-like connections
- **Data Persistence**: Redis and Reddit post data storage
- **Deployment**: Easy deployment and distribution through Reddit

## 🐛 Known Issues

- Mobile performance can be limited on older devices
- Block placement can be imprecise on very small screens
- Real-time connections may occasionally drop (has fallback polling)
- Some Three.js features may not work on all mobile browsers

## 📄 License

BSD-3-Clause License - see LICENSE file for details.