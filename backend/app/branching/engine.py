"""가상 분기 처리 (mvp-proposal 12번 순서).

1. 현재 시점의 원작 상태를 스냅샷으로 남긴다 (시점 + 원작 해시)
2. 사용자의 선택을 choice 이벤트로 기록한다
3. 영향을 받는 관계를 relation_change 이벤트로 기록한다
4. 인물별 반응을 what_if 모드로 생성한다 (reaction 이벤트)
5. 원작과 분기를 분리해 저장한다 (works/에는 쓰지 않음)
6. 반응마다 canon-guard 결과를 함께 저장하고, 원작 해시가 그대로인지 확인한다
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.ai.adapters import LLMAdapter
from app.canon.models import BranchOption, Scene
from app.canon.store import Work, fingerprint
from app.core.db import BranchEventRow, BranchRow, SessionRow
from app.dialogue.pipeline import run_turn
from app.retrieval.bm25 import Retriever


class BranchError(ValueError):
    pass


class CanonMutationError(RuntimeError):
    pass


@dataclass(frozen=True)
class BranchResult:
    branch: BranchRow
    option: BranchOption
    events: list[BranchEventRow]


def find_option(scene: Scene, option_id: str) -> BranchOption:
    for b in scene.branches:
        if b.branch_id == option_id:
            return b
    raise BranchError(f"unknown branch option '{option_id}'")


def create_branch(
    db: Session,
    work: Work,
    retriever: Retriever,
    llm: LLMAdapter,
    session: SessionRow,
    option_id: str,
    *,
    k: int = 5,
    max_attempts: int = 2,
) -> BranchResult:
    scene = work.scenes[session.scene_id]
    option = find_option(scene, option_id)
    before = fingerprint(work.path)
    if before != session.canon_fingerprint:
        raise CanonMutationError("canon data changed since session start")

    branch = BranchRow(
        session_id=session.id,
        option_id=option.branch_id,
        diverges_at=option.diverges_at,
        snapshot={"canon_now": session.now, "diverges_at": option.diverges_at,
                  "canon_fingerprint": before},
    )  # fmt: skip
    db.add(branch)
    db.flush()

    events = [
        BranchEventRow(
            branch_id=branch.id, kind="choice", payload={"premise_ko": option.premise_ko}
        )
    ]
    events += [
        BranchEventRow(branch_id=branch.id, kind="relation_change", payload=rc.model_dump())
        for rc in option.relation_changes
    ]
    for character_id in option.affected_characters:
        if character_id not in scene.characters:
            continue
        result = run_turn(
            work, retriever, llm,
            character_id=character_id,
            question=option.premise_ko,
            now=option.diverges_at,
            mode="what_if",
            scene_label=f"{scene.title_ko} (AI WHAT-IF)",
            premise=option.premise_ko,
            k=k,
            max_attempts=max_attempts,
        )  # fmt: skip
        events.append(
            BranchEventRow(
                branch_id=branch.id,
                kind="reaction",
                character_id=character_id,
                payload={"reply": result.reply.model_dump(), "fallback": result.fallback},
                consistent=result.report.is_consistent,
            )
        )
    db.add_all(events)
    db.flush()

    session.mode = "what_if"
    session.branch_id = branch.id

    if fingerprint(work.path) != before:
        raise CanonMutationError("canon data changed during branch creation")
    return BranchResult(branch, option, events)


def exit_branch(session: SessionRow) -> None:
    session.mode = "canon"
    session.branch_id = None
