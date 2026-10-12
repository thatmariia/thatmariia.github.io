"""Content schemas and loader.

A content directory holds one YAML file per field of `Content` (profile.yaml,
research.yaml, ...). Everything is validated strictly: unknown files or fields
are errors, so typos never silently drop data.
"""

from pathlib import Path
from typing import Annotated, Literal

import yaml
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator

# YAML reads a bare year as an int, so coerce before matching "2024" or "2024-08".
Date = Annotated[str, BeforeValidator(str), Field(pattern=r"^\d{4}(-(0[1-9]|1[0-2]))?$")]
Id = Annotated[str, Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")]
Url = Annotated[str, Field(pattern=r"^https?://\S+$")]
# Prose supports **bold** and *italic*; a backslash means leftover LaTeX.
Text = Annotated[str, Field(min_length=1, pattern=r"^[^\\]*$")]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Item(Model):
    """Fields shared by every listed item."""

    id: Id | None = None  # needed to be linked to, or to link from
    related: list[Id] = []  # links are shown in both directions
    web: bool = True
    cv: bool = True


class Link(Model):
    label: str
    url: Url


class Profile(Model):
    name: str
    headline: Text
    bio: Text
    author_names: list[str] = Field(min_length=1)  # highlighted in author lists
    links: list[Link] = []
    email: str | None = None
    phone: str | None = None


class Period(Model):
    title: Text | None = None  # role or programme; omit when the entry says it all
    level: str | None = None  # e.g. BSc, Propedeuse; shown in the CV only
    unit: Text | None = None  # department, lab, group
    start: Date
    end: Date | Literal["present"] | None = None  # None: a single month or year
    notes: list[Text] = []

    @model_validator(mode="after")
    def _ordered(self):
        if self.end not in (None, "present") and self.end < self.start:
            raise ValueError(f"end {self.end} is before start {self.start}")
        return self


class Entry(Item):
    """An organisation or event with one or more dated periods."""

    title: Text
    location: str | None = None
    periods: list[Period] = Field(min_length=1)


class Work(Item):
    """A publication or research output."""

    type: Literal[
        "article", "preprint", "workshop-paper",
        "software", "dataset", "website", "thesis", "poster", "presentation",
    ]
    title: Text
    authors: list[str] = Field(min_length=1)
    year: int
    venue: str | None = None  # journal, repository, conference
    status: Literal["published", "in-progress"] = "published"
    doi: Annotated[str, Field(pattern=r"^10\.\d{4,9}/\S+$")] | None = None
    url: Url | None = None


class SkillGroup(Model):
    title: str
    levels: dict[str, list[str]]  # e.g. {"Experienced": [...], "Familiar": [...]}
    web: bool = True
    cv: bool = True


class Content(Model):
    profile: Profile
    education: list[Entry] = []
    research: list[Entry] = []
    teaching: list[Entry] = []
    leadership: list[Entry] = []
    other: list[Entry] = []
    events: list[Entry] = []
    outreach: list[Entry] = []
    publications: list[Work] = []
    outputs: list[Work] = []
    skills: list[SkillGroup] = []

    def items(self) -> list[Item]:
        return [i for name in type(self).model_fields for i in getattr(self, name) if isinstance(i, Item)]

    @model_validator(mode="after")
    def _links(self):
        ids: set[str] = set()
        for item in self.items():
            if item.id in ids:
                raise ValueError(f"duplicate id {item.id!r}")
            if item.id:
                ids.add(item.id)
        for item in self.items():
            if item.related and not item.id:
                raise ValueError(f"{item.title!r} has related links, so it needs an id")
            for ref in item.related:
                if ref not in ids or ref == item.id:
                    raise ValueError(f"{item.id!r} links to unknown id {ref!r}")
        return self


def read(directory: Path) -> dict:
    """Read every YAML file in `directory` into a dict keyed by file stem."""
    files = {p.stem: p for p in directory.glob("*.yaml")}
    unknown = files.keys() - Content.model_fields.keys()
    if unknown:
        raise ValueError(f"unknown content files in {directory}: {sorted(unknown)}")
    return {name: yaml.safe_load(path.read_text()) or [] for name, path in files.items()}


def load(directory: Path) -> Content:
    return Content.model_validate(read(directory))
