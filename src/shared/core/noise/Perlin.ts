// Lightweight seeded Perlin noise (2D) implementation suitable for both client and server

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    // Use Mulberry32 PRNG for repeatability
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export class Perlin2D {
  private perm: Uint8Array;

  constructor(seed: number) {
    this.perm = Perlin2D.buildPermutation(seed);
  }

  static buildPermutation(seed: number): Uint8Array {
    const rand = new SeededRandom(seed);
    const p: number[] = new Array(256).fill(0).map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand.next() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    // Duplicate for wraparound
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;
    return perm;
  }

  private static fade(t: number): number {
    // 6t^5 - 15t^4 + 10t^3
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private static lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private static grad(hash: number, x: number, y: number): number {
    // Use only 4 gradient directions for speed; acceptable for terrain
    switch (hash & 3) {
      case 0:
        return x + y;
      case 1:
        return -x + y;
      case 2:
        return x - y;
      default:
        return -x - y;
    }
  }

  noise2D(x: number, y: number): number {
    // Find unit grid cell containing point
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    // Relative x, y within cell
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // Fade curves for x, y
    const u = Perlin2D.fade(xf);
    const v = Perlin2D.fade(yf);

    const aa = this.perm[X + this.perm[Y]];
    const ab = this.perm[X + this.perm[Y + 1]];
    const ba = this.perm[X + 1 + this.perm[Y]];
    const bb = this.perm[X + 1 + this.perm[Y + 1]];

    const x1 = Perlin2D.lerp(
      Perlin2D.grad(aa, xf, yf),
      Perlin2D.grad(ba, xf - 1, yf),
      u
    );
    const x2 = Perlin2D.lerp(
      Perlin2D.grad(ab, xf, yf - 1),
      Perlin2D.grad(bb, xf - 1, yf - 1),
      u
    );

    // Result in [-1,1]
    return Perlin2D.lerp(x1, x2, v);
  }
}


// Seeded Perlin noise (3D)
export class Perlin3D {
  private perm: Uint8Array;

  constructor(seed: number) {
    this.perm = Perlin3D.buildPermutation(seed);
  }

  static buildPermutation(seed: number): Uint8Array {
    const rand = new SeededRandom(seed);
    const p: number[] = new Array(256).fill(0).map((_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand.next() * (i + 1));
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;
    return perm;
  }

  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private static lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private static grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise3D(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255; const Y = Math.floor(y) & 255; const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x); const yf = y - Math.floor(y); const zf = z - Math.floor(z);
    const u = Perlin3D.fade(xf); const v = Perlin3D.fade(yf); const w = Perlin3D.fade(zf);
    const A = this.perm[X] + Y; const AA = this.perm[A] + Z; const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y; const BA = this.perm[B] + Z; const BB = this.perm[B + 1] + Z;

    const x1 = Perlin3D.lerp(
      Perlin3D.grad(this.perm[AA], xf, yf, zf),
      Perlin3D.grad(this.perm[BA], xf - 1, yf, zf),
      u
    );
    const x2 = Perlin3D.lerp(
      Perlin3D.grad(this.perm[AB], xf, yf - 1, zf),
      Perlin3D.grad(this.perm[BB], xf - 1, yf - 1, zf),
      u
    );
    const y1 = Perlin3D.lerp(x1, x2, v);

    const x3 = Perlin3D.lerp(
      Perlin3D.grad(this.perm[AA + 1], xf, yf, zf - 1),
      Perlin3D.grad(this.perm[BA + 1], xf - 1, yf, zf - 1),
      u
    );
    const x4 = Perlin3D.lerp(
      Perlin3D.grad(this.perm[AB + 1], xf, yf - 1, zf - 1),
      Perlin3D.grad(this.perm[BB + 1], xf - 1, yf - 1, zf - 1),
      u
    );
    const y2 = Perlin3D.lerp(x3, x4, v);
    return Perlin3D.lerp(y1, y2, w); // [-1, 1]
  }
}


