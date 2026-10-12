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
