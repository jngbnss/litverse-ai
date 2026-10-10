"""질문 의도 분류 (규칙 기반 기준선)."""

from app.ai.adapters import Intent
from app.ai.schemas import Mode

INTERPRETATION_CUES = (
    "왜", "의미", "상징", "해석", "어떻게 생각", "어떤 사람", "느낌", "느껴", "뜻",
    "why", "mean", "symbol", "think of",
)  # fmt: skip
SMALLTALK_CUES = ("안녕", "반가", "hello", "hi ")


def classify(question: str, mode: Mode) -> Intent:
    if mode == "what_if":
        return "what_if"
    q = question.casefold()
    if any(c in q for c in INTERPRETATION_CUES):
        return "interpretation"
    if len(q) < 12 and any(c in q for c in SMALLTALK_CUES):
        return "smalltalk"
    return "fact"
