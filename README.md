# Reddiverse

**Reddiverse** is a real-time multiplayer voxel game engine built for Reddit's Devvit platform. It combines procedural world generation, multiplayer synchronization, and a programmable block system to create an immersive 3D experience where players can explore, build, and create custom game mechanics.

## 🌍 Multiple Biomes

Reddiverse features three distinct biomes, each with unique terrain generation and visual characteristics:

### **Greenery** 🌱
- Lush grasslands with rolling hills and valleys
- Dense forests with various tree types
- Water bodies and rivers
- Rich vegetation and foliage

### **Desert** 🏜️
- Vast sand dunes and arid landscapes
- Sparse vegetation with different cactus types
- Low elevation with minimal water features
- Warm, dry climate simulation

### **Mountains** ⛰️
- Steep rocky terrain with dramatic elevation changes
- Snow-capped peaks at high altitudes
- Challenging vertical landscapes
- Cool climate with snow overlays

The modular biome system makes it easy to add new biomes by extending the terrain generation parameters and visual assets.

## 🧱 Three Categories of Voxels

### **Normal Blocks**
Standard building blocks with static textures and properties:
- **Grass**: Natural ground covering with different textures for top/side/bottom
- **Stone**: Solid building material
- **Wood**: Organic construction material
- **Sand**: Desert terrain material
- **Water**: Transparent liquid blocks
- **Light**: Illumination blocks

### **Special Blocks**
Interactive blocks that perform specific game mechanics:

#### **Jumper Block** 🦘
- Provides upward impulse when players stand on it
- Enables high jumps and vertical movement
- Customizable jump strength

#### **Water Block** 💧
- Advanced flow mechanics with spreading behavior
- Players can pass through water blocks
- Dynamic water group management with containment detection
- Realistic water physics simulation

#### **Light Block** 💡
- Emits dynamic lighting in the world
- Affects surrounding area illumination
- Integrates with the day/night cycle system

#### **Lava Block** 🌋
- Pass-through block that damages players on contact
- Triggers player death when touched
- Visual hazard with distinct appearance

#### **Kill Block** ⚰️
- Instant death trigger on contact
- Resets when player leaves the area
- Useful for creating death traps and challenges

#### **Winner Block** 🏆
- Triggers win condition when player enters
- Sets `isWinner` status to true
- Enables custom victory mechanics

### **Smart Blocks** 🧠
The most powerful feature - programmable blocks that allow users to create custom game logic:

#### **Custom Actions**
Smart blocks can execute various actions:
- **Life Management**: Set, add, or subtract player health
- **Win Conditions**: Set winner status
- **Badge System**: Assign custom player badges
- **Physics**: Apply upward impulses (jumping)
- **World Modification**: Place or remove blocks at specific offsets
- **State Management**: Modify player and environment properties

#### **Example Smart Block Configurations**
```typescript
// Lava Block - Damages player
{
  name: "Custom Lava",
  onClick: [{ type: "setLife", mode: "subtract", value: 20 }]
}

// Winner Block - Triggers victory
{
  name: "Victory Block", 
  onTouch: [{ type: "setWinner", value: true }]
}

// Status Block - Changes player badge
{
  name: "Elite Block",
  onClick: [{ type: "setBadge", value: "elite" }]
}

// Modified Jumper - Extra high jump
{
  name: "Super Jumper",
  onTouch: [{ type: "impulse", axis: "y", amount: 15 }]
}
```

#### **Custom Textures**
- Upload custom images for block appearances
- Support for different textures per face (top, side, bottom)
- Fallback color system for failed texture loads

## 🌅 Day/Night Cycle System

### **15-Minute Real-Time Cycles**
- **Synchronized Time**: All players see identical time using real-world minutes
- **Time Formula**: `(currentMinute % 15) / 15` - creates 4 cycles per hour
- **Global Sync**: Every player experiences dawn, noon, sunset, night simultaneously
- **Cloud Movement**: Dynamic cloud systems respond to time-of-day lighting
- **Atmospheric Transitions**: Smooth color gradients across sky, clouds, and lighting

### **Dynamic Sky System**
- **Skybox Rendering**: Custom shaders with smooth gradients and sun glow effects
- **Sun & Moon**: Dynamic positioning based on time of day
- **Star Field**: Procedural star generation for night scenes
- **Atmospheric Effects**: Fog and depth perception enhancements

### **Cloud System** ☁️
- **Multiple Cloud Types**: Cumulus, Stratus, Cirrus, and Storm clouds
- **Procedural Generation**: Organic cloud shapes using cube-based geometry
- **Wind Effects**: Dynamic cloud movement and positioning
- **Time-of-Day Integration**: Clouds change color and opacity based on lighting
- **Configurable Parameters**: Density, wind speed, and direction controls

### **Lighting Transitions**
- **Dawn**: Warm pinkish lighting with soft transitions
- **Day**: Bright, clear lighting with full visibility
- **Sunset**: Warm orange/red atmospheric effects
- **Night**: Dark, bluish lighting with enhanced stars

## 🏗️ Technical Architecture

### **Terrain Generation**

Reddiverse uses a sophisticated multi-layered Perlin noise system to create realistic, varied terrain. The system combines multiple noise fields with different scales and purposes to generate natural-looking landscapes.

#### **Perlin Noise Types**

**2D Noise Fields (Terrain Shaping):**
- **Continentalness**: Controls land vs ocean distribution (scale: 512-700 world units)
- **Erosion**: Simulates river basins and eroded valleys (scale: 256-300 world units)  
- **Peaks**: Creates mountain ridges and valleys (scale: 170-220 world units)
- **Temperature**: Determines climate bands for biome selection (scale: 800-1200 world units)
- **Humidity**: Controls moisture levels for biome determination (scale: 900-1000 world units)

**3D Noise Fields (Cave Generation):**
- **Caves Primary**: Large-scale cave systems (scale: 90-110 world units)
- **Caves Detail**: Fine cave details and passages (scale: 28-36 world units)

#### **Fractal Brownian Motion (fBm)**
Each noise field uses multi-octave fractal noise with configurable parameters:
- **Octaves**: Number of noise layers (3-6 depending on biome)
- **Persistence**: Amplitude falloff per octave (0.38-0.55)
- **Lacunarity**: Frequency increase per octave (2.0-2.25)
- **Ridged Mode**: For peaks noise, creates sharp mountain ridges

#### **Height Calculation Weights**
The final terrain height combines multiple factors with biome-specific weights:

**Base Elevation:**
- Continentalness weight: 0.4-0.5 (determines land vs ocean)
- Mountain weight: 0.6-0.9 (amplifies peaks in low-erosion areas)
- Relief weight: 0.5-0.6 (adds local hills and valleys)

**Erosion Effects:**
- Mountains are amplified in low-erosion regions: `mountain = max(0, peaks - 0.5) * (1.0 - erosion)`
- Erosion reduces mountain height, creating more realistic terrain

#### **Biome-Specific Configurations**

**Desert Biome:**
- Scale: 64 (smoother terrain)
- Height Scale: 12 blocks (low elevation)
- Octaves: 3 (simpler noise)
- Sea Level: 2 blocks (minimal water)
- No erosion curve (natural dune shapes)
- Continentalness Scale: 600 (larger land masses)

**Mountains Biome:**
- Scale: 80 (moderate detail)
- Height Scale: 64 blocks (high elevation)
- Octaves: 6 (complex noise)
- Sea Level: 8 blocks
- Ridged mode enabled (sharp peaks)
- Continentalness Scale: 700 (dramatic elevation changes)

**Greenery Biome:**
- Scale: 120 (smooth, rolling hills)
- Height Scale: 40 blocks (moderate elevation)
- Octaves: 5 (balanced complexity)
- Sea Level: 9 blocks
- Erosion curve disabled (allows deeper valleys for water)

#### **Water Bodies and Sea Level**
- **Sea Level**: Configurable water level (2-9 blocks depending on biome)
- **Underwater Terrain**: Areas below sea level fill with water blocks
- **Desert Exception**: Deserts have no standing water bodies
- **Cave Water**: Underground caves below sea level fill with water (except in deserts)
- **Surface Water**: Natural water bodies form in low-lying areas

#### **Cave Generation System**
- **3D Noise Combination**: Primary + detail noise for realistic cave shapes
- **Cave Threshold**: 0.08-0.12 (lower = more caves)
- **Depth Limits**: Caves only generate below surface and above bedrock (y > 4)
- **Water Integration**: Caves below sea level fill with water
- **Biome Awareness**: Desert caves don't fill with water

#### **Altitude and Snow System**
- **Snow Threshold**: Mountains above sea level + 10 blocks get snow overlay
- **Snow Depth**: 3 blocks of snow on qualifying mountain peaks
- **Temperature-Based**: Snow appears in cold, high-altitude areas
- **Visual Overlay**: Snow replaces surface blocks without changing terrain shape

#### **Foliage Generation**
The system procedurally places vegetation based on biome and climate:

**Foliage Density:**
- Uses dedicated Perlin noise for placement (scale: 256 world units)
- Biome multipliers: Desert (0.25), Snow (0.5), Greenery (1.0)
- Maximum per chunk: Desert (3), Snow (3), Greenery (7)

**Tree Variants (Greenery/Mountains):**
- **Small Trees** (50%): 3-block trunk, dense leaf canopy
- **Default Trees** (35%): 4-block trunk, 3x3 leaf canopy with branches
- **Big Trees** (15%): 5-block trunk, complex branching with multiple leaf clusters

**Cactus Variants (Desert):**
- **Small Cactus** (50%): 3-block column with 2 arms
- **Tall Cactus** (50%): 5-block column with 3 complex arms

**Placement Algorithm:**
- Tests 6 random positions per structure
- Selects highest elevation point for placement
- Ensures structures spawn on solid ground
- Collision detection for trunk/wood blocks only

#### **Seed System**
- **Deterministic Generation**: Same seed produces identical terrain
- **Noise Seeding**: Each noise field uses unique seed offsets for independence
- **Seed Offsets**: 
  - Continentalness: `seed + 0x9e3779b9`
  - Erosion: `seed + 0x85ebca6b`
  - Peaks: `seed + 0xc2b2ae35`
  - Temperature: `seed + 0x27d4eb2f`
  - Humidity: `seed + 0x165667b1`
  - Caves Primary: `seed + 0x27d4eb2f ^ 0x9e3779b9`
  - Caves Detail: `seed + 0x94d049bb ^ 0x85ebca6b`

#### **Erosion Curves**
- **Smoothstep**: `3t² - 2t³` for gentle lowlands (greenery/desert)
- **Smootherstep**: `6t⁵ - 15t⁴ + 10t³` for S-shaped mountain profiles
- **Purpose**: Creates more natural terrain transitions and exposes water bodies

### **Chunk System**
- **Chunk Size**: 64×64×96 blocks per chunk (4,096 blocks total)
- **Render Distance**: 1 chunk radius (3×3 = 9 chunks loaded simultaneously)
- **Memory Footprint**: ~37,000 blocks in memory at any time
- **Instanced Rendering**: Single mesh instances for repeated block types (1000x performance boost)
- **Dynamic Loading**: Chunks load/unload based on player proximity
- **Preloading**: Spawn area 3×3 chunks preloaded for instant interaction
- **Streaming**: Background loading of adjacent chunks for seamless exploration

### **Multiplayer Architecture**

#### **Devvit Platform Limitations**
- **No WebSockets**: Devvit's realtime system has connection limitations and reliability issues
- **Polling-Only Architecture**: Must use HTTP polling for position updates due to platform constraints
- **Connection Instability**: Realtime connections frequently drop, requiring fallback to polling
- **Rate Limiting**: Server-side throttling prevents overwhelming Reddit's infrastructure

#### **Adaptive Polling System**
- **Dynamic Frequency**: Starts at 2 Hz (500ms), scales down to 0.5 Hz (2000ms) on errors
- **Error-Based Backoff**: Consecutive failures increase polling interval exponentially
- **Connection Quality Detection**: Automatically adjusts based on response success rates
- **Server Protection**: Prevents overwhelming Reddit's servers with excessive requests

#### **Smooth Movement Interpolation**
- **Client-Side Prediction**: Local movement is immediate for responsive controls
- **Remote Player Smoothing**: Other players' movements interpolated between polling updates
- **Position Extrapolation**: Predicts movement direction when updates are delayed
- **Lag Compensation**: Maintains smooth gameplay despite network latency

#### **Technical Implementation**
- **Position Updates**: Throttled broadcasting (2-0.5 Hz based on connection quality)
- **Player Presence**: Redis-based presence tracking with automatic cleanup
- **Error Handling**: Automatic reconnection and graceful degradation to polling
- **Memory Management**: Efficient player state caching and cleanup

### **Performance Optimizations**

#### **Rendering Pipeline**
- **Instanced Meshes**: Single mesh instances for repeated block types (1000x performance boost)
- **Material Caching**: Reused materials across identical block faces to prevent duplicate creation
- **Geometry Caching**: Shared box geometry for all block types (memory efficient)
- **Texture Optimization**: Nearest-neighbor filtering, disabled mipmaps for pixel art
- **Render Order**: Water blocks render last (order 10) to reduce transparency sorting artifacts

#### **Memory Management**
- **Texture Caching**: Automatic texture loading with promise-based deduplication
- **Stale Position Cleanup**: Remote players removed after 5 seconds of inactivity
- **Water Group Management**: Automatic cleanup of empty water groups and settled water
- **Chunk Streaming**: Background loading with automatic memory cleanup

#### **Network Efficiency**
- **Delta Updates**: Only changed blocks synchronized (1-second polling)
- **Version Control**: Redis-based versioning prevents duplicate block updates
- **HTTP 304 Responses**: Server returns "Not Modified" when no changes exist
- **Conservative Polling**: 5 Hz position updates to avoid 503 errors

#### **Mobile Optimization**
- **Pixel Ratio Limiting**: `Math.min(window.devicePixelRatio, 2)` prevents excessive rendering
- **Power Preference**: `high-performance` GPU preference for better mobile performance
- **Fallback Rendering**: Graceful degradation to basic WebGL if advanced features fail

## 👥 Player Management System

### **Building Permissions**
- **Public Mode**: All players can build and modify the world
- **Restricted Mode**: Only world owner and designated builders can build
- **Builder Management**: Dynamic addition/removal of builder permissions
- **Owner Controls**: World creator has full administrative control

### **Player State System**
- **Health System**: 0-100 health points with death/respawn mechanics
- **Winner Status**: Boolean flag for victory conditions
- **Badge System**: Custom player status indicators
- **State Persistence**: Player state saved across sessions

### **World Configuration**
- **Terrain Type**: Selectable biome (greenery, desert, mountains)
- **Seed System**: Deterministic world generation
- **World Naming**: Custom world identification
- **Permission Management**: Granular control over building rights

## 🎮 Game Mechanics

### **Physics System**
- **Gravity**: Realistic downward acceleration
- **Collision Detection**: Ground and block interaction
- **Movement**: Smooth WASD controls with acceleration/deceleration
- **Jumping**: Physics-based jumping with ground detection
- **Sprint**: Enhanced movement speed

### **Block Interaction**
- **Raycasting**: Precise block placement using 3D ray intersection
- **Adjacent Placement**: Blocks placed next to clicked faces
- **Dual Persistence**: Redis for real-time sync + Reddit post data for long-term storage
- **Version Control**: Redis-based versioning with `incrBy` for atomic updates
- **Delta Synchronization**: Only changed blocks transmitted (1-second polling)
- **Migration System**: Automatic migration from old post data format to Redis

### **Mobile Support**
- **Touch Controls**: Virtual joystick for movement and rotation
- **Responsive UI**: Mobile-optimized interface elements
- **Performance**: Optimized rendering for mobile devices
- **Gesture Support**: Touch-based block interaction

## 🛠️ Development & Extensibility

### **Adding New Biomes**
1. Define terrain parameters in `WorldConfig.ts`
2. Add biome-specific noise configurations
3. Create visual assets and foliage types
4. Update terrain generation logic

### **Adding New Block Types**
1. Add block definition to `BlockTypes.ts`
2. Place texture files in `public/` directory
3. Configure special properties in `TextureManager.ts`
4. Test block placement and rendering

### **Creating Smart Blocks**
1. Define block actions in `SmartBlocks.ts`
2. Implement action handlers in `SmartSpecialBlock.ts`
3. Add UI for block creation in modals
4. Test custom logic and persistence

### **Technology Stack**
- **Frontend**: React, Three.js, TypeScript, Vite
- **Backend**: Express.js, Node.js
- **Platform**: Reddit Devvit
- **Real-Time**: Devvit's realtime connections
- **Storage**: Redis for presence, Reddit post data for blocks
- **3D Graphics**: Three.js with custom physics

## 🚀 Use Cases

### **World Creation & Exploration**
- **Collaborative Building**: Create persistent worlds with friends that others can explore
- **Architectural Projects**: Build cities, monuments, and complex structures
- **Art Installations**: Design interactive 3D art galleries and exhibitions
- **Educational Worlds**: Create historical recreations, scientific simulations, or virtual museums

### **Game Development Platform**
Reddiverse's Smart Block system enables creation of complete games:

**Puzzle Games:**
- **Escape Rooms**: Find keys, solve riddles, escape before time runs out
- **Maze Challenges**: Navigate complex labyrinths with traps and rewards
- **Logic Puzzles**: Create block-pushing puzzles, sequence challenges

**Adventure Games:**
- **Treasure Hunts**: Hide items, create clues, build treasure maps
- **Obstacle Courses**: Parkour challenges with jump pads, speed boosts
- **Survival Challenges**: Avoid lava blocks, find safe zones, collect resources

**Competitive Games:**
- **Racing Tracks**: Build race courses with checkpoints and power-ups
- **Capture the Flag**: Create team-based objectives with custom rules
- **King of the Hill**: Design control point battles with respawn mechanics

**Educational Games:**
- **Quiz Mazes**: Answer questions to unlock doors and progress
- **Historical Reenactments**: Recreate historical events with interactive elements
- **Science Simulations**: Model physics concepts with programmable blocks

### **Social & Community**
- **Virtual Events**: Host concerts, conferences, or meetups in custom venues
- **Community Projects**: Collaborative art installations and world-building
- **Role-Playing**: Create immersive environments for storytelling
- **Team Building**: Design cooperative challenges for groups

## 🔮 Future Enhancements

### **Performance Improvements**
- **Better Latency**: Optimized real-time synchronization
- **Streaming Support**: If Devvit supports streaming in the future
- **Advanced Caching**: Improved chunk and texture management

### **Content Expansion**
- **More Biomes**: Additional terrain types and environments
- **Snooavatars**: 3D player models based on Reddit avatars
- **Weapons System**: Combat mechanics and tools
- **NPCs/Crawlers**: AI-controlled entities

### **Social Features**
- **Chat System**: In-game communication
- **Spawn Points**: Configurable player starting locations
- **World Sharing**: Cross-post world sharing
- **Achievement System**: Player progression and rewards

### **Advanced Mechanics**
- **Inventory System**: Item collection and management
- **Crafting**: Block combination and creation
- **Advanced Physics**: More realistic environmental interactions
- **Weather System**: Dynamic weather effects

## 🎯 Getting Started

### **For Players**
1. Join a Reddit post with Reddiverse enabled
2. Click to start the game and enter the 3D world
3. Use WASD to move, mouse to look around, Space to jump
4. Click blocks to place/remove them (if you have permission)
5. Explore different biomes and interact with special blocks

### **For Developers**
1. Clone the repository
2. Install dependencies: `npm install`
3. Login to Devvit: `npm run login`
4. Start development: `npm run dev`
5. Deploy to Reddit: `npm run deploy`

Reddiverse represents a new frontier in browser-based multiplayer gaming, combining the accessibility of web technology with the depth of a full game engine. Its modular architecture and programmable block system make it a powerful platform for creativity, education, and social interaction within the Reddit ecosystem.