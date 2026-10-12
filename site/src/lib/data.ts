// Helpers over the exported public data (src/data/public.json, written by `folio export`).
import data from "../data/public.json";

export { data };

export type Link = { label: string; url: string };
export type Period = { title?: string; unit?: string; start?: string; end?: string; notes?: string[] };
export type Entry = { id?: string; title?: string; location?: string; periods: Period[]; links?: Link[]; related?: string[] };
export type Work = {
  id?: string; title: string; authors: string[]; year: number; venue?: string;
  status: "in-progress" | "submitted" | "published"; doi?: string; url?: string; links?: Link[]; related?: string[];
};

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The content's only markup: **bold** and *italic*. */
export const markup = (s: string) =>
  escape(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const date = (d: string) => (d.length > 4 ? `${MONTHS[+d.slice(5) - 1]} ${d.slice(0, 4)}` : d);

export const dates = (p: Period) =>
  !p.start ? "" : !p.end ? date(p.start) : `${date(p.start)} – ${p.end === "present" ? "now" : date(p.end)}`;

export const isMe = (author: string) => data.profile.author_names.includes(author);

/** Long author lists are shortened, but always keep my own name visible. */
export function authors(list: string[]): string {
  const name = (a: string) => (isMe(a) ? `<strong>${escape(a)}</strong>` : escape(a));
  if (list.length <= 6) return list.map(name).join(", ");
  const me = list.findIndex(isMe);
  const shown = list.slice(0, 3).map(name);
  if (me >= 3) shown.push(`… ${name(list[me])}`);
  return `${shown.join(", ")} et al. (${list.length} authors)`;
}

export const workUrl = (w: Work) => (w.doi ? `https://doi.org/${w.doi}` : w.url);

const WORK_SECTIONS = {
  publications: "Publication", preprints: "Preprint", software: "Software", datasets: "Dataset",
  posters: "Poster", presentations: "Presentation", reports: "Report", websites: "Website", theses: "Thesis",
} as const;

export const outputSections = Object.entries(WORK_SECTIONS)
  .filter(([key]) => key !== "publications" && key !== "preprints")
  .map(([key, label]) => ({ key, label, items: (data as any)[key] as Work[] }))
  .filter((s) => s.items.length);

/** Title of every linkable item, for labelling cross-links. */
export const titles: Record<string, string> = {};
for (const [key, value] of Object.entries(data)) {
  if (!Array.isArray(value)) continue;
  for (const item of value as (Entry | Work)[]) {
    if (item.id) titles[item.id] = item.title ?? (item as Entry).periods.map((p) => p.title).join(", ");
  }
}

export const firstSentence = (s: string) => s.split(/(?<=\.)\s/)[0].trim();
export const restOfText = (s: string) => s.slice(firstSentence(s).length).trim();

const today = new Date().toISOString().slice(0, 7);
export const isUpcoming = (e: Entry) => (e.periods[0].start ?? "") > today;
