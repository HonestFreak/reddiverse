# Block Type System

This modular block type system allows you to define blocks with either color-based or image-based textures, with separate textures for different faces (top, side, bottom).

## Block Type Definition

Each block type is defined in `/src/shared/types/BlockTypes.ts`:

```typescript
export interface BlockType {
  id: string;           // Unique identifier
  name: string;         // Display name
  textures: BlockTextures;
  fallbackColor?: string; // Fallback if textures fail to load
}

export interface BlockTextures {
  top?: BlockTexture;    // Top face texture
  side?: BlockTexture;   // Side face texture  
  bottom?: BlockTexture; // Bottom face texture
}

export interface BlockTexture {
  type: 'color' | 'image';
  value: string; // Color hex string or image path
}
```

## Adding New Block Types

### 1. Define the Block Type

Add your block type to `defaultBlockTypes` in `/src/shared/types/BlockTypes.ts`:

```typescript
export const defaultBlockTypes: BlockTypeRegistry = {
  // ... existing block types
  dirt: {
    id: 'dirt',
    name: 'Dirt',
    textures: {
      top: { type: 'image', value: '/dirt_top.png' },
      side: { type: 'image', value: '/dirt_side.png' },
      bottom: { type: 'image', value: '/dirt_bottom.png' }
    },
    fallbackColor: '#8B4513'
  },
  cobblestone: {
    id: 'cobblestone',
    name: 'Cobblestone',
    textures: {
      top: { type: 'color', value: '#808080' },
      side: { type: 'color', value: '#808080' },
      bottom: { type: 'color', value: '#808080' }
    },
    fallbackColor: '#808080'
  }
};
```

### 2. Add Texture Images (if using images)

Place texture images in `/src/client/public/` directory. The system will automatically load them.

### 3. Use the Block Type

The block type can now be used in the game:

```typescript
// Place a dirt block
await placeBlock(x, y, z, 'dirt');

// Place a cobblestone block  
await placeBlock(x, y, z, 'cobblestone');
```

## Texture Guidelines

### Image Textures
- Place images in `/src/client/public/`
- Use PNG format for transparency support
- Recommended size: 16x16, 32x32, or 64x64 pixels
- Use power-of-2 dimensions for best performance

### Color Textures
- Use hex color codes (e.g., '#FF0000' for red)
- Colors are applied uniformly to the face

## Face Mapping

The system maps textures to faces as follows:
- **Top**: Y+ face (top of block)
- **Side**: X+, X-, Z+, Z- faces (all vertical sides)
- **Bottom**: Y- face (bottom of block)

If a specific face texture is not defined, it falls back to the side texture, then top texture, then fallback color.

## Performance Notes

- Textures are cached after first load
- Materials are reused for identical block types
- Use `blockFactory.preloadBlockType()` to preload textures
- Use `blockFactory.preloadAllBlockTypes()` to preload all block types
