// Shared bits of the canvas games: a crisp canvas in logical units, theme colours, a game loop,
// a message banner, best scores, and the prize (one of the website's items) for game over.

export type Item = { kind: string; title: string; href: string };

export const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const reward = (pool: Item[]) => {
  const item = pool[Math.floor(Math.random() * pool.length)];
  return `<span class="xref-kind">${escape(item.kind)}</span> <a href="${item.href}">${escape(item.title)}</a>`;
};

/** The game-over line: what happened, then a prize from the website. */
export const gameOver = (readout: HTMLElement, pool: Item[], message: string) => {
  readout.innerHTML = `${message}<span class="prize">Your prize: ${reward(pool)}</span>`;
};

export type Game = ReturnType<typeof setup>;

/** The canvas of a game figure, scaled to its displayed size; drawing uses W × H logical units. */
export function setup(figure: HTMLElement, redraw: () => void) {
  const element = figure.querySelector("canvas")!, context = element.getContext("2d")!;
  const [W, H] = [Number(figure.dataset.width), Number(figure.dataset.height)];
  const fit = () => {
    const scale = (element.clientWidth * devicePixelRatio) / W;
    element.width = Math.round(W * scale);
    element.height = Math.round(H * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  };
  fit();
  new ResizeObserver(() => { fit(); redraw(); }).observe(element);
  const style = getComputedStyle(element);
  return {
    element, context, W, H,
    readout: figure.querySelector<HTMLElement>(".readout")!,
    pool: JSON.parse(figure.querySelector("script[type='application/json']")!.textContent!) as Item[],
    mono: style.getPropertyValue("--mono").trim() || "monospace",
    colours: () => ({ ink: style.getPropertyValue("--ink").trim(), bg: style.getPropertyValue("--bg").trim(), muted: style.getPropertyValue("--muted").trim() }),
  };
}

/** Run step(dt) every frame for as long as it returns true. */
export function loop(step: (dt: number) => boolean) {
  let last = 0;
  const frame = (time: number) => {
    const dt = Math.min(0.04, (time - (last || time)) / 1000);
    last = time;
    if (step(dt)) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Centred lines of text in a pill-shaped box: the first bold, the rest muted; shrunk to fit. */
export function banner(game: Game, lines: string[], y = game.H * 0.42) {
  const { context: c, W, mono } = game, { ink, bg, muted } = game.colours();
  const font = (i: number, size: number) => (i ? `${size * 11.5}px ${mono}` : `600 ${size * 13}px ${mono}`);
  const widest = Math.max(...lines.map((l, i) => { c.font = font(i, 1); return c.measureText(l).width; }));
  const size = Math.min(1, (W - 48) / widest), width = widest * size + 36, height = (16 + lines.length * 18) * size;
  c.fillStyle = bg; c.strokeStyle = ink; c.lineWidth = 1.2;
  c.beginPath(); c.roundRect(W / 2 - width / 2, y - height / 2, width, height, Math.min(18, height / 2)); c.fill(); c.stroke();
  c.textAlign = "center"; c.textBaseline = "middle";
  lines.forEach((line, i) => {
    c.font = font(i, size);
    c.fillStyle = i ? muted : ink;
    c.fillText(line, W / 2, y - height / 2 + (17 + i * 18) * size);
  });
  c.textBaseline = "alphabetic";
}

/** The best score kept in this browser (if storage is available). */
export function best(key: string, score?: number) {
  try {
    const previous = Number(localStorage.getItem(key)) || 0;
    if (score !== undefined && score > previous) localStorage.setItem(key, String(score));
    return Math.max(previous, score ?? 0);
  } catch {
    return score ?? 0;
  }
}

/** Score corners: best on the left, the game's own line on the right. */
export function corners(game: Game, key: string, right: string) {
  const { context: c, W, mono } = game, { ink, muted } = game.colours();
  c.font = `600 12px ${mono}`;
  c.textAlign = "left"; c.fillStyle = muted; c.fillText(`best ${best(key)}`, 10, 20);
  c.textAlign = "right"; c.fillStyle = ink; c.fillText(right, W - 10, 20);
}
