import json

import httpx
import pytest

from app.ai.adapters import MockLLM, OllamaLLM, ScriptedLLM
from app.ai.schemas import CharacterReply
from app.dialogue.intent import classify
from app.dialogue.pipeline import DialogueError, run_turn

NOW = "t03-party-end"
LABEL = "3장 · 개츠비의 첫 파티"


def turn(work, retriever, llm, character_id, question, mode="canon", **kw):
    return run_turn(work, retriever, llm, character_id=character_id, question=question, now=NOW,
                    mode=mode, scene_label=LABEL, **kw)  # fmt: skip


def dump(**kw) -> str:
    return json.dumps(kw, ensure_ascii=False)


def test_intent():
    assert classify("개츠비는 왜 혼자 서 있었을까?", "canon") == "interpretation"
    assert classify("안녕하세요", "canon") == "smalltalk"
    assert classify("서재의 책은 진짜야?", "canon") == "fact"
    assert classify("뭐든", "what_if") == "what_if"


def test_mock_fact_answer_is_grounded(work, retriever):
    r = turn(work, retriever, MockLLM(), "nick", "개츠비가 사람을 죽였다는 소문이 있어?")
    assert r.report.is_consistent and not r.fallback
    assert r.reply.claims[0].type == "CANON"
    assert "gatsby-ch03-p030" in r.cited_passage_ids


def test_mock_interpretation_is_hedged(work, retriever):
    r = turn(work, retriever, MockLLM(), "nick", "서재의 책이 진짜인데 안 읽힌 건 무슨 의미일까?")
    assert r.report.is_consistent
    assert r.reply.claims[0].type == "INTERPRETATION"


def test_jordan_does_not_reveal_secret(work, retriever):
    r = turn(work, retriever, MockLLM(), "jordan", "개츠비가 서재에서 데이지와 저택 이야기를 했어?")
    assert r.report.is_consistent
    assert "만 건너" not in r.reply.reply


def test_gatsby_unknown_rumor_gets_no_canon_claim(work, retriever):
    r = turn(work, retriever, MockLLM(), "gatsby", "독일 스파이라는 소문 들었어요?")
    assert r.report.is_consistent
    assert "gatsby-ch03-p032" not in r.cited_passage_ids


def test_retry_after_leak(work, retriever):
    leak = dump(reply="데이지가 만 건너편에 있어서 저택을 샀지.", claims=[], mode="canon")
    ok = dump(reply="그건 비밀이야.", claims=[], mode="canon")
    llm = ScriptedLLM([leak, ok])
    r = turn(work, retriever, llm, "jordan", "개츠비가 뭐라고 했어?")
    assert r.attempts == 2 and not r.fallback
    assert any("hidden_fact" in f for f in r.failures)
    assert "규칙을 어겼다" in llm.requests[1].messages[-1]["content"]


def test_fallback_after_two_failures(work, retriever):
    bad = dump(reply="그는 1917년 루이빌에서 데이지를 만났대요.", claims=[], mode="canon")
    r = turn(work, retriever, ScriptedLLM([bad, bad]), "nick", "개츠비는 데이지를 알아?")
    assert r.fallback
    assert r.report.is_consistent
    assert "1917" not in r.reply.reply


def test_invalid_json_is_retried(work, retriever):
    ok = dump(reply="반갑습니다.", claims=[], mode="canon")
    r = turn(work, retriever, ScriptedLLM(["not json", ok]), "nick", "안녕")
    assert r.attempts == 2
    assert r.failures[0].startswith("schema_error")


def test_cited_passage_must_be_in_context(work, retriever):
    out = dump(reply="...", mode="canon",
               claims=[{"text": "도랑에 빠진 차", "type": "CANON",
                        "passage_ids": ["gatsby-ch03-p123"]}])  # fmt: skip
    r = turn(work, retriever, ScriptedLLM([out, out]), "nick", "오렌지 상자는 뭐야?")
    assert any("not_in_context" in f for f in r.failures)


def test_hidden_passages_reach_prompt_marked(work, retriever):
    llm = ScriptedLLM([dump(reply="비밀이야.", claims=[], mode="canon")])
    turn(work, retriever, llm, "jordan", "개츠비가 데이지 저택 이야기 했어?")
    system = llm.requests[0].messages[0]["content"]
    assert 'hidden="true"' in system


def test_what_if_mode(work, retriever):
    r = turn(work, retriever, MockLLM(), "gatsby", "소문이 사실인가요?", mode="what_if",
             premise="닉이 소문을 직접 묻는다.")  # fmt: skip
    assert r.report.is_consistent
    assert r.reply.mode == "what_if"
    assert r.reply.claims[0].type == "WHAT_IF"


def test_non_agent_rejected(work, retriever):
    with pytest.raises(DialogueError):
        turn(work, retriever, MockLLM(), "owl-eyes", "책은 진짜야?")


def test_ollama_adapter_request_shape(work, retriever):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(json.loads(request.content))
        content = dump(reply="반갑네, 친구.", claims=[], mode="canon")
        return httpx.Response(200, json={"message": {"role": "assistant", "content": content}})

    llm = OllamaLLM(
        "http://ollama", "qwen3:8b", client=httpx.Client(transport=httpx.MockTransport(handler))
    )
    r = turn(work, retriever, llm, "gatsby", "안녕하세요")
    assert r.report.is_consistent
    assert seen["model"] == "qwen3:8b" and seen["stream"] is False
    assert seen["format"]["properties"]["mode"] == {"const": "canon"}
    CharacterReply.model_validate_json(dump(reply="x", claims=[], mode="canon"))
