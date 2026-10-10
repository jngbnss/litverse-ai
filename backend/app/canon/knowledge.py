"""인물별 지식 범위.

원칙 (D-003): 인물이 알 수 없는 문단은 검색 단계에서 빼서 모델이 보지 못하게 한다.

인물 c가 시점 t에 문단 p를 아는 경우:
  (1) c가 p에 등장하고, p가 t 이전이며, p가 화자의 회고 서술이 아닐 때
  (2) 또는 c에게 p에 대한 knowledge_grant가 있고 grant.known_from이 t 이전일 때
hidden: (2) 중 disclosure=hidden인 문단. 알지만 말하지 않으려는 내용이다.
"""

from dataclasses import dataclass

from app.canon.models import Fact, Spoiler
from app.canon.store import Work


@dataclass(frozen=True)
class KnowledgeView:
    work_id: str
    character_id: str
    at: str
    visible: frozenset[str]
    hidden: frozenset[str]

    def can_see(self, passage_id: str) -> bool:
        return passage_id in self.visible

    def is_hidden(self, passage_id: str) -> bool:
        return passage_id in self.hidden


def build_view(work: Work, character_id: str, at: str) -> KnowledgeView:
    if character_id not in work.characters:
        raise KeyError(f"unknown character '{character_id}'")
    now = work.ordinal(at)

    visible: set[str] = set()
    for p in work.passages.values():
        if (
            character_id in p.characters
            and work.ordinal(p.timeline_point) <= now
            and p.narrative_layer != "retrospective"
        ):
            visible.add(p.passage_id)

    hidden: set[str] = set()
    for g in work.characters[character_id].knowledge_grants:
        if work.ordinal(g.known_from) <= now:
            visible.add(g.passage_id)
            if g.disclosure == "hidden":
                hidden.add(g.passage_id)

    return KnowledgeView(
        work_id=work.work_id,
        character_id=character_id,
        at=at,
        visible=frozenset(visible),
        hidden=frozenset(hidden),
    )


def visible_facts(work: Work, view: KnowledgeView) -> list[Fact]:
    """근거 문단을 모두 아는 사실만 인물이 아는 사실이다."""
    return [f for f in work.facts.values() if all(view.can_see(p) for p in f.passage_ids)]


def hidden_facts(work: Work, view: KnowledgeView) -> list[Fact]:
    return [f for f in visible_facts(work, view) if any(view.is_hidden(p) for p in f.passage_ids)]


def unknown_facts(work: Work, view: KnowledgeView) -> list[Fact]:
    return [f for f in work.facts.values() if not all(view.can_see(p) for p in f.passage_ids)]


def future_spoilers(work: Work, at: str) -> list[Spoiler]:
    now = work.ordinal(at)
    return [s for s in work.spoilers.values() if work.ordinal(s.from_point) > now]
