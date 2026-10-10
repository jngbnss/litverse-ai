"""LitVerse 평가 스크립트.

    uv run --project backend python evals/run_eval.py --llm mock --retriever bm25 \
        --out evals/reports/mock-bm25.json --check

지표 정의는 evals/README.md 참고. --check를 주면 thresholds.json의 기준을 어길 때 1로 종료한다.
"""

import argparse
import json
import statistics
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.ai.adapters import LLMAdapter, make_llm
from app.ai.schemas import CharacterReply
from app.canon.guard import check_reply
from app.canon.knowledge import build_view
from app.canon.store import Work, fingerprint, get_work
from app.core.config import Settings
from app.core.db import make_sessionmaker
from app.dialogue.pipeline import run_turn
from app.retrieval.bm25 import BM25Retriever, Retriever
from app.services.litverse import LitverseService

EVALS = Path(__file__).resolve().parent


def load(name: str) -> list[dict[str, Any]]:
    lines = (EVALS / name).read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def rate(n: int, d: int) -> float:
    return round(n / d, 4) if d else 0.0


@dataclass
class Ctx:
    work: Work
    retriever: Retriever
    llm: LLMAdapter
    now: str
    label: str
    k: int


def make_retriever(kind: str, work: Work) -> Retriever:
    if kind == "bm25":
        return BM25Retriever(work)
    from app.retrieval.embedding import (
        EmbeddingRetriever,
        HybridRetriever,
        SentenceTransformerEncoder,
    )

    emb = EmbeddingRetriever(work, SentenceTransformerEncoder("BAAI/bge-m3"))
    if kind == "embedding":
        return emb
    if kind == "hybrid":
        return HybridRetriever(BM25Retriever(work), emb)
    raise ValueError(kind)


# --- 검색 -------------------------------------------------------------------
def eval_retrieval(ctx: Ctx) -> dict[str, Any]:
    rows = []
    for case in load("retrieval-cases.jsonl"):
        view = build_view(ctx.work, case["character_id"], case["at"])
        t0 = time.perf_counter()
        hits = ctx.retriever.search(case["question"], view, k=ctx.k)
        ms = (time.perf_counter() - t0) * 1000
        got = [h.passage_id for h in hits]
        gold = set(case["gold_passage_ids"])
        rows.append(
            {
                "case_id": case["case_id"],
                "lang": case["lang"],
                "hit": bool(gold & set(got)),
                "recall": len(gold & set(got)) / len(gold),
                "wrong_work": sum(not p.startswith(f"{ctx.work.work_id}-") for p in got),
                "wrong_character": sum(not view.can_see(p) for p in got),
                "n": len(got),
                "ms": ms,
                "top": got,
            }
        )

    def agg(sub: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "cases": len(sub),
            f"hit@{ctx.k}": rate(sum(r["hit"] for r in sub), len(sub)),
            f"recall@{ctx.k}": round(statistics.mean(r["recall"] for r in sub), 4),
        }

    total = sum(r["n"] for r in rows)
    ms = sorted(r["ms"] for r in rows)
    return {
        **agg(rows),
        "by_lang": {lang: agg([r for r in rows if r["lang"] == lang]) for lang in ("ko", "en")},
        "wrong_work_rate": rate(sum(r["wrong_work"] for r in rows), total),
        "wrong_character_rate": rate(sum(r["wrong_character"] for r in rows), total),
        "latency_ms": {
            "mean": round(statistics.mean(ms), 2),
            "p95": round(ms[int(len(ms) * 0.95) - 1], 2),
        },
        "misses": [r["case_id"] for r in rows if not r["hit"]],
    }


# --- 원작 사실 ---------------------------------------------------------------
def predicted(reply: CharacterReply) -> str:
    types = {c.type for c in reply.claims}
    if "CANON" in types:
        return "canon"
    if "INTERPRETATION" in types:
        return "interpretation"
    return "no_evidence"


def eval_canon(ctx: Ctx) -> dict[str, Any]:
    rows = []
    for case in load("canon-cases.jsonl"):
        r = run_turn(ctx.work, ctx.retriever, ctx.llm, character_id=case["character_id"],
                     question=case["question"], now=ctx.now, mode="canon",
                     scene_label=ctx.label, k=ctx.k)  # fmt: skip
        gold = set(case["gold_passage_ids"])
        canon_claims = [c for c in r.reply.claims if c.type == "CANON"]
        cited = {p for c in r.reply.claims for p in c.passage_ids}
        rows.append(
            {
                "case_id": case["case_id"],
                "expected": case["expected"],
                "predicted": predicted(r.reply),
                "grounded": bool(gold & cited),
                "canon_claims": len(canon_claims),
                "wrong_citations": sum(
                    1 for c in canon_claims if gold and not (set(c.passage_ids) & gold)
                ),
                "fallback": r.fallback,
                "retried": r.attempts > 1,
                "consistent": r.report.is_consistent,
            }
        )
    canon = [r for r in rows if r["expected"] == "canon"]
    interp = [r for r in rows if r["expected"] == "interpretation"]
    none = [r for r in rows if r["expected"] == "no_evidence"]
    claims = sum(r["canon_claims"] for r in rows if r["expected"] != "no_evidence")
    return {
        "cases": len(rows),
        "fact_accuracy": rate(
            sum(r["predicted"] == "canon" and r["grounded"] for r in canon), len(canon)
        ),
        "interpretation_accuracy": rate(
            sum(r["predicted"] == "interpretation" and r["grounded"] for r in interp), len(interp)
        ),
        "classification_accuracy": rate(
            sum(r["predicted"] == r["expected"] for r in rows), len(rows)
        ),
        "unsupported_claim_rate": rate(sum(r["predicted"] == "canon" for r in none), len(none)),
        "wrong_citation_rate": rate(sum(r["wrong_citations"] for r in rows), claims),
        "final_inconsistent_rate": rate(sum(not r["consistent"] for r in rows), len(rows)),
        "fallback_rate": rate(sum(r["fallback"] for r in rows), len(rows)),
        "retry_rate": rate(sum(r["retried"] for r in rows), len(rows)),
        "errors": [
            {k: r[k] for k in ("case_id", "expected", "predicted", "grounded")}
            for r in rows
            if r["predicted"] != r["expected"]
            or (r["expected"] != "no_evidence" and not r["grounded"])
        ],
    }


# --- 인물 일관성 -------------------------------------------------------------
def eval_character(ctx: Ctx) -> dict[str, Any]:
    live_violations = future_leaks = 0
    detected = adversarial = false_pos = controls = 0
    rows = []
    cases = load("character-cases.jsonl")
    for case in cases:
        cid = case["character_id"]
        view = build_view(ctx.work, cid, ctx.now)
        r = run_turn(ctx.work, ctx.retriever, ctx.llm, character_id=cid, question=case["question"],
                     now=ctx.now, mode="canon", scene_label=ctx.label, k=ctx.k)  # fmt: skip
        live = check_reply(ctx.work, view, r.reply, "canon")
        violated = not live.is_consistent or any(
            not view.can_see(p) for c in r.reply.claims for p in c.passage_ids
        )
        live_violations += violated
        future_leaks += any(i.code == "future_spoiler" for i in live.knowledge_violations)
        row = {"case_id": case["case_id"], "live_violation": violated}

        if case["adversarial"]:
            adversarial += 1
            rep = check_reply(
                ctx.work, view, CharacterReply(mode="canon", **case["adversarial"]), "canon"
            )
            detected += not rep.is_consistent
            row["adversarial_detected"] = not rep.is_consistent
        if case["control"]:
            controls += 1
            rep = check_reply(
                ctx.work, view, CharacterReply(mode="canon", **case["control"]), "canon"
            )
            false_pos += not rep.is_consistent
            row["control_flagged"] = not rep.is_consistent
        rows.append(row)
    return {
        "cases": len(cases),
        "knowledge_violation_rate": rate(live_violations, len(cases)),
        "future_leak_rate": rate(future_leaks, len(cases)),
        "guard_detection_rate": rate(detected, adversarial),
        "guard_false_positive_rate": rate(false_pos, controls),
        "missed_adversarial": [
            r["case_id"] for r in rows if r.get("adversarial_detected") is False
        ],
        "flagged_controls": [r["case_id"] for r in rows if r.get("control_flagged")],
    }


# --- 가상 분기 ---------------------------------------------------------------
def eval_branch(llm: LLMAdapter, retriever_kind: str) -> dict[str, Any]:
    work = get_work("gatsby")
    before = fingerprint(work.path)
    retriever = make_retriever(retriever_kind, work)
    svc = LitverseService(Settings(database_url="sqlite://"), make_sessionmaker("sqlite://"), llm,
                          get_work, _retrievers={work.work_id: retriever})  # type: ignore[arg-type]  # fmt: skip
    rows = []
    events_total = events_bad = 0
    for case in load("branch-cases.jsonl"):
        s = svc.create_session("gatsby", "ch03-party")
        b = svc.branch(s.id, case["option_id"])
        events_total += len(b["events"])
        events_bad += sum(not e["consistent"] for e in b["events"])
        fu = case["follow_up"]
        in_branch = svc.dialogue(s.id, fu["character_id"], fu["question"])
        svc.exit_branch(s.id)
        after = svc.dialogue(s.id, fu["character_id"], fu["question"])
        rep = svc.report(s.id)
        rows.append(
            {
                "case_id": case["case_id"],
                "follow_up_what_if": in_branch["mode"] == "what_if" and in_branch["consistent"],
                "canon_clean_after_exit": after["mode"] == "canon"
                and all(c["type"] != "WHAT_IF" for c in after["claims"]),
                "report_separated": bool(rep["what_if"])
                and all("가정" not in c["text"] for c in rep["canon"]["claims"]),
            }
        )
    mutated = fingerprint(work.path) != before
    n = len(rows)
    return {
        "cases": n,
        "canon_mutation_rate": 1.0 if mutated else 0.0,
        "branch_internal_inconsistency_rate": rate(events_bad, events_total),
        "follow_up_mode_accuracy": rate(sum(r["follow_up_what_if"] for r in rows), n),
        "canon_isolation_rate": rate(sum(r["canon_clean_after_exit"] for r in rows), n),
        "report_separation_rate": rate(sum(r["report_separated"] for r in rows), n),
    }


def check(report: dict[str, Any], thresholds: dict[str, dict[str, list]]) -> list[str]:
    failures = []
    for section, rules in thresholds.items():
        for metric, (op, value) in rules.items():
            got = report[section]
            for part in metric.split("."):
                got = got[part]
            ok = got >= value if op == ">=" else got <= value
            if not ok:
                failures.append(f"{section}.{metric} = {got} (expected {op} {value})")
    return failures


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--llm", default="mock", choices=["mock", "ollama"])
    ap.add_argument("--retriever", default="bm25", choices=["bm25", "embedding", "hybrid"])
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    settings = Settings.from_env()
    llm = make_llm(args.llm, settings.ollama_url, settings.ollama_model, settings.ollama_timeout)
    work = get_work("gatsby")
    scene = work.scenes[work.metadata.default_scene]
    ctx = Ctx(work, make_retriever(args.retriever, work), llm, scene.now, scene.title_ko, args.k)

    t0 = time.perf_counter()
    report = {
        "config": {"llm": args.llm, "retriever": args.retriever, "k": args.k,
                   "model": settings.ollama_model if args.llm == "ollama" else "mock"},
        "retrieval": eval_retrieval(ctx),
        "canon": eval_canon(ctx),
        "character": eval_character(ctx),
        "branch": eval_branch(llm, args.retriever),
    }  # fmt: skip
    report["elapsed_s"] = round(time.perf_counter() - t0, 2)

    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text + "\n", encoding="utf-8")
    summary = {
        "retrieval": {
            k: v for k, v in report["retrieval"].items() if k not in ("misses", "by_lang")
        },
        "canon": {k: v for k, v in report["canon"].items() if k != "errors"},
        "character": {k: v for k, v in report["character"].items() if not isinstance(v, list)},
        "branch": report["branch"],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if args.check:
        failures = check(
            report, json.loads((EVALS / "thresholds.json").read_text(encoding="utf-8"))
        )
        for f in failures:
            print(f"[eval] FAIL {f}")
        return 1 if failures else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
