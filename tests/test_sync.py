from folio.sync import normalize, to_work


def test_osf_versions_share_one_doi():
    assert normalize("10.31234/OSF.IO/7D46A_v2") == normalize("10.31234/osf.io/7d46a_v1")


def test_csl_metadata_becomes_a_work():
    csl = {
        "title": ["Models of <i>EEG</i> &amp;amp; more"],
        "author": [{"given": "Ada Belle", "family": "Example"}, {"literal": "The Consortium"}],
        "issued": {"date-parts": [[2025, 3]]},
        "container-title": [],
        "publisher": "Zenodo",
    }
    assert to_work("10.5281/zenodo.1", csl) == {
        "title": "Models of EEG & more",
        "authors": ["A.B. Example", "The Consortium"],
        "year": 2025,
        "venue": "Zenodo",
        "doi": "10.5281/zenodo.1",
    }
