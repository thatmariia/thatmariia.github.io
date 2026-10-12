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

const WORK_SECTIONS = ["publications", "preprints", "software", "datasets", "posters", "presentations", "reports", "websites", "theses"];
export const works = WORK_SECTIONS.flatMap((kind) => ((data as any)[kind] as Work[]).map((w) => ({ ...w, kind })));
export const myWorks = works.filter((w) => w.authors.some(isMe));

const ROLE_SECTIONS = ["research", "teaching", "leadership", "service", "other"];
export const roles = ROLE_SECTIONS.flatMap((section) =>
  ((data as any)[section] as Entry[]).flatMap((e) => e.periods.map((p) => ({ section, location: e.location, span: span(p) }))));

export const events = (["events", "outreach"] as const).flatMap((section) =>
  (data[section] as Entry[]).map((e) => ({ section, location: e.location, start: month(e.periods[0].start!) })));

export const firstYear = Math.floor(Math.min(...roles.map((r) => r.span[0]), ...events.map((e) => e.start)) / 12);
export const lastYear = Math.floor(now / 12);
