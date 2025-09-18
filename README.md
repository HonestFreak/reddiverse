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
- Synchronized across all players using real-world time
- Each 15-minute period represents a full day/night cycle
- Time calculation: `(currentMinute % 15) / 15`
- All players experience the same time of day simultaneously

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
- **Perlin Noise**: Multi-octave fractal noise for natural terrain
- **Multi-Noise Fields**: Separate noise layers for continentalness, erosion, peaks, temperature, and humidity
- **Erosion Simulation**: Realistic terrain shaping with erosion curves
- **Cave Generation**: 3D noise-based cave systems
- **Biome Selection**: Climate-based biome determination using temperature and humidity

### **Chunk System**
- **Dynamic Loading**: Chunks load/unload based on player proximity
- **Instanced Rendering**: Efficient rendering of repeated block types
- **Memory Management**: Automatic cleanup of distant chunks
- **Preloading**: Spawn area chunks preloaded for instant interaction

### **Multiplayer Architecture**
- **Real-Time Synchronization**: WebSocket-like connections via Devvit's realtime system
- **Position Updates**: Throttled position broadcasting (2-0.5 Hz based on connection quality)
- **Player Presence**: Redis-based presence tracking
- **Smooth Interpolation**: Client-side prediction and smoothing for other players
- **Error Handling**: Automatic reconnection and fallback mechanisms

### **Performance Optimizations**
- **Instanced Meshes**: Single mesh instances for repeated block types
- **Frustum Culling**: Only render visible chunks
- **LOD System**: Distance-based level of detail
- **Texture Atlasing**: Efficient texture memory usage
- **Chunk Streaming**: Background loading of nearby chunks
- **Mobile Optimization**: Reduced geometry and effects for mobile devices

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
- **Persistence**: All changes saved to Reddit post data
- **Real-Time Sync**: Changes broadcast to all players instantly

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

### **Creative Building**
- Collaborative world construction
- Architectural projects and city building
- Art installations and creative expressions
- Educational environments and simulations

### **Game Development**
- Custom game mechanics using Smart Blocks
- Puzzle creation and challenge design
- Interactive storytelling environments
- Multiplayer game experiences

### **Social Interaction**
- Virtual meeting spaces
- Community building projects
- Collaborative art creation
- Educational group activities

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