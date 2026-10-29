// The public data reshaped for the data-driven figures: works, roles and events with their dates.
import { data, isMe, type Entry, type Period, type Work } from "./data";

/** Months since year 0, so dates can be compared and subtracted. */
export const month = (date: string) => {
  const [year, m] = date.split("-").map(Number);
  return year * 12 + ((m || 1) - 1);
};
const today = new Date();
export const now = today.getFullYear() * 12 + today.getMonth();
const span = (p: Period): [number, number] =>
  [month(p.start!), p.end === "present" ? now : p.end ? month(p.end) : month(p.start!)];

const WORK_SECTIONS = ["papers", "preprints", "software", "datasets", "posters", "presentations", "reports", "publications", "theses"];
export const works = WORK_SECTIONS.flatMap((kind) => ((data as any)[kind] as Work[]).map((w) => ({ ...w, kind })));
export const myWorks = works.filter((w) => w.authors.some(isMe));

const ROLE_SECTIONS = ["research", "teaching", "leadership", "service", "other"];
export const roles = ROLE_SECTIONS.flatMap((section) =>
  ((data as any)[section] as Entry[]).flatMap((e) => e.periods.map((p) => ({ section, location: e.location, span: span(p) }))));

export const events = (["events", "outreach"] as const).flatMap((section) =>
  (data[section] as Entry[]).map((e) => ({ section, location: e.location, start: month(e.periods[0].start!) })));

export const firstYear = Math.floor(Math.min(...roles.map((r) => r.span[0]), ...events.map((e) => e.start)) / 12);
export const lastYear = Math.floor(now / 12);

/** One per role entry (an organisation and what I did there), with its related ids. */
export const roleEntries = ROLE_SECTIONS.flatMap((section) => ((data as any)[section] as Entry[]).map((e) => {
  const spans = e.periods.map(span), from = Math.min(...spans.map((s) => s[0]));
  return {
    id: e.id, org: e.title!, role: e.periods[0].title ?? e.title!, section, location: e.location, related: e.related ?? [],
    from, to: Math.max(from + 1, ...spans.map((s) => s[1])),
  };
}));

/** A short name for an organisation: its acronym in brackets if it has one, else the name cut to fit. */
export const shortName = (name: string, fits = 22) => {
  const acronym = name.match(/\(([^)]+)\)/)?.[1];
  if (acronym) return acronym;
  const first = name.split(",")[0];
  return first.length > fits ? `${first.slice(0, fits - 1).trim()}…` : first;
};

/** When each output or event with an id happened (works: mid-year), and its section. */
export const dated: Record<string, { t: number; section: string }> = {};
for (const w of works) if (w.id) dated[w.id] = { t: w.year * 12 + 5, section: w.kind };
for (const section of ["events", "outreach"] as const)
  for (const e of data[section] as Entry[]) if (e.id) dated[e.id] = { t: month(e.periods[0].start!), section };
