"""작품 데이터 스키마. works/<work_id>/ 아래 파일과 1:1로 대응한다.

모든 모델은 frozen이다. 원작 데이터는 앱 실행 중에 바뀌지 않는다.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Id = str
NarrativeLayer = Literal["in_scene", "summary", "retrospective"]
LicenseStatus = Literal["verified", "pending", "rejected"]
FactKind = Literal["canon", "interpretation"]

PASSAGE_ID_PATTERN = r"^[a-z0-9]+(-[a-z0-9]+)*-ch\d{2}-p\d{3}$"


class Frozen(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class LicenseInfo(Frozen):
    status: LicenseStatus
    jurisdictions: dict[str, LicenseStatus]
    note: str = ""


class SourceInfo(Frozen):
    name: str
    url: str
    edition: str
    retrieved: str


class WorkMetadata(Frozen):
    work_id: Id
    title: str
    title_ko: str
    author: str
    published: int
    language: str
    summary_ko: str
    source: SourceInfo
    license: LicenseInfo
    default_scene: Id


class Passage(Frozen):
    passage_id: str = Field(pattern=PASSAGE_ID_PATTERN)
    work_id: Id
    chapter: int = Field(ge=1)
    order: int = Field(ge=1)
    text: str = Field(min_length=1)
    characters: tuple[Id, ...]
    mentions: tuple[Id, ...] = ()
    speakers: tuple[Id, ...] = ()
    location: Id
    time_context: str
    timeline_point: Id
    narrative_layer: NarrativeLayer
    topics: tuple[str, ...]
    license_status: LicenseStatus
    source_reference: str


class TimelinePoint(Frozen):
    point_id: Id
    ordinal: int
    label_ko: str
    chapter: int | None = None


class KnowledgeGrant(Frozen):
    """인물이 '그 문단에 등장하지 않아도' 아는 내용.

    lived: 장면 이전에 직접 겪었고 원작에서는 나중에 서술되는 일
    told: 장면 중 누군가에게 들은 일
    hidden: 알지만 현재 장면에서 말하지 않으려는 일
    """

    passage_id: str
    known_from: Id
    mode: Literal["lived", "told"]
    disclosure: Literal["open", "hidden"]
    note_ko: str = ""


class Character(Frozen):
    character_id: Id
    display_name: str
    display_name_ko: str
    agent: bool
    role_ko: str
    personality_traits: tuple[str, ...] = ()
    speech_style: tuple[str, ...] = ()
    goals: tuple[str, ...] = ()
    background_notes_ko: tuple[str, ...] = ()
    knowledge_grants: tuple[KnowledgeGrant, ...] = ()
    default_emotion: str = "neutral"


class Fact(Frozen):
    fact_id: Id
    kind: FactKind
    statement_ko: str
    passage_ids: tuple[str, ...] = Field(min_length=1)
    perspectives: tuple[Id, ...] = ()
    leak_terms: tuple[str, ...] = ()
    author: str = "team"


class Spoiler(Frozen):
    """데이터셋 밖의 미래 사건. 근거 문단은 없고 누설 탐지에만 쓴다."""

    spoiler_id: Id
    from_point: Id
    description_ko: str
    leak_terms: tuple[str, ...] = Field(min_length=1)


class Relationship(Frozen):
    relation_id: Id
    source: Id
    target: Id
    type: str
    label_ko: str
    kind: FactKind
    passage_ids: tuple[str, ...] = Field(min_length=1)
    revealed_at: Id


class Hotspot(Frozen):
    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)


class SceneObject(Frozen):
    object_id: Id
    name_ko: str
    description_ko: str
    passage_ids: tuple[str, ...] = Field(min_length=1)
    hotspot: Hotspot


class DialogueGoal(Frozen):
    character_id: Id
    goal_ko: str


class BranchOption(Frozen):
    branch_id: Id
    title_ko: str
    premise_ko: str
    diverges_at: Id
    affected_characters: tuple[Id, ...]


class Scene(Frozen):
    scene_id: Id
    work_id: Id
    title_ko: str
    chapter: int
    location: Id
    now: Id
    characters: tuple[Id, ...]
    objects: tuple[SceneObject, ...]
    dialogue_goals: tuple[DialogueGoal, ...]
    branches: tuple[BranchOption, ...]
    discussion_questions_ko: tuple[str, ...] = ()


class GlossaryEntry(Frozen):
    """한국어 질의를 영어 원문 BM25 검색어로 확장하는 작품별 용어집."""

    ko: str
    en: tuple[str, ...]
