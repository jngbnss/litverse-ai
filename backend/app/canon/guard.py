"""canon-guard: 인물 답변의 규칙 기반 일관성 검사 (D-006).

LLM 판정 없이 구조(주장 type, passage_ids)와 누설 표현만으로 검사한다.
근거성(주장 내용이 인용 문단과 실제로 맞는지)의 의미 검사는 2단계 LLM/임베딩 판정에서 보완한다.
"""

from app.ai.schemas import CharacterReply, Claim, ConsistencyReport, Issue, Mode
from app.canon.knowledge import KnowledgeView, future_spoilers, hidden_facts, unknown_facts
from app.canon.store import Work

HEDGE_MARKERS = (
    "해석", "수 있", "것 같", "듯", "아마", "어쩌면", "보인", "보여", "느껴", "생각", "짐작",
    "가능성", "지도 모르", "might", "may ", "perhaps", "seems", "could", "possibly", "i think",
)  # fmt: skip

SAFE_REPLIES = {
    "nick": "글쎄요, 그건 제가 확실히 말할 수 있는 일이 아니군요.",
    "gatsby": "그 이야기는 다음에 하지요, 친구(old sport).",
    "jordan": "글쎄, 그건 내가 말해 줄 수 있는 게 아니야.",
}


def term_hit(text: str, term: str) -> bool:
    """'A&B' 형식이면 A와 B가 모두 있어야 한다. 대소문자 무시."""
    lowered = text.casefold()
    return all(part.strip().casefold() in lowered for part in term.split("&"))


def _texts(reply: CharacterReply) -> list[tuple[int | None, str]]:
    return [(None, reply.reply), *((i, c.text) for i, c in enumerate(reply.claims))]


def check_reply(
    work: Work, view: KnowledgeView, reply: CharacterReply, session_mode: Mode
) -> ConsistencyReport:
    r = ConsistencyReport(is_consistent=True)

    if reply.mode != session_mode:
        r.mode_issues.append(Issue(code="mode_mismatch", detail=f"{reply.mode} != {session_mode}"))

    for i, claim in enumerate(reply.claims):
        _check_claim(work, view, i, claim, session_mode, r)

    texts = _texts(reply)
    for fact in unknown_facts(work, view):
        for idx, text in texts:
            for term in fact.leak_terms:
                if term_hit(text, term):
                    r.knowledge_violations.append(
                        Issue(
                            code="unknown_fact", detail=f"{fact.fact_id}: '{term}'", claim_index=idx
                        )
                    )
    if session_mode == "canon":
        for fact in hidden_facts(work, view):
            for idx, text in texts:
                for term in fact.leak_terms:
                    if term_hit(text, term):
                        r.hidden_disclosures.append(
                            Issue(
                                code="hidden_fact",
                                detail=f"{fact.fact_id}: '{term}'",
                                claim_index=idx,
                            )
                        )
    for spoiler in future_spoilers(work, view.at):
        for idx, text in texts:
            for term in spoiler.leak_terms:
                if term_hit(text, term):
                    r.knowledge_violations.append(
                        Issue(
                            code="future_spoiler",
                            detail=f"{spoiler.spoiler_id}: '{term}'",
                            claim_index=idx,
                        )
                    )

    r.mode_violation = bool(r.mode_issues)
    r.is_consistent = not (
        r.canon_conflicts
        or r.knowledge_violations
        or r.hidden_disclosures
        or r.unsupported_claims
        or r.interpretation_as_fact
        or r.mode_violation
    )
    return r


def _check_claim(
    work: Work, view: KnowledgeView, i: int, claim: Claim, mode: Mode, r: ConsistencyReport
) -> None:
    if claim.type == "WHAT_IF":
        if mode != "what_if":
            r.mode_issues.append(Issue(code="what_if_in_canon", detail=claim.text, claim_index=i))
        return

    if claim.type == "CANON" and not claim.passage_ids:
        r.unsupported_claims.append(Issue(code="no_evidence", detail=claim.text, claim_index=i))

    for pid in claim.passage_ids:
        if pid not in work.passages:
            if pid.split("-ch", 1)[0] != work.work_id:
                r.canon_conflicts.append(Issue(code="other_work", detail=pid, claim_index=i))
            else:
                r.unsupported_claims.append(
                    Issue(code="unknown_passage", detail=pid, claim_index=i)
                )
        elif not view.can_see(pid):
            r.knowledge_violations.append(Issue(code="unseen_passage", detail=pid, claim_index=i))
        elif view.is_hidden(pid) and mode == "canon":
            r.hidden_disclosures.append(Issue(code="hidden_passage", detail=pid, claim_index=i))

    if claim.type == "INTERPRETATION":
        lowered = claim.text.casefold()
        if not any(m in lowered for m in HEDGE_MARKERS):
            r.interpretation_as_fact.append(
                Issue(code="no_hedge", detail=claim.text, claim_index=i)
            )


def safe_reply(character_id: str, mode: Mode) -> CharacterReply:
    """검증에 두 번 실패하면 이 답으로 바꾼다."""
    text = SAFE_REPLIES.get(character_id, "그건 확실히 말씀드릴 수 없습니다.")
    return CharacterReply(reply=text, claims=[], mode=mode, emotion="hesitant")
