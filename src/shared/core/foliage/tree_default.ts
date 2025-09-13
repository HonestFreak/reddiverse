export type BlueprintBlock = { dx: number; dy: number; dz: number; type: string };

// Simple oak-like tree: trunk height 4, leaf canopy 3x3 with a top cap
export const tree_default: BlueprintBlock[] = (() => {
  const parts: BlueprintBlock[] = [];
  // Trunk (wood)
  const trunkHeight = 4;
  for (let y = 0; y < trunkHeight; y++) {
    parts.push({ dx: 0, dy: y, dz: 0, type: 'wood' });
  }

  // Leaf canopy around the top
  const topY = trunkHeight;
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      parts.push({ dx: x, dy: topY, dz: z, type: 'leaf' });
      if (x !== 0 || z !== 0) {
        parts.push({ dx: x, dy: topY - 1, dz: z, type: 'leaf' });
      }
    }
  }
  // Thicken canopy with a cross at radius 2
  for (const pair of [[2,0],[-2,0],[0,2],[0,-2]] as Array<[number, number]>) {
    const [x, z] = pair;
    parts.push({ dx: x, dy: topY, dz: z, type: 'leaf' });
  }
  // Add side leaves lower on the trunk for a fuller look
  for (const ly of [1, 2]) {
    for (const pair of [[1,0],[-1,0],[0,1],[0,-1]] as Array<[number, number]>) {
      const [x, z] = pair;
      parts.push({ dx: x, dy: ly, dz: z, type: 'leaf' });
    }
  }
  // Cap
  parts.push({ dx: 0, dy: topY + 1, dz: 0, type: 'leaf' });
  // Fill a 3x3 just under the cap for a rounded top
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      parts.push({ dx: x, dy: topY + 1, dz: z, type: 'leaf' });
    }
  }

  return parts;
})();

export const tree_default_collidable = true;

// Smaller, bushier tree: short trunk with heavy leaf coverage
export const tree_small: BlueprintBlock[] = (() => {
  const parts: BlueprintBlock[] = [];
  const trunkHeight = 3;
  for (let y = 0; y < trunkHeight; y++) parts.push({ dx: 0, dy: y, dz: 0, type: 'wood' });

  const topY = trunkHeight;
  // Dense 3x3 at top and one layer below
  for (let layer = 0; layer <= 1; layer++) {
    const ly = topY + layer;
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        parts.push({ dx: x, dy: ly, dz: z, type: 'leaf' });
      }
    }
  }
  // Extra leaves around trunk sides to make it bushy
  for (const pair of [[1,0],[-1,0],[0,1],[0,-1]] as Array<[number, number]>) {
    const [x, z] = pair;
    parts.push({ dx: x, dy: topY - 1, dz: z, type: 'leaf' });
  }
  // Cap the top
  parts.push({ dx: 0, dy: topY + 2, dz: 0, type: 'leaf' });
  return parts;
})();

// Big tree with branches and leaf coverage (trunk height 5)
export const tree_big: BlueprintBlock[] = (() => {
  const parts: BlueprintBlock[] = [];
  const trunkHeight = 5;
  for (let y = 0; y < trunkHeight; y++) parts.push({ dx: 0, dy: y, dz: 0, type: 'wood' });

  // Branches (wood) similar to cactus arms concept
  // Arm 1 (+X)
  parts.push({ dx: 1, dy: 1, dz: 0, type: 'wood' });
  parts.push({ dx: 2, dy: 1, dz: 0, type: 'wood' });
  parts.push({ dx: 2, dy: 2, dz: 0, type: 'wood' });
  // Arm 2 (-X)
  parts.push({ dx: -1, dy: 2, dz: 0, type: 'wood' });
  parts.push({ dx: -2, dy: 2, dz: 0, type: 'wood' });
  parts.push({ dx: -2, dy: 3, dz: 0, type: 'wood' });
  // Arm 3 (+Z)
  parts.push({ dx: 0, dy: 3, dz: 1, type: 'wood' });
  parts.push({ dx: 0, dy: 3, dz: 2, type: 'wood' });
  parts.push({ dx: 0, dy: 4, dz: 2, type: 'wood' });

  // Leaves: canopy at top and around branch tips and along branches
  const topY = trunkHeight;
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      if (Math.abs(x) + Math.abs(z) <= 3) parts.push({ dx: x, dy: topY, dz: z, type: 'leaf' });
    }
  }
  // Around trunk tip
  parts.push({ dx: 0, dy: topY + 1, dz: 0, type: 'leaf' });
  for (const pair of [[1,0],[-1,0],[0,1],[0,-1]] as Array<[number, number]>) {
    const [x, z] = pair;
    parts.push({ dx: x, dy: topY + 1, dz: z, type: 'leaf' });
  }

  // Leaf bulbs at branch ends
  const branchTips: Array<[number, number, number]> = [
    [2, 2, 0],
    [-2, 3, 0],
    [0, 4, 2],
  ];
  for (const [bx, by, bz] of branchTips) {
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        parts.push({ dx: bx + x, dy: by, dz: bz + z, type: 'leaf' });
      }
    }
    parts.push({ dx: bx, dy: by + 1, dz: bz, type: 'leaf' });
  }

  // Light leaf wrapping along branch segments
  for (const triple of [
    [1, 1, 0], [2, 1, 0], [2, 2, 0],
    [-1, 2, 0], [-2, 2, 0], [-2, 3, 0],
    [0, 3, 1], [0, 3, 2], [0, 4, 2],
  ] as Array<[number, number, number]>) {
    const [dx, dy, dz] = triple;
    for (const pair of [[1,0],[-1,0],[0,1],[0,-1]] as Array<[number, number]>) {
      const [ox, oz] = pair;
      parts.push({ dx: dx + ox, dy: dy, dz: dz + oz, type: 'leaf' });
    }
  }

  return parts;
})();


