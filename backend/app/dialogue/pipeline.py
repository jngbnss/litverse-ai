"""대화 한 턴. backend/DESIGN.md '대화 한 턴의 흐름' 참고."""

from dataclasses import dataclass

from pydantic import ValidationError

from app.ai.adapters import ContextFact, ContextPassage, GenerationContext, LLMAdapter, LLMRequest
from app.ai.schemas import CharacterReply, ConsistencyReport, Issue, Mode
from app.canon.guard import check_reply, safe_reply
from app.canon.knowledge import KnowledgeView, build_view, hidden_facts, visible_facts
from app.canon.store import Work
from app.characters.prompt import build_messages, reply_schema, retry_message
from app.dialogue.intent import classify
from app.retrieval.bm25 import Hit, Retriever


@dataclass(frozen=True)
class TurnResult:
    character_id: str
    question: str
    intent: str
    reply: CharacterReply
    report: ConsistencyReport
    attempts: int
    fallback: bool
    retrieved: tuple[Hit, ...]
    failures: tuple[str, ...]

    @property
    def cited_passage_ids(self) -> list[str]:
        seen: dict[str, None] = {}
        for c in self.reply.claims:
            for pid in c.passage_ids:
                seen[pid] = None
        return list(seen)


class DialogueError(ValueError):
    pass


def _context(
    work: Work,
    view: KnowledgeView,
    character_id: str,
    question: str,
    mode: Mode,
    hits: list[Hit],
    premise: str | None,
) -> GenerationContext:
    hit_ids = {h.passage_id for h in hits}
    hidden_ids = {f.fact_id for f in hidden_facts(work, view)}
    facts = [
        ContextFact(f.fact_id, f.kind, f.statement_ko, f.passage_ids)
        for f in visible_facts(work, view)
        if f.fact_id not in hidden_ids and hit_ids & set(f.passage_ids)
    ]
    passages = [
        ContextPassage(h.passage_id, work.passages[h.passage_id].chapter,
                       work.passages[h.passage_id].text, h.hidden)
        for h in hits
    ]  # fmt: skip
    return GenerationContext(
        character_id=character_id,
        display_name_ko=work.characters[character_id].display_name_ko,
        question=question,
        intent=classify(question, mode),
        mode=mode,
        passages=tuple(passages),
        facts=tuple(facts),
        branch_premise_ko=premise,
    )


def _context_check(reply: CharacterReply, ctx: GenerationContext, report: ConsistencyReport):
    """모델에 주지 않은 문단을 인용하면 지어낸 근거로 본다."""
    allowed = {p.passage_id for p in ctx.passages} | {
        pid for f in ctx.facts for pid in f.passage_ids
    }
    for i, claim in enumerate(reply.claims):
        for pid in claim.passage_ids:
            if pid not in allowed:
                report.unsupported_claims.append(
                    Issue(code="not_in_context", detail=pid, claim_index=i)
                )
    if report.unsupported_claims:
        report.is_consistent = False


def _summarize(report: ConsistencyReport) -> list[str]:
    groups = (
        report.canon_conflicts, report.knowledge_violations, report.hidden_disclosures,
        report.unsupported_claims, report.interpretation_as_fact, report.mode_issues,
    )  # fmt: skip
    return [f"{i.code}({i.detail})" for g in groups for i in g]


def run_turn(
    work: Work,
    retriever: Retriever,
    llm: LLMAdapter,
    *,
    character_id: str,
    question: str,
    now: str,
    mode: Mode,
    scene_label: str,
    history: list[tuple[str, str]] | None = None,
    premise: str | None = None,
    k: int = 5,
    max_attempts: int = 2,
) -> TurnResult:
    character = work.characters.get(character_id)
    if character is None or not character.agent:
        raise DialogueError(f"'{character_id}' is not a dialogue character")
    if not question.strip():
        raise DialogueError("empty question")

    view = build_view(work, character_id, now)
    hits = retriever.search(question, view, k=k)
    ctx = _context(work, view, character_id, question, mode, hits, premise)
    messages = list(build_messages(character, ctx, scene_label, history or []))
    schema = reply_schema(mode)

    failures: list[str] = []
    for attempt in range(1, max_attempts + 1):
        raw = llm.generate(LLMRequest(tuple(messages), schema, ctx))
        try:
            reply = CharacterReply.model_validate_json(raw)
        except ValidationError as e:
            problem = f"schema_error({e.error_count()} errors)"
            failures.append(problem)
            messages += [{"role": "assistant", "content": raw}, retry_message([problem])]
            continue
        report = check_reply(work, view, reply, mode)
        _context_check(reply, ctx, report)
        if report.is_consistent:
            return TurnResult(character_id, question, ctx.intent, reply, report, attempt, False,
                              tuple(hits), tuple(failures))  # fmt: skip
        problems = _summarize(report)
        failures.extend(problems)
        messages += [{"role": "assistant", "content": raw}, retry_message(problems)]

    fallback = safe_reply(character_id, mode)
    report = check_reply(work, view, fallback, mode)
    return TurnResult(character_id, question, ctx.intent, fallback, report, max_attempts, True,
                      tuple(hits), tuple(failures))  # fmt: skip
