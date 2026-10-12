// Seeded randomness for build-time drawings, so they look the same on every build.

export type Point = [number, number];

export function random(seed: number) {
  let state = seed;
  return () => {  // mulberry32
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const points = (path: Point[]) => path.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
