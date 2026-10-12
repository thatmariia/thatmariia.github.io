// Shared helpers for the build-time figures of the fields.
import type { Point } from "./random";

/** Points on a jittered ellipse in shuffled order; nothing sits in the centre, so no field stands out. */
export function ellipse(n: number, width: number, height: number, padX: number, padY: number, uniform: () => number) {
  const slots = [...Array(n).keys()].sort(() => uniform() - 0.5);
  const result: { at: Point; slot: number }[] = [];
  slots.forEach((item, slot) => {
    const a = -Math.PI / 2 + (2 * Math.PI * slot) / n + (uniform() - 0.5) * 0.35;
    const rx = (width / 2 - padX) * (0.82 + uniform() * 0.18), ry = (height / 2 - padY) * (0.82 + uniform() * 0.18);
    result[item] = { at: [width / 2 + rx * Math.cos(a), height / 2 + ry * Math.sin(a)], slot };
  });
  return result;
}

/** Nudge apart points whose label pills would overlap (pill size estimated in figure units). */
export function separate(at: Point[], labels: string[], width: number, height: number, padY: number) {
  const size = labels.map((label) => [label.length * 7.6 + 30, 30]);
  for (let round = 0; round < 60; round++) {
    for (let i = 0; i < at.length; i++) {
      for (let j = i + 1; j < at.length; j++) {
        const a = at[i], b = at[j];
        const ox = (size[i][0] + size[j][0]) / 2 + 8 - Math.abs(a[0] - b[0]);
        const oy = (size[i][1] + size[j][1]) / 2 + 8 - Math.abs(a[1] - b[1]);
        if (ox <= 0 || oy <= 0) continue;
        const axis = oy < ox ? 1 : 0, push = (Math.min(ox, oy) / 2) * Math.sign(a[axis] - b[axis] || 1);
        a[axis] += push;
        b[axis] -= push;
      }
    }
    at.forEach((p, i) => {
      p[0] = Math.min(width - size[i][0] / 2, Math.max(size[i][0] / 2, p[0]));
      p[1] = Math.min(height - padY, Math.max(padY, p[1]));
    });
  }
}

/** Position of an HTML pill over the SVG, in percentages so it follows the figure's scaling. */
export const place = ([x, y]: Point, width: number, height: number) =>
  `left: ${((x / width) * 100).toFixed(2)}%; top: ${((y / height) * 100).toFixed(2)}%`;

/** CSS that, while a pill is hovered, fades every line that does not touch it. */
export const hoverCss = (id: string, n: number) =>
  [...Array(n).keys()]
    .map((i) => `.${id}:has([data-node="${i}"]:hover) .line:not([data-touches~="${i}"]) { opacity: 0.06; }
.${id}:has([data-node="${i}"]:hover) .line[data-touches~="${i}"] { opacity: 1; stroke-width: 1.3; }`)
    .join("\n");

/** Force-directed layout (Fruchterman–Reingold) of n nodes and weighted edges, fitted to the figure. */
export function forceLayout(n: number, edges: { pair: number[]; w: number }[], width: number, height: number, pad: number, uniform: () => number): Point[] {
  const k = Math.sqrt((width * height) / n) * 0.75;
  const pos: Point[] = Array.from({ length: n }, () => [uniform() * width, uniform() * height]);
  for (let iteration = 0; iteration < 400; iteration++) {
    const shift = pos.map(() => [0, 0]);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const [dx, dy] = [pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]], d = Math.max(1, Math.hypot(dx, dy));
        shift[i][0] += (dx / d) * (k * k) / d;
        shift[i][1] += (dy / d) * (k * k) / d;
      }
    }
    for (const { pair: [i, j], w } of edges) {
      const [dx, dy] = [pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]], d = Math.max(1, Math.hypot(dx, dy));
      const pull = ((d * d) / k) * (0.4 + 0.15 * w);
      shift[i][0] -= (dx / d) * pull; shift[i][1] -= (dy / d) * pull;
      shift[j][0] += (dx / d) * pull; shift[j][1] += (dy / d) * pull;
    }
    // Gentle gravity towards the centre, so separate groups stay close instead of drifting apart.
    pos.forEach(([x, y], i) => {
      const [dx, dy] = [x - width / 2, y - height / 2], d = Math.max(1, Math.hypot(dx, dy));
      shift[i][0] -= (dx / d) * ((d * d) / k) * 0.06;
      shift[i][1] -= (dy / d) * ((d * d) / k) * 0.06;
    });
    const temperature = (Math.min(width, height) / 8) * (1 - iteration / 400) + 1;
    pos.forEach((p, i) => {
      const d = Math.max(1, Math.hypot(shift[i][0], shift[i][1]));
      p[0] += (shift[i][0] / d) * Math.min(d, temperature);
      p[1] += (shift[i][1] / d) * Math.min(d, temperature);
    });
  }
  const [xs, ys] = [pos.map((p) => p[0]), pos.map((p) => p[1])];
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return pos.map(([x, y]) => [pad + ((x - x0) / (x1 - x0 || 1)) * (width - 2 * pad), pad + ((y - y0) / (y1 - y0 || 1)) * (height - 2 * pad)]);
}

/** A gently curved cubic Bézier path from a to b. */
export function curve(a: Point, b: Point, bend: number) {
  const f = (v: number) => v.toFixed(1);
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  return `M${f(a[0])},${f(a[1])} C${f(a[0] + dx / 3 - dy * bend)},${f(a[1] + dy / 3 + dx * bend)} ${f(a[0] + (2 * dx) / 3 + dy * bend)},${f(a[1] + (2 * dy) / 3 - dx * bend)} ${f(b[0])},${f(b[1])}`;
}

/** A smooth path through points (Catmull-Rom as cubic Béziers); closed paths loop back. */
export function smooth(p: Point[], closed = false) {
  const at = (i: number) => p[closed ? (i + p.length) % p.length : Math.max(0, Math.min(p.length - 1, i))];
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 0; i < (closed ? p.length : p.length - 1); i++) {
    const [a, b, c, e] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += ` C${f(b[0] + (c[0] - a[0]) / 6)},${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)},${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])},${f(c[1])}`;
  }
  return closed ? `${d}Z` : d;
}
