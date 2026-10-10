"""세션 단위 유스케이스: 생성, 조사, 대화, 관계도, 분기, 기록."""

import re
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.ai.adapters import LLMAdapter
from app.ai.schemas import CharacterReply
from app.branching.engine import BranchResult, create_branch, exit_branch, find_option
from app.canon.store import Work, fingerprint
from app.core.config import Settings
from app.core.db import BranchEventRow, BranchRow, DiscoveryRow, SessionRow, TurnRow
from app.dialogue.pipeline import TurnResult, run_turn
from app.relationships.graph import graph_json
from app.retrieval.bm25 import BM25Retriever
from app.services.report import build_report

WORK_ID = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")


class NotFound(LookupError):
    pass


@dataclass
class LitverseService:
    settings: Settings
    db_factory: sessionmaker
    llm: LLMAdapter
    work_loader: Callable[[str], Work]
    _retrievers: dict[str, BM25Retriever] = field(default_factory=dict)

    # --- helpers -------------------------------------------------------------
    def work(self, work_id: str) -> Work:
        if not WORK_ID.fullmatch(work_id):
            raise NotFound(f"work '{work_id}'")
        try:
            return self.work_loader(work_id)
        except FileNotFoundError as e:
            raise NotFound(f"work '{work_id}'") from e

    def retriever(self, work: Work) -> BM25Retriever:
        if work.work_id not in self._retrievers:
            self._retrievers[work.work_id] = BM25Retriever(work)
        return self._retrievers[work.work_id]

    def _session(self, db: Session, session_id: str) -> SessionRow:
        row = db.get(SessionRow, session_id)
        if row is None:
            raise NotFound(f"session '{session_id}'")
        return row

    def excerpt(self, work: Work, pid: str) -> dict[str, Any]:
        p = work.passages[pid]
        text = p.text
        if len(text) > self.settings.excerpt_chars:
            text = text[: self.settings.excerpt_chars].rstrip() + "…"
        return {"passage_id": pid, "chapter": p.chapter, "excerpt": text}

    def citations(self, work: Work, reply: CharacterReply) -> list[dict[str, Any]]:
        out = []
        for i, claim in enumerate(reply.claims):
            for pid in claim.passage_ids:
                if pid in work.passages:
                    out.append({**self.excerpt(work, pid), "claim_index": i, "type": claim.type})
        return out

    # --- use cases -----------------------------------------------------------
    def create_session(self, work_id: str, scene_id: str) -> SessionRow:
        work = self.work(work_id)
        if scene_id not in work.scenes:
            raise NotFound(f"scene '{scene_id}'")
        with self.db_factory.begin() as db:
            row = SessionRow(
                work_id=work_id,
                scene_id=scene_id,
                now=work.scenes[scene_id].now,
                canon_fingerprint=fingerprint(work.path),
            )
            db.add(row)
        return row

    def get_session(self, session_id: str) -> SessionRow:
        with self.db_factory() as db:
            return self._session(db, session_id)

    def inspect(self, session_id: str, object_id: str) -> dict[str, Any]:
        with self.db_factory.begin() as db:
            s = self._session(db, session_id)
            work = self.work(s.work_id)
            obj = next(
                (o for o in work.scenes[s.scene_id].objects if o.object_id == object_id), None
            )
            if obj is None:
                raise NotFound(f"object '{object_id}'")
            db.add(DiscoveryRow(session_id=s.id, object_id=obj.object_id,
                                passage_ids=list(obj.passage_ids)))  # fmt: skip
            facts = [
                {"fact_id": f.fact_id, "kind": f.kind, "statement_ko": f.statement_ko}
                for f in work.facts.values()
                if set(f.passage_ids) <= set(obj.passage_ids)
            ]
            return {
                "object_id": obj.object_id,
                "name_ko": obj.name_ko,
                "description_ko": obj.description_ko,
                "passages": [self.excerpt(work, pid) for pid in obj.passage_ids],
                "facts": facts,
            }

    def dialogue(self, session_id: str, character_id: str, question: str) -> dict[str, Any]:
        with self.db_factory.begin() as db:
            s = self._session(db, session_id)
            work = self.work(s.work_id)
            scene = work.scenes[s.scene_id]
            if character_id not in scene.characters:
                raise NotFound(f"character '{character_id}' in scene")
            now, premise, label = s.now, None, scene.title_ko
            if s.mode == "what_if" and s.branch_id:
                branch = db.get(BranchRow, s.branch_id)
                option = find_option(scene, branch.option_id)
                now, premise, label = option.diverges_at, option.premise_ko, f"{label} (AI WHAT-IF)"

            history_rows = db.scalars(
                select(TurnRow)
                .where(TurnRow.session_id == s.id, TurnRow.character_id == character_id,
                       TurnRow.mode == s.mode)
                .order_by(TurnRow.id.desc())
                .limit(6)
            ).all()  # fmt: skip
            history = [(t.question, t.reply["reply"]) for t in reversed(history_rows)]

            result: TurnResult = run_turn(
                work, self.retriever(work), self.llm,
                character_id=character_id, question=question, now=now, mode=s.mode,  # type: ignore[arg-type]
                scene_label=label, history=history, premise=premise,
                k=self.settings.retrieval_k, max_attempts=self.settings.max_attempts,
            )  # fmt: skip
            db.add(
                TurnRow(
                    session_id=s.id,
                    branch_id=s.branch_id,
                    character_id=character_id,
                    question=question,
                    intent=result.intent,
                    mode=s.mode,
                    reply=result.reply.model_dump(),
                    report=result.report.model_dump(),
                    passage_ids=[h.passage_id for h in result.retrieved],
                    attempts=result.attempts,
                    fallback=result.fallback,
                )
            )
            return {
                "character_id": character_id,
                "mode": s.mode,
                "reply": result.reply.reply,
                "emotion": result.reply.emotion,
                "claims": [c.model_dump() for c in result.reply.claims],
                "citations": self.citations(work, result.reply),
                "fallback": result.fallback,
                "attempts": result.attempts,
                "consistent": result.report.is_consistent,
            }

    def graph(self, session_id: str) -> dict[str, Any]:
        with self.db_factory() as db:
            s = self._session(db, session_id)
            work = self.work(s.work_id)
            scene = work.scenes[s.scene_id]
            if s.mode == "what_if" and s.branch_id:
                option = find_option(scene, db.get(BranchRow, s.branch_id).option_id)
                return {**graph_json(work, option.diverges_at, scene.characters,
                                     option.relation_changes), "mode": "what_if"}  # fmt: skip
            return {**graph_json(work, s.now, scene.characters), "mode": "canon"}

    def branch(self, session_id: str, option_id: str) -> dict[str, Any]:
        with self.db_factory.begin() as db:
            s = self._session(db, session_id)
            work = self.work(s.work_id)
            result: BranchResult = create_branch(
                db, work, self.retriever(work), self.llm, s, option_id,
                k=self.settings.retrieval_k, max_attempts=self.settings.max_attempts,
            )  # fmt: skip
            return branch_json(result.branch, result.option.title_ko, result.events)

    def exit_branch(self, session_id: str) -> SessionRow:
        with self.db_factory.begin() as db:
            s = self._session(db, session_id)
            exit_branch(s)
            return s

    def report(self, session_id: str) -> dict[str, Any]:
        with self.db_factory() as db:
            s = self._session(db, session_id)
            return build_report(self, db, s)


def branch_json(branch: BranchRow, title_ko: str, events: list[BranchEventRow]) -> dict[str, Any]:
    return {
        "branch_id": branch.id,
        "option_id": branch.option_id,
        "title_ko": title_ko,
        "label": "AI WHAT-IF",
        "diverges_at": branch.diverges_at,
        "snapshot": branch.snapshot,
        "events": [
            {
                "kind": e.kind,
                "character_id": e.character_id,
                "payload": e.payload,
                "consistent": e.consistent,
            }
            for e in events
        ],  # fmt: skip
    }
