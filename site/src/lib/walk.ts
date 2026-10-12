// Seeded randomness for the build-time drawings, so they look the same on every build.

export type Point = [number, number];

export function random(seed: number) {
  let state = seed;
  const uniform = () => {  // mulberry32
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform());
  return { uniform, gauss };
}

/** A random walk from a to b (Brownian bridge): it wanders but ends exactly at b. */
export function bridge(gauss: () => number, a: Point, b: Point, steps: number, sigma: number): Point[] {
  const walk: Point[] = [[0, 0]];
  for (let k = 1; k <= steps; k++) walk.push([walk[k - 1][0] + gauss() * sigma, walk[k - 1][1] + gauss() * sigma]);
  const [ex, ey] = walk[steps];
  return walk.map(([x, y], k) => {
    const t = k / steps;
    return [a[0] + (b[0] - a[0]) * t + x - ex * t, a[1] + (b[1] - a[1]) * t + y - ey * t];
  });
}

export const points = (path: Point[]) => path.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
