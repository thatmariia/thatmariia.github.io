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

export const STATUS = { "in-progress": "In progress", submitted: "Submitted", published: "" } as const;

/** What one item of each section is called, e.g. in cross-links. */
const KIND: Record<string, string> = {
  publications: "Publication", preprints: "Preprint", software: "Software", datasets: "Dataset",
  posters: "Poster", presentations: "Presentation", reports: "Report", websites: "Website", theses: "Thesis",
  education: "Education", research: "Position", teaching: "Teaching", leadership: "Leadership",
  service: "Service", awards: "Award", funding: "Funding", events: "Event", outreach: "Outreach", other: "Experience",
  beyond: "Beyond science",
};

/** The site's pages, and which page each content section lives on. */
export const PAGES = [
  ["/", "Home"], ["/outputs/", "Outputs"], ["/path/", "Path"], ["/events/", "Events"], ["/beyond/", "Beyond science"],
] as const;
export const PAGE_OF: Record<string, string> = {
  publications: "/outputs/", preprints: "/outputs/", software: "/outputs/", datasets: "/outputs/", posters: "/outputs/",
  presentations: "/outputs/", reports: "/outputs/", websites: "/outputs/", theses: "/outputs/",
  education: "/path/", research: "/path/", teaching: "/path/", leadership: "/path/", service: "/path/",
  awards: "/path/", funding: "/path/", other: "/path/", events: "/events/", outreach: "/events/", beyond: "/beyond/",
};

export const outputSections = ["software", "datasets", "posters", "presentations", "reports", "websites", "theses"]
  .map((key) => ({ id: key, title: key[0].toUpperCase() + key.slice(1), items: (data as any)[key] as Work[] }))
  .filter((s) => s.items.length);

/** Every linkable item by id: its kind, title and a one-line summary for previews. */
export const refs: Record<string, { kind: string; title: string; summary: string; href: string }> = {};
for (const [section, items] of Object.entries(data)) {
  if (!(section in KIND)) continue;
  for (const item of items as (Entry | Work)[]) {
    if (!item.id) continue;
    if ("authors" in item) {
      const status = STATUS[item.status];
      refs[item.id] = {
        kind: KIND[section],
        href: `${PAGE_OF[section]}#${item.id}`,
        title: item.title,
        summary: [item.venue, status || item.year].filter(Boolean).join(" · "),
      };
    } else {
      const entry = item as Entry;
      const roles = entry.periods.map((p) => p.title).filter(Boolean);
      refs[item.id] = {
        kind: KIND[section],
        href: `${PAGE_OF[section]}#${item.id}`,
        title: entry.title ?? roles.join(", "),
        summary: [entry.title ? roles.join(", ") : "", entry.location, entry.title ? dates(entry.periods[0]) : ""]
          .filter(Boolean).join(" · "),
      };
    }
  }
}

/** Current affiliations: organisations of ongoing research positions. */
export const affiliations = [
  ...new Set((data.research as Entry[]).filter((e) => e.periods.some((p) => p.end === "present")).map((e) => e.title!)),
];

export const firstSentence = (s: string) => s.split(/(?<=\.)\s/)[0].trim();

const today = new Date().toISOString().slice(0, 7);
export const isUpcoming = (e: Entry) => (e.periods[0].start ?? "") > today;

export const pathSections = (
  [
    ["awards", "Awards & distinctions", data.awards], ["research", "Research", data.research],
    ["teaching", "Teaching", data.teaching], ["leadership", "Leadership", data.leadership], ["service", "Service", data.service],
    ["funding", "Funding", data.funding], ["other", "Other", data.other],
  ] as [string, string, Entry[]][]
).map(([id, title, items]) => ({ id, title, items })).filter((s) => s.items.length);

export const studies = (data.education as Entry[]).flatMap((e) => e.periods.map((p) => p.title!));
export const thesisLinks = (data.education as Entry[]).flatMap((e) => e.related ?? []);
