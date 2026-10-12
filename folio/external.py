"""Fetch public data from outside the content, for the website figures.

Run by hand when updating the data, like sync. Writes one JSON file with:
- coordinates of every location in the content (OpenStreetMap Nominatim; known ones are reused),
- daily contributions from the public GitHub contribution calendar (what the profile shows).
Every value comes from a public source.
"""

import json
import re
import time
import urllib.request
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
    github = handle(content, "github.com")
    data = {"locations": locations(content, previous.get("locations", {}))}
    if github:
        first = get_json(f"https://api.github.com/users/{github}")["created_at"][:4]
        data["contributions"] = contributions(github, int(first))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {output}: {len(data['locations'])} locations, {len(data.get('contributions', {}))} days with contributions")
