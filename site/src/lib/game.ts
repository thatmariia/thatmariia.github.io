// Shared bits of the canvas games: a crisp canvas in logical units, theme colours, and the
// "reward" line that links one of the website's items.

export type Item = { kind: string; title: string; href: string };

export const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const reward = (pool: Item[]) => {
  const item = pool[Math.floor(Math.random() * pool.length)];
  return `<span class="xref-kind">${escape(item.kind)}</span> <a href="${item.href}">${escape(item.title)}</a>`;
};

// Scale the canvas to its displayed size; drawing happens in width × height logical units.
export const canvas = (element: HTMLCanvasElement, width: number, height: number, redraw: () => void) => {
  const context = element.getContext("2d")!;
  const fit = () => {
    const scale = (element.clientWidth * devicePixelRatio) / width;
    element.width = Math.round(width * scale);
    element.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  };
  fit();
  new ResizeObserver(() => { fit(); redraw(); }).observe(element);
  const style = getComputedStyle(element);
  const colours = () => ({ ink: style.getPropertyValue("--ink").trim(), bg: style.getPropertyValue("--bg").trim(), muted: style.getPropertyValue("--muted").trim() });
  return { context, colours, mono: style.getPropertyValue("--mono").trim() || "monospace" };
};

export const best = (key: string, score?: number) => {
  try {
    const previous = Number(localStorage.getItem(key)) || 0;
    if (score !== undefined && score > previous) localStorage.setItem(key, String(score));
    return Math.max(previous, score ?? 0);
  } catch {
    return score ?? 0;
  }
};
