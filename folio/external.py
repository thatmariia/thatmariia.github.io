"""Fetch public data from outside the content, for the website figures.

Run by hand when updating the data, like sync. Writes one JSON file with:
- coordinates of every location in the content (OpenStreetMap Nominatim; known ones are reused),
- co-author institutions with coordinates (OpenAlex, by ORCID),
- views and downloads of Zenodo records (by ORCID),
- daily contributions from the public GitHub contribution calendar (what the profile shows).
Every value comes from a public source.
"""

import json
import re
import time
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import quote

from folio.content import Content
from folio.sync import get_json

HEADERS = {"User-Agent": "folio (https://github.com/thatmariia/thatmariia.github.io)"}


def get_text(url: str) -> str:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode()


def handle(content: Content, site: str) -> str | None:
    """The account name from a profile link such as https://github.com/name."""
    return next((link.url.rstrip("/").split("/")[-1] for link in content.profile.links if site in link.url), None)


def locations(content: Content, known: dict) -> dict:
    places = {e.location for name in Content.model_fields for e in getattr(content, name)
              if hasattr(e, "location") and e.location} | {content.profile.location}
    result = {}
    for place in sorted(p for p in places if p and not re.search(r"virtual|global", p, re.I)):
        if place in known:
            result[place] = known[place]
            continue
        found = get_json(f"https://nominatim.openstreetmap.org/search?format=json&limit=1&q={quote(place)}")
        time.sleep(1)  # Nominatim allows one request per second
        if found:
            result[place] = [round(float(found[0]["lat"]), 3), round(float(found[0]["lon"]), 3)]
        else:
            print(f"no coordinates found for {place!r}")
    return result


def institutions(orcid: str) -> list:
    author = get_json(f"https://api.openalex.org/authors/orcid:{orcid}")["id"].split("/")[-1]
    works = get_json(f"https://api.openalex.org/works?filter=author.id:{author}&per-page=200&select=id,authorships")["results"]
    counts = Counter(i for w in works for i in {i["id"].split("/")[-1] for a in w["authorships"] for i in a.get("institutions", [])})
    result, ids = [], list(counts)
    for k in range(0, len(ids), 50):
        batch = "|".join(ids[k:k + 50])
        for inst in get_json(f"https://api.openalex.org/institutions?filter=openalex_id:{batch}&per-page=50&select=id,display_name,country_code,geo")["results"]:
            geo = inst.get("geo") or {}
            if geo.get("latitude") is not None:
                result.append({"name": inst["display_name"], "country": inst["country_code"], "city": geo.get("city"),
                               "lat": round(geo["latitude"], 3), "lon": round(geo["longitude"], 3),
                               "works": counts[inst["id"].split("/")[-1]]})
    return sorted(result, key=lambda i: -i["works"])


def usage(orcid: str) -> dict:
    result, page = {}, 1
    while True:
        hits = get_json(f"https://zenodo.org/api/records?q=creators.orcid:%22{orcid}%22&size=25&page={page}")["hits"]["hits"]
        for hit in hits:
            stats = hit.get("stats", {})
            result[hit["conceptdoi"]] = {"views": stats.get("unique_views", 0), "downloads": stats.get("unique_downloads", 0)}
        if len(hits) < 25:
            return result
        page += 1


def contributions(user: str, since: int) -> dict:
    """Days with contributions, from the public profile calendar, one year at a time."""
    days = {}
    for year in range(since, date.today().year + 1):
        page = get_text(f"https://github.com/users/{user}/contributions?from={year}-01-01&to={year}-12-31")
        day_of = {cell: day for day, cell in re.findall(r'data-date="(\d{4}-\d{2}-\d{2})" id="([^"]+)"', page)}
        for cell, text in re.findall(r'<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]+)</tool-tip>', page):
            match = re.match(r"(\d+) contribution", text)
            if match and cell in day_of:
                days[day_of[cell]] = int(match.group(1))
    return dict(sorted(days.items()))


def external(content: Content, output: Path) -> None:
    previous = json.loads(output.read_text()) if output.exists() else {}
    orcid = handle(content, "orcid.org")
    github = handle(content, "github.com")
    data = {"locations": locations(content, previous.get("locations", {}))}
    if orcid:
        data["institutions"] = institutions(orcid)
        data["usage"] = usage(orcid)
    if github:
        first = get_json(f"https://api.github.com/users/{github}")["created_at"][:4]
        data["contributions"] = contributions(github, int(first))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {output}: {len(data['locations'])} locations, {len(data.get('institutions', []))} institutions, "
          f"{len(data.get('usage', {}))} Zenodo records, {len(data.get('contributions', {}))} days with contributions")
