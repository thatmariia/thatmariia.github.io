from pathlib import Path

import pytest
from pydantic import ValidationError

from folio.content import Content, load, read

EXAMPLE = Path(__file__).parent.parent / "example-data"


def test_example_data_is_valid():
    content = load(EXAMPLE)
    assert content.profile.name == "Ada Example"


def test_bare_year_is_accepted_as_date():
    assert load(EXAMPLE).education[0].periods[0].start == "2019"


def mutated(change):
    data = read(EXAMPLE)
    change(data)
    return data


@pytest.mark.parametrize("change, message", [
    (lambda d: d["research"][0].update(typo="x"), "Extra inputs"),
    (lambda d: d["research"][0]["periods"][0].update(start="2024-13"), "pattern"),
    (lambda d: d["research"][0]["periods"][0].update(end="2020"), "before start"),
    (lambda d: d["software"][0].update(title=r"\textbf{x}"), "pattern"),
    (lambda d: d["software"][0].update(status="accepted"), "status"),
    (lambda d: d["posters"][0].update(id="eeg-model"), "duplicate id"),
    (lambda d: d["events"][0].update(related=["missing"]), "unknown id"),
    (lambda d: d["events"][0].update(related=["neuro-conf-2025"]), "unknown id"),
    (lambda d: d["events"][0].pop("id"), "needs an id"),
])
def test_invalid_content_is_rejected(change, message):
    with pytest.raises(ValidationError, match=message):
        Content.model_validate(mutated(change))


def test_unknown_file_is_rejected(tmp_path):
    (tmp_path / "publication.yaml").write_text("[]")
    with pytest.raises(ValueError, match="unknown content files"):
        read(tmp_path)
