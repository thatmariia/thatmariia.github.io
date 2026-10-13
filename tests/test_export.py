import json

import pytest

from folio.content import Content, load, read
from folio.export import LeakError, export

from tests.test_content import EXAMPLE


@pytest.fixture
def public():
    return export(load(EXAMPLE))


def test_no_private_value_reaches_the_output(public):
    # Every private value in the example data contains "CANARY".
    assert "CANARY" not in json.dumps(public)


def test_private_profile_fields_are_dropped(public):
    assert public["profile"].keys() == {"name", "headline", "bio", "author_names", "location", "links", "walk"}


def test_hidden_items_are_dropped(public):
    assert [e["title"] for e in public["research"]] == ["Example Institute"]


def test_education_shows_fields_and_years_only(public):
    assert public["education"] == [{
        "id": "example-university",
        "periods": [{"title": "Applied Mathematics", "start": "2019", "end": "2024"}],
        "related": ["thesis-oscillations"],
    }]


def test_related_links_go_both_ways(public):
    (software,) = public["software"]
    assert software["related"] == ["eeg-paper"]


def test_links_to_hidden_items_are_dropped():
    data = read(EXAMPLE)
    data["research"][1]["id"] = "hidden-lab"
    data["software"][0]["related"] = ["hidden-lab"]
    public = export(Content.model_validate(data))
    assert "hidden-lab" not in json.dumps(public)


def test_private_value_copied_into_public_text_is_caught():
    data = read(EXAMPLE)
    data["profile"]["bio"] += " Call me on " + data["profile"]["phone"]
    with pytest.raises(LeakError, match="CANARY"):
        export(Content.model_validate(data))
