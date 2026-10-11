"""LLM 어댑터. 모델 호출은 모두 이 인터페이스 뒤에 둔다.

- MockLLM: 결정적 규칙 기반. CI와 테스트에서 쓴다. 숨긴 문단은 절대 쓰지 않는다.
- ScriptedLLM: 정해진 응답을 순서대로 낸다. 재생성 경로 테스트용.
- OllamaLLM: 로컬 Ollama의 /api/chat. JSON 스키마로 출력을 강제한다.
"""

import json
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Literal, Protocol

import httpx

from app.ai.schemas import Mode

Intent = Literal["fact", "interpretation", "smalltalk", "what_if"]


@dataclass(frozen=True)
class ContextPassage:
    passage_id: str
    chapter: int
    text: str
    hidden: bool


@dataclass(frozen=True)
class ContextFact:
    fact_id: str
    kind: Literal["canon", "interpretation"]
    statement_ko: str
    passage_ids: tuple[str, ...]


@dataclass(frozen=True)
class GenerationContext:
    """프롬프트와 별도로, 어댑터가 참고할 수 있는 구조화 정보."""

    character_id: str
    display_name_ko: str
    question: str
    intent: Intent
    mode: Mode
    passages: tuple[ContextPassage, ...]
    facts: tuple[ContextFact, ...]
    branch_premise_ko: str | None = None


@dataclass(frozen=True)
class LLMRequest:
    messages: tuple[dict[str, str], ...]
    json_schema: dict
    context: GenerationContext


class LLMAdapter(Protocol):
    name: str

    def generate(self, request: LLMRequest) -> str:
        """모델의 원시 출력(JSON 문자열)을 돌려준다. 검증은 호출하는 쪽이 한다."""
        ...


VOICE = {
    "nick": ("제가 본 바로는, ", "그건 저도 잘 모르겠군요. 오늘 밤 처음 온 손님이라서요."),
    "gatsby": ("그건 말이죠, 친구(old sport). ", "글쎄요, 친구. 그 이야기는 제가 할 만한 게 아니군요."),
    "jordan": ("음, ", "글쎄, 그건 나도 몰라."),
}  # fmt: skip


class MockLLM:
    """검색된 문단과 연결된 사실 문장을 인물 말투로 감싸서 답한다."""

    name = "mock"

    def generate(self, request: LLMRequest) -> str:
        ctx = request.context
        prefix, unknown = VOICE.get(ctx.character_id, ("", "잘 모르겠습니다."))

        if ctx.mode == "what_if":
            premise = ctx.branch_premise_ko or ctx.question
            text = f"만약 그랬다면, {ctx.display_name_ko}인 저는 당황해서 말을 고르게 됐을 겁니다."
            return _dump(
                reply=f"(AI WHAT-IF) {text}",
                claims=[{"text": f"가정: {premise} → {text}", "type": "WHAT_IF"}],
                mode="what_if",
                emotion="surprised",
            )

        open_ids = [p.passage_id for p in ctx.passages if not p.hidden]
        if ctx.intent == "smalltalk":
            return _dump(reply=f"{prefix}반갑습니다.", claims=[], mode="canon", emotion="friendly")

        kinds = ("interpretation", "canon") if ctx.intent == "interpretation" else ("canon",)
        for kind in kinds:
            fact = _best_fact(ctx.facts, open_ids, kind)
            if fact:
                claim_type = "INTERPRETATION" if kind == "interpretation" else "CANON"
                return _dump(
                    reply=prefix + fact.statement_ko,
                    claims=[
                        {
                            "text": fact.statement_ko,
                            "type": claim_type,
                            "passage_ids": list(fact.passage_ids),
                            "perspective": ctx.character_id if kind == "interpretation" else None,
                        }
                    ],
                    mode="canon",
                    emotion="thoughtful" if kind == "interpretation" else "calm",
                )
        return _dump(reply=unknown, claims=[], mode="canon", emotion="hesitant")


def _best_fact(
    facts: Iterable[ContextFact], ranked_ids: list[str], kind: str
) -> ContextFact | None:
    rank = {pid: i for i, pid in enumerate(ranked_ids)}
    best: tuple[int, ContextFact] | None = None
    for f in facts:
        hits = [rank[p] for p in f.passage_ids if p in rank]
        if f.kind != kind or not hits:
            continue
        score = min(hits)
        if best is None or score < best[0]:
            best = (score, f)
    return best[1] if best else None


def _dump(**payload: object) -> str:
    return json.dumps(payload, ensure_ascii=False)


@dataclass
class ScriptedLLM:
    outputs: list[str]
    name: str = "scripted"
    requests: list[LLMRequest] = field(default_factory=list)

    def generate(self, request: LLMRequest) -> str:
        self.requests.append(request)
        return self.outputs.pop(0)


class OllamaLLM:
    name = "ollama"

    def __init__(
        self, url: str, model: str, timeout: float = 120.0, client: httpx.Client | None = None
    ) -> None:
        self.url = url.rstrip("/")
        self.model = model
        self.client = client or httpx.Client(timeout=timeout)

    def generate(self, request: LLMRequest) -> str:
        resp = self.client.post(
            f"{self.url}/api/chat",
            json={
                "model": self.model,
                "messages": list(request.messages),
                "format": request.json_schema,
                "stream": False,
                "think": False,
                # 스키마 제한 출력이 끝나지 않는 경우가 있어 길이를 제한한다.
                # 잘린 출력은 파이프라인에서 schema_error로 재생성된다 (E-003).
                "options": {"temperature": 0.3, "num_predict": 1024},
            },
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]


def make_llm(kind: str, url: str = "", model: str = "", timeout: float = 120.0) -> LLMAdapter:
    if kind == "mock":
        return MockLLM()
    if kind == "ollama":
        return OllamaLLM(url, model, timeout)
    raise ValueError(f"unknown llm '{kind}'")
