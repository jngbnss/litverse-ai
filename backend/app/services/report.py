"""탐험 기록 (화면 6). 원작 사실 / 해석 / AI WHAT-IF를 섞지 않고 따로 집계한다."""

from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import BranchEventRow, BranchRow, DiscoveryRow, SessionRow, TurnRow
from app.relationships.graph import graph_json

if TYPE_CHECKING:
    from app.services.litverse import LitverseService


def build_report(svc: "LitverseService", db: Session, s: SessionRow) -> dict[str, Any]:
    work = svc.work(s.work_id)
    scene = work.scenes[s.scene_id]
    now = work.ordinal(s.now)
    turns = db.scalars(select(TurnRow).where(TurnRow.session_id == s.id).order_by(TurnRow.id)).all()
    discoveries = db.scalars(select(DiscoveryRow).where(DiscoveryRow.session_id == s.id)).all()

    seen: set[str] = {pid for d in discoveries for pid in d.passage_ids}
    canon_claims: list[dict[str, Any]] = []
    interpretations: list[dict[str, Any]] = []
    met: dict[str, int] = {}
    for t in turns:
        if t.mode != "canon":
            continue
        met[t.character_id] = met.get(t.character_id, 0) + 1
        for c in t.reply["claims"]:
            item = {
                "character_id": t.character_id,
                "text": c["text"],
                "passage_ids": c["passage_ids"],
            }
            if c["type"] == "CANON":
                canon_claims.append(item)
                seen.update(c["passage_ids"])
            elif c["type"] == "INTERPRETATION":
                interpretations.append({**item, "perspective": c.get("perspective")})

    # 사용자가 근거 문단을 본 원작 사실 (장면 시점 이후 사실은 제외)
    confirmed = [
        {"fact_id": f.fact_id, "statement_ko": f.statement_ko, "passage_ids": list(f.passage_ids)}
        for f in work.facts.values()
        if f.kind == "canon"
        and set(f.passage_ids) & seen
        and all(work.passage_point(p) <= now for p in f.passage_ids)
    ]
    team_interpretations = [
        {"fact_id": f.fact_id, "statement_ko": f.statement_ko, "passage_ids": list(f.passage_ids)}
        for f in work.facts.values()
        if f.kind == "interpretation" and set(f.passage_ids) & seen
    ]

    graph = graph_json(work, s.now, scene.characters)
    relations = [e for e in graph["edges"] if {ev["passage_id"] for ev in e["evidence"]} & seen]

    branches = []
    for b in db.scalars(select(BranchRow).where(BranchRow.session_id == s.id)).all():
        events = db.scalars(select(BranchEventRow).where(BranchEventRow.branch_id == b.id)).all()
        what_if_turns = [
            {"character_id": t.character_id, "question": t.question, "reply": t.reply["reply"]}
            for t in turns
            if t.branch_id == b.id and t.mode == "what_if"
        ]
        branches.append(
            {
                "branch_id": b.id,
                "option_id": b.option_id,
                "label": "AI WHAT-IF",
                "events": [{"kind": e.kind, "character_id": e.character_id, "payload": e.payload}
                           for e in events],
                "turns": what_if_turns,
            }
        )  # fmt: skip

    return {
        "session_id": s.id,
        "work": {"work_id": work.work_id, "title": work.metadata.title},
        "scene": {"scene_id": scene.scene_id, "title_ko": scene.title_ko, "now": s.now},
        "characters_met": [
            {"character_id": c, "display_name_ko": work.characters[c].display_name_ko, "turns": n}
            for c, n in met.items()
        ],
        "discoveries": [d.object_id for d in discoveries],
        "canon": {"facts": confirmed, "claims": canon_claims},
        "interpretation": {"team": team_interpretations, "claims": interpretations},
        "what_if": branches,
        "relations": relations,
        "seen_passages": [svc.excerpt(work, pid) for pid in sorted(seen) if pid in work.passages],
        "discussion_questions_ko": list(scene.discussion_questions_ko),
    }
