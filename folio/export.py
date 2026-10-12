"""Export the public subset of the content for the website.

Only fields named in PUBLIC are exported; anything else, including fields
added to the schema later, stays private by default. Items with `web: false`
are dropped along with every link to them; `related` is recomputed over the
public items so links show in both directions. As a final guard, the output is
checked for any value that only occurs in private data.
"""

import json

from folio.content import Content, Item


def fields(*names: str, **nested: dict) -> dict:
    return dict.fromkeys(names, True) | nested


LINK = fields("label", "url")
ENTRY = fields(
    "id", "title", "location", links=LINK,
    periods=fields("title", "unit", "start", "end", "notes"),
)
WORK = fields("id", "title", "authors", "year", "venue", "status", "doi", "url", links=LINK)

PUBLIC = {
    "profile": fields("name", "headline", "bio", "author_names", links=LINK, walk=fields("label", "year")),
    # Education is shown as field names only: no institutions, levels, years or notes.
    "education": fields("id", periods=fields("title")),
    **{name: ENTRY for name in [
        "research", "teaching", "leadership", "service", "awards", "funding", "events", "outreach", "other",
    ]},
    **{name: WORK for name in [
        "publications", "preprints", "software", "datasets", "posters", "presentations", "reports", "websites", "theses",
    ]},
    "skills": fields("title", "levels"),
}


class LeakError(Exception):
    pass


def pick(value, spec):
    """Copy only the allowlisted parts of `value`, dropping empty values."""
    if isinstance(value, list):
        return [pick(v, spec) for v in value]
    if spec is True:
        return value
    picked = {key: pick(getattr(value, key), sub) for key, sub in spec.items()}
    return {key: v for key, v in picked.items() if v not in (None, [], {})}


def related_links(items: list[Item]) -> dict[str, list[str]]:
    """Links between the given items, in both directions."""
    links = {item.id: [] for item in items if item.id}
    for item in items:
        for ref in item.related:
            if ref in links:  # skip links to hidden items
                for a, b in ((item.id, ref), (ref, item.id)):
                    if b not in links[a]:
                        links[a].append(b)
    return links


def export(content: Content) -> dict:
    sections = {name: [i for i in getattr(content, name) if i.web] for name in PUBLIC if name != "profile"}
    links = related_links([i for section in sections.values() for i in section if isinstance(i, Item)])
    data = {"profile": pick(content.profile, PUBLIC["profile"])}
    for name, section in sections.items():
        data[name] = [pick(item, PUBLIC[name]) for item in section]
        for item, out in zip(section, data[name]):
            if links.get(getattr(item, "id", None)):
                out["related"] = links[item.id]
    check_leaks(content, data)
    return data


def values(data) -> set[str]:
    """Every string and number inside `data`, as strings."""
    if isinstance(data, dict):
        return set().union(*(values(v) for v in data.values()))
    if isinstance(data, list):
        return set().union(*(values(v) for v in data))
    if isinstance(data, bool) or data is None:
        return set()
    return {str(data)}


def check_leaks(content: Content, data: dict) -> None:
    """Fail if a value that is only in private data appears anywhere in the output."""
    private = values(content.model_dump()) - values(data)
    text = json.dumps(data, ensure_ascii=False)
    leaks = sorted(v for v in private if len(v) >= 6 and v in text)
    if leaks:
        raise LeakError(f"private values in public output: {leaks}")
