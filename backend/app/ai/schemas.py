"""LLM 출력 스키마 (D-005). 모델 응답은 반드시 이 스키마로 검증한다."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ClaimType = Literal["CANON", "INTERPRETATION", "WHAT_IF"]
Mode = Literal["canon", "what_if"]


class Claim(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1)
    type: ClaimType
    passage_ids: list[str] = []
    perspective: str | None = None


class CharacterReply(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reply: str = Field(min_length=1)
    claims: list[Claim] = []
    mode: Mode
    emotion: str = "neutral"


class Issue(BaseModel):
    code: str
    detail: str
    claim_index: int | None = None


class ConsistencyReport(BaseModel):
    is_consistent: bool
    canon_conflicts: list[Issue] = []
    knowledge_violations: list[Issue] = []
    hidden_disclosures: list[Issue] = []
    unsupported_claims: list[Issue] = []
    interpretation_as_fact: list[Issue] = []
    mode_violation: bool = False
    mode_issues: list[Issue] = []
