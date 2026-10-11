"""인물 프롬프트 빌더.

모델에 들어가는 원문은 지식 필터를 통과한 문단뿐이다 (D-003).
숨긴 문단은 '알지만 말하지 말 것'으로 표시해서 넣는다.
"""

from app.ai.adapters import ContextFact, ContextPassage, GenerationContext
from app.ai.schemas import CharacterReply, Mode
from app.canon.models import Character

RULES_CANON = """\
규칙:
1. 아래 <passage>에 있는 내용만 원작 사실(CANON)로 말한다. CANON 주장에는 그 passage_id를 붙인다.
2. 원문에서 추론한 생각은 INTERPRETATION으로 표시하고 "~로 볼 수 있다", "~일지도 모른다"처럼 단정하지 않는다.
3. hidden="true" 문단은 네가 알지만 지금은 말하지 않으려는 비밀이다. 인용하지 말고, 넌지시 피한다.
4. 문단에 없는 일, 앞으로 일어날 일, 다른 사람의 속마음은 모른다고 답한다.
5. 원작 모드에서는 WHAT_IF 주장을 쓰지 않는다. mode는 "canon"이다.
6. 한국어로, 인물의 말투로 2~4문장만 답한다.
7. reply에서 말한 사실과 해석을 claims에 한 줄씩 나눠 적는다. 근거 문단이 없는 답이면 claims는 빈 배열이다.
8. 의미·이유·상징·느낌을 묻는 질문은 해석 질문이다. 네 생각은 INTERPRETATION 주장으로 쓰고 근거 문단 id를 붙인다.
   근거가 된 장면은 reply 안에서 말하고, 따로 CANON 주장으로 적지 않는다.

예시 (형식만 참고한다. 내용과 id는 이 장면과 무관한 가짜다):
- 사실 질문 "그 사람은 몇 시에 왔어?"
  {"reply": "아홉 시쯤 왔어요.", "claims": [{"text": "그는 아홉 시에 도착했다.", "type": "CANON", "passage_ids": ["<문단 id>"]}], "mode": "canon"}
- 해석 질문 "그가 계속 시계를 본 건 무슨 뜻일까?"
  {"reply": "시계를 몇 번이나 들여다보더군요. 누군가를 기다렸던 게 아닐까 싶어요.", "claims": [{"text": "그는 누군가를 기다리고 있었다고 볼 수 있다.", "type": "INTERPRETATION", "passage_ids": ["<문단 id>"]}], "mode": "canon"}
- 근거 없는 질문 "그가 좋아하는 색은?"
  {"reply": "글쎄요, 그런 얘기는 들은 적이 없어요.", "claims": [], "mode": "canon"}
"""

RULES_WHAT_IF = """\
규칙 (AI WHAT-IF 가상 분기):
1. 지금은 원작과 다른 가정의 세계다. 가정에서 생긴 일은 WHAT_IF 주장으로 표시한다.
2. 원작에서 확인되는 내용을 함께 말할 때는 CANON으로 표시하고 passage_id를 붙인다.
3. 분기 시점 이후의 원작 사건이나 결말은 모른다.
4. mode는 "what_if"이다. 한국어로, 인물의 말투로 2~4문장만 답한다.
5. reply에서 말한 내용을 claims에 한 줄씩 나눠 적는다 (WHAT_IF 또는 CANON).
"""


def _passage_block(p: ContextPassage) -> str:
    hidden = ' hidden="true"' if p.hidden else ""
    return f'<passage id="{p.passage_id}" chapter="{p.chapter}"{hidden}>\n{p.text}\n</passage>'


def _fact_line(f: ContextFact) -> str:
    label = "원작 사실" if f.kind == "canon" else "해석 후보"
    return f"- [{label}] {f.statement_ko} (근거: {', '.join(f.passage_ids)})"


def system_prompt(character: Character, ctx: GenerationContext, scene_label: str) -> str:
    lines = [
        f"너는 F. 스콧 피츠제럴드의 『위대한 개츠비』 속 {character.display_name_ko}"
        f"({character.display_name})다. 지금은 {scene_label}이다.",
        f"역할: {character.role_ko}",
        f"성격: {', '.join(character.personality_traits)}",
        f"말투: {', '.join(character.speech_style)}",
        f"목표: {', '.join(character.goals)}",
    ]
    if character.background_notes_ko:
        lines.append("배경(팀 요약, 근거로 인용 불가): " + " ".join(character.background_notes_ko))
    lines.append("")
    lines.append(RULES_WHAT_IF if ctx.mode == "what_if" else RULES_CANON)
    if ctx.branch_premise_ko:
        lines.append(f"가정: {ctx.branch_premise_ko}\n")
    if ctx.facts:
        lines.append("네가 아는 사실:")
        lines.extend(_fact_line(f) for f in ctx.facts)
        lines.append("")
    lines.append("검색된 원문:")
    lines.extend(_passage_block(p) for p in ctx.passages)
    if not ctx.passages:
        lines.append("(없음)")
    return "\n".join(lines)


def build_messages(
    character: Character,
    ctx: GenerationContext,
    scene_label: str,
    history: list[tuple[str, str]],
) -> tuple[dict[str, str], ...]:
    messages = [{"role": "system", "content": system_prompt(character, ctx, scene_label)}]
    for question, answer in history:
        messages.append({"role": "user", "content": question})
        messages.append({"role": "assistant", "content": answer})
    messages.append({"role": "user", "content": ctx.question})
    return tuple(messages)


def retry_message(issues: list[str]) -> dict[str, str]:
    return {
        "role": "user",
        "content": "방금 답변은 규칙을 어겼다: "
        + "; ".join(issues)
        + ". 규칙을 지켜서 JSON으로 다시 답하라.",
    }


def reply_schema(mode: Mode) -> dict:
    schema = CharacterReply.model_json_schema()
    schema["properties"]["mode"] = {"const": mode}
    # 선택 필드는 작은 모델이 통째로 빼먹는다 (E-003). 모델에게는 필수로 요구한다.
    schema["required"] = ["reply", "claims", "mode"]
    schema["$defs"]["Claim"]["required"] = ["text", "type", "passage_ids"]
    return schema
