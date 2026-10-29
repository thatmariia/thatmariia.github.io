"""Find your works on Zenodo, Crossref and ORCID and add the ones you choose.

Run by hand when updating the data. New DOIs are offered one by one and the
ones you keep are appended to the matching YAML file; skipped DOIs are
remembered in skipped-dois.txt. Your own data always wins: for works you
already have, differences in title or year are only reported.
"""

import html
import json
import re
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

import yaml

from folio.content import Content, Work

HEADERS = {"User-Agent": "folio-sync (https://github.com/thatmariia/thatmariia.github.io)"}
WORK_SECTIONS = [name for name, field in Content.model_fields.items() if field.annotation == list[Work]]
# Only these sections show a venue (journal or server); others leave it out.
VENUED = {"papers", "preprints"}
# Source type -> section suggested when prompting.
SUGGEST = {
    "software": "software", "dataset": "datasets", "poster": "posters", "presentation": "presentations",
    "journal-article": "papers", "proceedings-article": "papers", "posted-content": "preprints",
    "preprint": "preprints", "conference-poster": "posters", "data-set": "datasets", "dissertation-thesis": "theses",
}


def get_json(url: str, accept: str = "application/json"):
    request = urllib.request.Request(url, headers=HEADERS | {"Accept": accept})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def normalize(doi: str) -> str:
    """Lowercase, and fold OSF preprint versions (_v1, _v2) into one DOI."""
    return re.sub(r"_v\d+$", "", doi.strip().lower())


def zenodo(orcid: str):
    page = 1
    while True:
        url = f"https://zenodo.org/api/records?q=creators.orcid:%22{orcid}%22&size=25&page={page}"
        hits = get_json(url)["hits"]["hits"]
        for hit in hits:
            # The concept DOI stays the same across versions.
            yield hit.get("conceptdoi") or hit["doi"], hit["metadata"]["resource_type"]["type"]
        if len(hits) < 25:
            return
        page += 1


def crossref(orcid: str, family_name: str):
    base = "https://api.crossref.org/works?rows=1000&select=DOI,type,author"
    for item in get_json(f"{base}&filter=orcid:{orcid}")["message"]["items"]:
        yield item["DOI"], item["type"]
    # Many records carry no ORCID, so also search by name and keep exact surname matches.
    for item in get_json(f"{base}&query.author={quote(family_name)}")["message"]["items"]:
        if any(a.get("family", "").casefold() == family_name.casefold() for a in item.get("author", [])):
            yield item["DOI"], item["type"]


def orcid_works(orcid: str):
    for group in get_json(f"https://pub.orcid.org/v3.0/{orcid}/works")["group"]:
        summary = group["work-summary"][0]
        for ext in summary.get("external-ids", {}).get("external-id", []):
            if ext["external-id-type"] == "doi":
                yield ext["external-id-value"], summary["type"]


def same(value) -> str:
    return " ".join(str(value).casefold().split())


def fetch_work(doi: str) -> dict | None:
    """Citation metadata for any DOI (Crossref or DataCite) via doi.org."""
    try:
        return to_work(doi, get_json(f"https://doi.org/{doi}", accept="application/vnd.citationstyles.csl+json"))
    except (urllib.error.URLError, KeyError, IndexError) as error:
        print(f"{doi}: could not fetch metadata ({error})")
        return None


def to_work(doi: str, csl: dict) -> dict:
    def author(a):
        if "literal" in a:
            return a["literal"]
        initials = "".join(f"{part[0]}." for part in a.get("given", "").split())
        return f"{initials} {a['family']}".strip()

    def text(value):  # CSL strings may be lists and contain HTML markup or entities
        value = value if isinstance(value, str) else (value or [""])[0]
        return " ".join(html.unescape(html.unescape(re.sub(r"<[^>]+>", "", value))).split())

    work = {
        "title": text(csl["title"]),
        "authors": [author(a) for a in csl.get("author", [])],
        "year": csl["issued"]["date-parts"][0][0],
        "venue": text(csl.get("container-title")) or text(csl.get("publisher")),
        "doi": doi,
    }
    return {key: value for key, value in work.items() if value}


def sync(directory: Path, content: Content) -> None:
    orcid = next(link.url.rstrip("/").split("/")[-1] for link in content.profile.links if "orcid.org" in link.url)
    family_name = content.profile.name.split()[-1]
    skip_file = directory / "skipped-dois.txt"
    skipped = set(skip_file.read_text().split()) if skip_file.exists() else set()
    known = {normalize(w.doi): w for name in WORK_SECTIONS for w in getattr(content, name) if w.doi}

    found: dict[str, tuple[str, str]] = {}
    for source in (zenodo(orcid), crossref(orcid, family_name), orcid_works(orcid)):
        for doi, kind in source:
            found.setdefault(normalize(doi), (doi, kind))

    for work in known.values():
        fetched = fetch_work(work.doi) or {}
        for field in ("title", "year"):
            if field in fetched and same(fetched[field]) != same(getattr(work, field)):
                print(f"{work.doi}: your {field} {getattr(work, field)!r} kept over {fetched[field]!r}")

    new = [found[key] for key in found if key not in known and key not in skipped]
    print(f"\n{len(new)} new DOI(s). Sections: {', '.join(WORK_SECTIONS)}")
    for doi, kind in new:
        work = fetch_work(doi)
        if not work:
            continue
        suggestion = SUGGEST.get(kind, "")
        print(f"\n{work['title']} ({work['year']}, {work.get('venue', '?')})\n  https://doi.org/{doi}  [{kind}]")
        answer = input(f"  add to section [{suggestion}], s = skip, q = quit: ").strip() or suggestion
        if answer == "q":
            break
        if answer == "s":
            with skip_file.open("a") as f:
                f.write(normalize(doi) + "\n")
        elif answer in WORK_SECTIONS:
            if answer not in VENUED:
                work.pop("venue", None)
            with (directory / f"{answer}.yaml").open("a") as f:
                f.write("\n" + yaml.safe_dump([work], sort_keys=False, allow_unicode=True, width=1000, default_flow_style=None))
            print(f"  added to {answer}.yaml")
        else:
            print("  not a section; left for next time")
