# Sky System

This directory contains the sky rendering and day/night cycle system for the voxel game.

## Components

### SkyManager.ts
- **Purpose**: Manages sky rendering, atmospheric effects, and lighting
- **Features**:
  - Beautiful skybox with custom shaders
  - Dynamic sun and moon positioning
  - Star field for night scenes
  - Atmospheric fog
  - Multiple sky presets (day, sunset, night, dawn)
  - Smooth transitions between different times of day

### TimeManager.ts
- **Purpose**: Handles the day/night cycle timing
- **Features**:
  - Configurable time scale (real-time or accelerated)
  - Pause/resume functionality
  - Time of day calculations
  - Human-readable time strings

### CloudManager.ts
- **Purpose**: Manages procedural cloud generation and movement
- **Features**:
  - Multiple cloud types (Cumulus, Stratus, Cirrus, Storm)
  - Procedural cloud geometry generation using cubes
  - Wind effects and cloud movement
  - Time-of-day lighting integration
  - Configurable cloud density and wind speed

## Usage

The sky system is automatically initialized when the game starts and integrates seamlessly with the existing Three.js scene. Players can:

- **Watch the day/night cycle** automatically progress
- **Control time** using the UI buttons (Dawn, Noon, Sunset, Night)
- **Pause/resume time** to explore at their preferred time of day
- **Adjust time speed** between normal and fast modes
- **Control clouds** with density and wind speed sliders
- **Change wind direction** using the directional buttons
- **Experience dynamic weather** as clouds move across the sky

## Technical Details

- **Skybox**: Uses a custom shader for smooth gradients and sun glow effects
- **Clouds**: Procedurally generated using multiple cubes for organic shapes
- **Performance**: Optimized for mobile devices with limited geometry and effects
- **Lighting**: Dynamic lighting that changes based on time of day
- **Atmosphere**: Fog effects and cloud shadows that enhance depth perception
- **Wind System**: Realistic cloud movement with configurable wind speed and direction

## Customization

You can easily customize the sky system by:

1. **Modifying presets** in `SkyManager.ts` to change colors and intensities
2. **Adjusting time scale** in the `TimeManager` constructor
3. **Adding new sky types** by extending the preset system
4. **Customizing cloud types** in `CloudManager.ts` for different weather patterns
5. **Adjusting cloud geometry** for different visual styles
6. **Customizing shaders** for different visual effects

The system is designed to be modular and easily extensible for future enhancements.
