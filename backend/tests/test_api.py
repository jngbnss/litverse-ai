import pytest
from fastapi.testclient import TestClient

from app.canon.store import fingerprint, get_work
from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(Settings(database_url="sqlite://")))


@pytest.fixture
def session_id(client: TestClient) -> str:
    r = client.post("/api/sessions", json={"work_id": "gatsby", "scene_id": "ch03-party"})
    assert r.status_code == 201
    return r.json()["session_id"]


def test_works_and_scene(client: TestClient):
    works = client.get("/api/works").json()
    assert [w["work_id"] for w in works] == ["gatsby"]
    work = client.get("/api/works/gatsby").json()
    assert work["license"]["status"] == "verified"
    scene = client.get("/api/works/gatsby/scenes/ch03-party").json()
    assert {c["character_id"] for c in scene["characters"]} == {"nick", "gatsby", "jordan"}
    assert len(scene["objects"]) == 5
    # 지식 부여(grant) 같은 내부 정보는 노출하지 않는다
    assert "knowledge_grants" not in scene["characters"][0]


def test_unknown_resources(client: TestClient, session_id: str):
    assert client.get("/api/works/hamlet").status_code == 404
    assert client.get("/api/works/..%2Fbackend").status_code == 404
    assert client.get("/api/sessions/nope").status_code == 404
    assert client.post(f"/api/sessions/{session_id}/inspect/nope").status_code == 404
    r = client.post(f"/api/sessions/{session_id}/dialogue",
                    json={"character_id": "owl-eyes", "question": "책?"})  # fmt: skip
    assert r.status_code == 404


def test_inspect_object(client: TestClient, session_id: str):
    r = client.post(f"/api/sessions/{session_id}/inspect/library-books").json()
    assert [p["passage_id"] for p in r["passages"]] == [
        "gatsby-ch03-p045", "gatsby-ch03-p048", "gatsby-ch03-p050",
    ]  # fmt: skip
    assert any(f["fact_id"] == "f-real-books" for f in r["facts"])


def test_rest_dialogue_with_citations(client: TestClient, session_id: str):
    r = client.post(
        f"/api/sessions/{session_id}/dialogue",
        json={"character_id": "nick", "question": "개츠비가 사람을 죽였다는 소문이 있어?"},
    )
    body = r.json()  # fmt: skip
    assert body["consistent"] and body["mode"] == "canon"
    assert body["citations"] and body["citations"][0]["type"] == "CANON"
    assert len(body["citations"][0]["excerpt"]) <= 241


def test_websocket_dialogue(client: TestClient, session_id: str):
    with client.websocket_connect(f"/api/sessions/{session_id}/ws") as ws:
        ws.send_json({"character_id": "jordan", "question": "개츠비는 옥스퍼드 출신이야?"})
        assert ws.receive_json()["type"] == "thinking"
        reply = ws.receive_json()
        assert reply["type"] == "reply" and reply["consistent"]
        assert ws.receive_json()["type"] == "done"
        ws.send_json({"character_id": "jordan"})
        assert ws.receive_json()["type"] == "error"


def test_websocket_unknown_session(client: TestClient):
    with client.websocket_connect("/api/sessions/nope/ws") as ws:
        assert ws.receive_json()["type"] == "error"


def test_graph_hides_future(client: TestClient, session_id: str):
    g = client.get(f"/api/sessions/{session_id}/graph").json()
    ids = {n["id"] for n in g["nodes"]}
    assert {"nick", "gatsby", "jordan"} <= ids
    assert "daisy" not in ids
    assert all(e["kind"] != "what_if" for e in g["edges"])


def test_branch_flow_keeps_canon_intact(client: TestClient, session_id: str):
    work = get_work("gatsby")
    before = fingerprint(work.path)
    b = client.post(f"/api/sessions/{session_id}/branches",
                    json={"option_id": "w-nick-asks-rumor"})  # fmt: skip
    assert b.status_code == 201
    body = b.json()
    assert body["label"] == "AI WHAT-IF"
    kinds = [e["kind"] for e in body["events"]]
    assert kinds[0] == "choice" and kinds.count("reaction") == 3
    assert all(e["consistent"] for e in body["events"])

    s = client.get(f"/api/sessions/{session_id}").json()
    assert s["mode"] == "what_if"
    r = client.post(
        f"/api/sessions/{session_id}/dialogue",
        json={"character_id": "gatsby", "question": "그 소문이 사실인가요?"},
    ).json()
    assert r["mode"] == "what_if"  # fmt: skip
    g = client.get(f"/api/sessions/{session_id}/graph").json()
    assert any(e["kind"] == "what_if" for e in g["edges"])

    assert client.post(f"/api/sessions/{session_id}/branches/exit").json()["mode"] == "canon"
    assert fingerprint(work.path) == before

    bad = client.post(f"/api/sessions/{session_id}/branches", json={"option_id": "nope"})
    assert bad.status_code == 400


def test_report_separates_kinds(client: TestClient, session_id: str):
    base = f"/api/sessions/{session_id}"
    client.post(f"{base}/inspect/library-books")
    client.post(
        f"{base}/dialogue", json={"character_id": "nick", "question": "서재의 책은 진짜야?"}
    )
    client.post(
        f"{base}/dialogue",
        json={"character_id": "nick", "question": "개츠비가 홀로 서 있던 건 무슨 의미일까?"},
    )
    client.post(f"{base}/branches", json={"option_id": "w-nick-asks-rumor"})  # fmt: skip

    rep = client.get(f"{base}/report").json()
    assert any(f["fact_id"] == "f-real-books" for f in rep["canon"]["facts"])
    assert rep["interpretation"]["claims"] or rep["interpretation"]["team"]
    assert rep["what_if"] and rep["what_if"][0]["label"] == "AI WHAT-IF"
    assert rep["characters_met"][0]["character_id"] == "nick"
    assert len(rep["discussion_questions_ko"]) == 3
    # 장면 시점 이후(4장) 사실은 기록에 나오지 않는다
    assert not any(f["fact_id"].startswith("f-house") for f in rep["canon"]["facts"])
