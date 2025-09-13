export type BlueprintBlock = { dx: number; dy: number; dz: number; type: string };

export const cactus_small: BlueprintBlock[] = (() => {
  const parts: BlueprintBlock[] = [];
  // 3-block tall column
  for (let y = 0; y < 3; y++) parts.push({ dx: 0, dy: y, dz: 0, type: 'leaf' });
  parts.push({ dx: 1, dy: 1, dz: 0, type: 'leaf' });
  parts.push({ dx: 2, dy: 1, dz: 0, type: 'leaf' });
  parts.push({ dx: 2, dy: 2, dz: 0, type: 'leaf' });
  return parts;
})();

export const cactus_tall: BlueprintBlock[] = (() => {
  const parts: BlueprintBlock[] = [];
  // 5-block tall column with 3 arms
  for (let y = 0; y < 5; y++) parts.push({ dx: 0, dy: y, dz: 0, type: 'leaf' });
  // Arm 1
  parts.push({ dx: 1, dy: 1, dz: 0, type: 'leaf' });
  parts.push({ dx: 2, dy: 1, dz: 0, type: 'leaf' });
  parts.push({ dx: 2, dy: 2, dz: 0, type: 'leaf' });
  // Arm 2
  parts.push({ dx: -1, dy: 2, dz: 0, type: 'leaf' });
  parts.push({ dx: -2, dy: 2, dz: 0, type: 'leaf' });
  parts.push({ dx: -2, dy: 3, dz: 0, type: 'leaf' });
  // Arm 3
  parts.push({ dx: 0, dy: 3, dz: 1, type: 'leaf' });
  parts.push({ dx: 0, dy: 4, dz: 2, type: 'leaf' });
  parts.push({ dx: 0, dy: 3, dz: 2, type: 'leaf' });
  return parts;
})();

export const cactus_collidable = true;


