// Shared bits of the canvas games: a crisp canvas in logical units, theme colours, a game loop,
// a message banner, best scores, and the prize (one of the website's items) for game over.

export type Item = { kind: string; title: string; href: string };

export const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const reward = (pool: Item[]) => {
  const item = pool[Math.floor(Math.random() * pool.length)];
  return `<span class="xref-kind">${escape(item.kind)}</span> <a href="${item.href}">${escape(item.title)}</a>`;
};

/** Show a card over the middle of the game (rules, results); hide it when play starts. */
export function show(game: Game, html: string, mode = "card") {
  game.overlay.innerHTML = `<div class="card">${html}</div>`;
  game.overlay.dataset.mode = mode;
  game.overlay.hidden = false;
}
export function hide(game: Game) {
  game.overlay.hidden = true;
  game.overlay.dataset.mode = "";
}
const rulesCard = (game: Game, hint = "tap the game or press a key to start") =>
  `<strong>${escape(game.rules[0])}</strong>${game.rules.slice(1).map((line) => `<span>${escape(line)}</span>`).join("")}<span class="hint">${hint}</span>`;

/** Play starts: the card goes away and the line under the game gives a hint. */
export function begin(game: Game, hint: string) {
  hide(game);
  game.readout.innerHTML = `<span class="hint">${escape(hint)}</span>`;
}

/** Game over: what happened and a prize from the website, in the middle of the game. */
export function gameOver(game: Game, message: string) {
  show(game, `<strong>${message}</strong><span class="prize">Your prize: ${reward(game.pool)}</span><span class="hint">tap the game or press a key to play again</span>`, "over");
  game.readout.innerHTML = "";
}

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
  const game = {
    element, context, W, H,
    readout: figure.querySelector<HTMLElement>(".readout")!,
    overlay: figure.querySelector<HTMLElement>(".overlay")!,
    rules: JSON.parse(figure.dataset.rules!) as string[],
    pool: JSON.parse(figure.querySelector("script[type='application/json']")!.textContent!) as Item[],
    mono: style.getPropertyValue("--mono").trim() || "monospace",
    colours: () => ({ ink: style.getPropertyValue("--ink").trim(), bg: style.getPropertyValue("--bg").trim(), muted: style.getPropertyValue("--muted").trim() }),
    visible: false, resume: null as (() => void) | null,
  };
  new IntersectionObserver((entries) => {
    game.visible = entries[entries.length - 1].isIntersecting;  // the latest record counts
    if (game.visible && game.resume) { const resume = game.resume; game.resume = null; resume(); }
  }).observe(element);
  // The rules show first, and the rules pill brings them back (and away again) at any time.
  show(game, rulesCard(game), "rules");
  let previous: [string, string] | null = null;
  figure.querySelector<HTMLButtonElement>(".rules")!.addEventListener("click", () => {
    if (game.overlay.dataset.mode === "rules" && previous) {
      [game.overlay.innerHTML, game.overlay.dataset.mode] = previous;
      game.overlay.hidden = !previous[1];
      previous = null;
    } else {
      previous = [game.overlay.innerHTML, game.overlay.hidden ? "" : game.overlay.dataset.mode ?? ""];
      show(game, rulesCard(game, "tap the game or press a key to play"), "rules");
    }
    element.focus();
  });
  return game;
}

/** Run step(dt) every frame for as long as it returns true; paused while the game is not on screen
 * (another option chosen, or scrolled away), resumed when it is back. */
export function loop(game: Game, step: (dt: number) => boolean) {
  let last = 0;
  const frame = (time: number) => {
    if (!game.visible) { last = 0; game.resume = () => requestAnimationFrame(frame); return; }
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

/** Where a pointer event is, in logical units. */
export function pointer(game: Game, event: PointerEvent): [number, number] {
  const rect = game.element.getBoundingClientRect();
  return [((event.clientX - rect.left) / rect.width) * game.W, ((event.clientY - rect.top) / rect.height) * game.H];
}

export type Button = { label: string; x: number; y: number; w: number; h: number };

/** A centred row of pill buttons (filled when on); returns where they are, for clicks. */
export function pills(game: Game, labels: string[], y: number, on: (i: number) => boolean = () => false): Button[] {
  const { context: c, W, mono } = game, { ink, bg } = game.colours();
  c.font = `600 13px ${mono}`;
  const widths = labels.map((l) => c.measureText(l).width + 28), gap = 10, h = 30;
  let x = W / 2 - (widths.reduce((s, w) => s + w, 0) + gap * (labels.length - 1)) / 2;
  return labels.map((label, i) => {
    const b = { label, x, y, w: widths[i], h };
    c.fillStyle = on(i) ? ink : bg; c.strokeStyle = ink; c.lineWidth = 1.2;
    c.beginPath(); c.roundRect(b.x, b.y, b.w, h, h / 2); c.fill(); c.stroke();
    c.fillStyle = on(i) ? bg : ink; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(label, b.x + b.w / 2, y + h / 2 + 1);
    c.textBaseline = "alphabetic";
    x += widths[i] + gap;
    return b;
  });
}

export const inside = (b: Button, [x, y]: [number, number]) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
