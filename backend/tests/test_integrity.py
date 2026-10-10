import shutil
from pathlib import Path

from app.canon.integrity import check_work
from app.canon.store import Work, load_work


def test_gatsby_work_is_valid(work: Work):
    assert check_work(work) == []


def test_mvp_size(work: Work):
    assert 30 <= len(work.passages) <= 50
    scene = work.scenes["ch03-party"]
    assert len(scene.characters) == 3
    assert len(scene.objects) == 5
    assert len(scene.branches) >= 1


def test_no_what_if_in_canon_data(work: Work):
    assert {f.kind for f in work.facts.values()} <= {"canon", "interpretation"}


def test_branch_files_in_work_dir_are_rejected(work: Work, tmp_path: Path):
    copy = tmp_path / "gatsby"
    shutil.copytree(work.path, copy)
    (copy / "branch-w-nick-asks-rumor.json").write_text("{}", encoding="utf-8")
    errors = check_work(load_work(copy))
    assert any("unexpected file" in e for e in errors)


def test_broken_reference_is_reported(work: Work, tmp_path: Path):
    copy = tmp_path / "gatsby"
    shutil.copytree(work.path, copy)
    facts = copy / "facts.yaml"
    facts.write_text(
        facts.read_text(encoding="utf-8").replace("gatsby-ch03-p002]", "gatsby-ch03-p999]"),
        encoding="utf-8",
    )
    errors = check_work(load_work(copy))
    assert any("gatsby-ch03-p999" in e for e in errors)


def test_canon_data_is_immutable(work: Work):
    import pytest
    from pydantic import ValidationError

    p = next(iter(work.passages.values()))
    with pytest.raises(ValidationError):
        p.text = "changed"  # type: ignore[misc]
    with pytest.raises(TypeError):
        work.passages["x"] = p  # type: ignore[index]
