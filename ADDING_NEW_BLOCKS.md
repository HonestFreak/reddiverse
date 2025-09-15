# Adding New Blocks to the Voxel Game

This guide explains how to add new block types to the voxel game. The system is designed to be flexible and supports both image-based textures and solid colors.

## Overview

Blocks in this voxel game are defined in the shared types and can use either:
- **Image textures**: PNG files for detailed block appearances
- **Solid colors**: Hex color codes for simple colored blocks

## Step-by-Step Guide

### 1. Add Your Texture Files

Place your texture files in the `src/client/public/` directory. Supported formats:
- PNG files (recommended for pixel art style)
- JPG files (for photographic textures)

**Example:**
```
src/client/public/
├── my_new_block.png
├── my_block_top.png
├── my_block_side.png
└── my_block_bottom.png
```

### 2. Define the Block Type

Edit `src/shared/types/BlockTypes.ts` and add your new block to the `defaultBlockTypes` object:

```typescript
export const defaultBlockTypes: BlockTypeRegistry = {
  // ... existing blocks ...
  
  my_new_block: {
    id: 'my_new_block',
    name: 'My New Block',
    textures: {
      top: { type: 'image', value: '/my_block_top.png' },
      side: { type: 'image', value: '/my_block_side.png' },
      bottom: { type: 'image', value: '/my_block_bottom.png' }
    },
    fallbackColor: '#8a8a8a' // Fallback color if texture fails to load
  }
};
```

### 3. Block Texture Configuration Options

#### Using Different Textures for Each Face
```typescript
my_block: {
  id: 'my_block',
  name: 'My Block',
  textures: {
    top: { type: 'image', value: '/my_block_top.png' },
    side: { type: 'image', value: '/my_block_side.png' },
    bottom: { type: 'image', value: '/my_block_bottom.png' }
  },
  fallbackColor: '#8a8a8a'
}
```

#### Using the Same Texture for All Faces
```typescript
my_block: {
  id: 'my_block',
  name: 'My Block',
  textures: {
    top: { type: 'image', value: '/my_block.png' },
    side: { type: 'image', value: '/my_block.png' },
    bottom: { type: 'image', value: '/my_block.png' }
  },
  fallbackColor: '#8a8a8a'
}
```

#### Using Solid Colors Instead of Images
```typescript
my_block: {
  id: 'my_block',
  name: 'My Block',
  textures: {
    top: { type: 'color', value: '#ff0000' },
    side: { type: 'color', value: '#00ff00' },
    bottom: { type: 'color', value: '#0000ff' }
  },
  fallbackColor: '#808080'
}
```

### 4. Special Block Properties

Some blocks require special rendering properties. If your block needs special handling, update `src/client/core/textures/TextureManager.ts`:

#### Transparent/Cutout Blocks (like foliage)
```typescript
// In the getBlockMaterial method, add your block type:
if (blockTypeId === 'leaf' || blockTypeId === 'cactus' || blockTypeId === 'my_foliage_block') {
  material.transparent = true;
  material.alphaTest = 0.4;
  material.depthWrite = true;
  (material as THREE.MeshLambertMaterial).side = THREE.FrontSide;
}
```

#### Water-like Blocks (transparent with opacity)
```typescript
if (blockTypeId === 'water' || blockTypeId === 'my_liquid_block') {
  material.transparent = true;
  material.opacity = 0.35;
  material.depthWrite = false;
  (material as THREE.MeshLambertMaterial).side = THREE.FrontSide;
}
```

### 5. Using Blocks in Foliage/Structures

If you want to use your block in generated foliage or structures, update the relevant files in `src/shared/core/foliage/`:

```typescript
// Example in cactus.ts
export const cactus_small: BlueprintBlock[] = (() => {
  const parts: BlueprintBlock[] = [];
  for (let y = 0; y < 3; y++) parts.push({ dx: 0, dy: y, dz: 0, type: 'cactus' });
  // ... more parts
  return parts;
})();
```

### 6. Block Properties Reference

#### BlockType Interface
```typescript
interface BlockType {
  id: string;           // Unique identifier (used in code)
  name: string;         // Display name (shown in UI)
  textures: BlockTextures;  // Texture configuration
  fallbackColor?: string;   // Color if texture loading fails
}

interface BlockTextures {
  top?: BlockTexture;    // Top face texture
  side?: BlockTexture;   // Side faces texture
  bottom?: BlockTexture; // Bottom face texture
}

interface BlockTexture {
  type: 'color' | 'image';  // Texture type
  value: string;            // Color hex or image path
}
```

## Best Practices

### Texture Guidelines
- **Size**: Use power-of-2 dimensions (16x16, 32x32, 64x64, etc.)
- **Style**: Match the pixel art aesthetic of existing blocks
- **Format**: PNG with transparency support for cutout blocks
- **Naming**: Use descriptive names that match the block ID

### Performance Considerations
- Textures are automatically cached by the TextureManager
- Materials are cached per block type and face
- Use the same texture for multiple faces when possible to reduce memory usage

### Testing Your Block
1. Add the block to the block types registry
2. Place texture files in the public directory
3. Test in the game by placing the block
4. Verify all faces render correctly
5. Check special properties (transparency, etc.) work as expected

## Examples

### Example 1: Simple Colored Block
```typescript
brick: {
  id: 'brick',
  name: 'Brick',
  textures: {
    top: { type: 'color', value: '#8b4513' },
    side: { type: 'color', value: '#8b4513' },
    bottom: { type: 'color', value: '#8b4513' }
  },
  fallbackColor: '#8b4513'
}
```

### Example 2: Textured Block with Different Faces
```typescript
dirt: {
  id: 'dirt',
  name: 'Dirt',
  textures: {
    top: { type: 'image', value: '/dirt_top.png' },
    side: { type: 'image', value: '/dirt_side.png' },
    bottom: { type: 'image', value: '/dirt_bottom.png' }
  },
  fallbackColor: '#8b4513'
}
```

### Example 3: Transparent Foliage Block
```typescript
grass: {
  id: 'grass',
  name: 'Grass',
  textures: {
    top: { type: 'image', value: '/grass_top.png' },
    side: { type: 'image', value: '/grass_side.png' },
    bottom: { type: 'color', value: '#4a7c59' }
  },
  fallbackColor: '#4a7c59'
}
```

## Troubleshooting

### Common Issues

1. **Texture not loading**: Check that the file path is correct and the file exists in `src/client/public/`
2. **Block not appearing**: Verify the block ID is correctly added to `defaultBlockTypes`
3. **Transparency issues**: Ensure special block properties are added to TextureManager
4. **Performance issues**: Check that textures are appropriately sized and materials are being cached

### Debug Tips

- Check the browser console for texture loading errors
- Use the fallback color to verify the block type is registered
- Test with simple color blocks first before adding complex textures

## File Structure Reference

```
src/
├── shared/types/BlockTypes.ts          # Block type definitions
├── client/core/textures/TextureManager.ts  # Texture loading and material creation
├── client/public/                      # Texture files location
└── shared/core/foliage/               # Foliage and structure definitions
```

This system provides a flexible foundation for adding new blocks while maintaining good performance and visual consistency.
