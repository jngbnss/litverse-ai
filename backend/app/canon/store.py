"""works/<work_id>/ 디렉터리를 읽어 불변 Work 객체로 만든다."""

import hashlib
from collections.abc import Mapping
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from types import MappingProxyType
from typing import Any

import yaml

from app.canon.models import (
    Character,
    Fact,
    GlossaryEntry,
    Passage,
    Relationship,
    Scene,
    Spoiler,
    TimelinePoint,
    WorkMetadata,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
WORKS_DIR = REPO_ROOT / "works"

# works/<id>/ 에 허용되는 파일. 분기·세션 데이터가 원작 디렉터리에 섞이지 않게 한다.
ALLOWED_WORK_FILES = frozenset(
    {
        "metadata.yaml",
        "passage-tags.yaml",
        "passages.jsonl",
        "characters.yaml",
        "facts.yaml",
        "spoilers.yaml",
        "relationships.yaml",
        "timeline.yaml",
        "glossary.yaml",
    }
)


def _freeze[K, V](items: dict[K, V]) -> Mapping[K, V]:
    return MappingProxyType(items)


@dataclass(frozen=True)
class Work:
    path: Path
    metadata: WorkMetadata
    passages: Mapping[str, Passage]
    characters: Mapping[str, Character]
    facts: Mapping[str, Fact]
    spoilers: Mapping[str, Spoiler]
    relationships: Mapping[str, Relationship]
    timeline: Mapping[str, TimelinePoint]
    scenes: Mapping[str, Scene]
    glossary: tuple[GlossaryEntry, ...]

    @property
    def work_id(self) -> str:
        return self.metadata.work_id

    def ordinal(self, point_id: str) -> int:
        return self.timeline[point_id].ordinal

    def passage_point(self, passage_id: str) -> int:
        return self.ordinal(self.passages[passage_id].timeline_point)


def _yaml(path: Path) -> Any:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _index[T](items: list[T], key: str) -> Mapping[str, T]:
    out: dict[str, T] = {}
    for item in items:
        k = getattr(item, key)
        if k in out:
            raise ValueError(f"duplicate {key}: {k}")
        out[k] = item
    return _freeze(out)


def load_work(path: Path) -> Work:
    passages = [
        Passage.model_validate_json(line)
        for line in (path / "passages.jsonl").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    scenes = [Scene.model_validate(_yaml(p)) for p in sorted((path / "scenes").glob("*.yaml"))]
    return Work(
        path=path,
        metadata=WorkMetadata.model_validate(_yaml(path / "metadata.yaml")),
        passages=_index(passages, "passage_id"),
        characters=_index(
            [Character.model_validate(c) for c in _yaml(path / "characters.yaml")["characters"]],
            "character_id",
        ),
        facts=_index(
            [Fact.model_validate(f) for f in _yaml(path / "facts.yaml")["facts"]], "fact_id"
        ),
        spoilers=_index(
            [Spoiler.model_validate(s) for s in _yaml(path / "spoilers.yaml")["spoilers"]],
            "spoiler_id",
        ),
        relationships=_index(
            [
                Relationship.model_validate(r)
                for r in _yaml(path / "relationships.yaml")["relationships"]
            ],
            "relation_id",
        ),
        timeline=_index(
            [TimelinePoint.model_validate(t) for t in _yaml(path / "timeline.yaml")["points"]],
            "point_id",
        ),
        scenes=_index(scenes, "scene_id"),
        glossary=tuple(
            GlossaryEntry.model_validate(g) for g in _yaml(path / "glossary.yaml")["entries"]
        ),
    )


def fingerprint(path: Path) -> str:
    """원작 디렉터리 전체의 해시. 분기 전후로 같아야 한다 (원작 오염 검사)."""
    h = hashlib.sha256()
    for f in sorted(p for p in path.rglob("*") if p.is_file()):
        h.update(f.relative_to(path).as_posix().encode())
        h.update(f.read_bytes())
    return h.hexdigest()


@cache
def get_work(work_id: str) -> Work:
    return load_work(WORKS_DIR / work_id)
