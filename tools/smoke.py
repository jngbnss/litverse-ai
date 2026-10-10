"""스모크 테스트. 단계를 완료로 표시하기 전에 반드시 통과해야 한다.

사용법:
    uv run --project backend python tools/smoke.py            # 지금까지 완료된 모든 단계
    uv run --project backend python tools/smoke.py --stage 1  # 특정 단계만

단위 테스트(pytest)와 달리, 실제 works/ 데이터로 사용자 시나리오 한 줄기를 끝까지 따라간다.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from collections.abc import Callable
from pathlib import Path

from app.ai.schemas import CharacterReply, Claim
from app.canon.guard import check_reply, safe_reply
from app.canon.integrity import check_work
from app.canon.knowledge import build_view
from app.canon.store import get_work
from app.retrieval.bm25 import BM25Retriever


def stage1() -> None:
    work = get_work("gatsby")
    errors = check_work(work)
    assert not errors, errors
    scene = work.scenes[work.metadata.default_scene]
    print(f"  work: {work.metadata.title} / scene: {scene.title_ko} / now: {scene.now}")

    # 오브젝트 조사 → 근거 문단이 실제로 있다
    for obj in scene.objects:
        assert all(pid in work.passages for pid in obj.passage_ids), obj.object_id
    print(f"  objects: {len(scene.objects)} ok")

    # 질문 → 인물별 지식 범위 안에서 검색
    retriever = BM25Retriever(work)
    question = "개츠비가 사람을 죽였다는 소문이 있어?"
    nick = build_view(work, "nick", scene.now)
    gatsby = build_view(work, "gatsby", scene.now)
    nick_hits = retriever.search(question, nick, k=3)
    gatsby_hits = retriever.search(question, gatsby, k=3)
    assert any(h.passage_id == "gatsby-ch03-p030" for h in nick_hits)
    assert all(h.passage_id != "gatsby-ch03-p030" for h in gatsby_hits)
    print(f"  retrieval nick: {[h.passage_id for h in nick_hits]}")
    print(f"  retrieval gatsby (rumor filtered): {[h.passage_id for h in gatsby_hits]}")

    # 근거 있는 답변은 통과, 누설 답변은 차단
    good = CharacterReply(
        reply="노란 드레스의 아가씨가 그런 말을 하더군요.",
        claims=[Claim(text="손님이 개츠비가 사람을 죽였다고 말했다.", type="CANON",
                      passage_ids=["gatsby-ch03-p030"])],
        mode="canon",
    )  # fmt: skip
    leak = CharacterReply(reply="그는 데이지가 만 건너편에 있으라고 저택을 샀어.", mode="canon")
    assert check_reply(work, nick, good, "canon").is_consistent
    assert not check_reply(work, build_view(work, "jordan", scene.now), leak, "canon").is_consistent
    assert check_reply(work, gatsby, safe_reply("gatsby", "canon"), "canon").is_consistent
    print("  guard: grounded reply passes, hidden-fact leak blocked")


def stage2() -> None:
    from fastapi.testclient import TestClient

    from app.canon.store import fingerprint
    from app.core.config import Settings
    from app.main import create_app

    work = get_work("gatsby")
    before = fingerprint(work.path)
    c = TestClient(create_app(Settings(llm="mock", database_url="sqlite://")))

    # 1·2. 작품과 장면 선택 → 세션
    assert c.get("/api/health").json()["llm"] == "mock"
    assert c.get("/api/works").json()[0]["work_id"] == "gatsby"
    sid = c.post("/api/sessions", json={"work_id": "gatsby", "scene_id": "ch03-party"}).json()[
        "session_id"
    ]
    base = f"/api/sessions/{sid}"
    print(f"  session: {sid}")

    # 3. 오브젝트 조사
    for obj in ("invitation", "library-books", "ditch-coupe"):
        r = c.post(f"{base}/inspect/{obj}")
        assert r.status_code == 200 and r.json()["passages"], obj
    print("  inspect: 3 objects ok")

    # 4·5·6. 자유 질문 → 지식 범위 안의 답 → 근거
    with c.websocket_connect(f"{base}/ws") as ws:
        for character_id, question in [
            ("nick", "개츠비가 사람을 죽였다는 소문이 있어?"),
            ("jordan", "개츠비가 서재에서 무슨 이야기를 했어?"),
            ("gatsby", "전쟁 때 어느 사단에 있었어요?"),
            ("nick", "개츠비가 계단에 혼자 서 있던 건 무슨 의미일까?"),
        ]:
            ws.send_json({"character_id": character_id, "question": question})
            assert ws.receive_json()["type"] == "thinking"
            reply = ws.receive_json()
            assert ws.receive_json()["type"] == "done"
            assert reply["type"] == "reply" and reply["consistent"], reply
            kinds = sorted({ci["type"] for ci in reply["citations"]})
            print(f"  {character_id}: {reply['reply'][:40]}… {kinds}")
            if character_id == "jordan":
                assert "만 건너" not in reply["reply"] and "데이지" not in reply["reply"]

    # 7. 관계도
    graph = c.get(f"{base}/graph").json()
    assert "daisy" not in {n["id"] for n in graph["nodes"]}
    print(f"  graph: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges (daisy hidden)")

    # 8·9. 원작과 다른 선택 → 별도 분기
    branch = c.post(f"{base}/branches", json={"option_id": "w-nick-asks-rumor"}).json()
    assert branch["label"] == "AI WHAT-IF"
    assert all(e["consistent"] for e in branch["events"])
    r = c.post(f"{base}/dialogue", json={"character_id": "gatsby", "question": "정말 그랬나요?"})
    assert r.json()["mode"] == "what_if"
    c.post(f"{base}/branches/exit")
    assert fingerprint(work.path) == before
    print(f"  branch: {len(branch['events'])} events, canon fingerprint unchanged")

    # 10. 기록에서 사실·해석·분기 구분
    rep = c.get(f"{base}/report").json()
    assert rep["canon"]["facts"] and rep["what_if"]
    assert rep["interpretation"]["claims"] or rep["interpretation"]["team"]
    print(
        f"  report: canon {len(rep['canon']['facts'])}, "
        f"interpretation {len(rep['interpretation']['claims']) + len(rep['interpretation']['team'])}, "
        f"what-if {len(rep['what_if'])}"
    )


REPO = Path(__file__).resolve().parents[1]


def _run(cmd: list[str], cwd: Path) -> None:
    exe = shutil.which(cmd[0]) or cmd[0]
    r = subprocess.run([exe, *cmd[1:]], cwd=cwd, capture_output=True, text=True, encoding="utf-8")
    assert r.returncode == 0, f"{' '.join(cmd)} failed:\n{r.stdout[-2000:]}\n{r.stderr[-2000:]}"


def _wait(url: str, timeout: float = 30.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    return
        except OSError:
            time.sleep(0.4)
    raise AssertionError(f"timeout waiting for {url}")


def _http(method: str, url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json"})  # fmt: skip
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def stage3() -> None:
    frontend = REPO / "frontend"
    for cmd in (["npm", "run", "typecheck"], ["npm", "test"], ["npm", "run", "build"]):
        _run(cmd, frontend)
        print(f"  {' '.join(cmd)}: ok")

    env = {**os.environ, "LITVERSE_LLM": "mock", "LITVERSE_DATABASE_URL": "sqlite://",
           "LITVERSE_BACKEND": "http://127.0.0.1:8766"}  # fmt: skip
    procs = [
        subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "--factory", "app.main:create_app", "--port", "8766"],
            cwd=REPO / "backend", env=env,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        ),
        subprocess.Popen(
            [shutil.which("npx") or "npx", "vite", "preview", "--host", "127.0.0.1", "--port", "4174", "--strictPort"],
            cwd=frontend, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        ),
    ]  # fmt: skip
    try:
        web = "http://127.0.0.1:4174"
        _wait(f"{web}/")
        _wait(f"{web}/api/health")
        with urllib.request.urlopen(f"{web}/") as resp:
            assert b'<div id="root">' in resp.read()
        print("  vite preview → index.html, /api proxy ok")

        sid = _http("POST", f"{web}/api/sessions",
                    {"work_id": "gatsby", "scene_id": "ch03-party"})["session_id"]  # fmt: skip
        _http("POST", f"{web}/api/sessions/{sid}/inspect/library-books")

        import asyncio

        import websockets

        async def ask() -> dict:
            async with websockets.connect(f"ws://127.0.0.1:4174/api/sessions/{sid}/ws") as ws:
                await ws.send(
                    json.dumps({"character_id": "nick", "question": "서재의 책은 진짜야?"})
                )
                events = [json.loads(await ws.recv()) for _ in range(3)]
            assert [e["type"] for e in events] == ["thinking", "reply", "done"], events
            return events[1]

        reply = asyncio.run(ask())
        assert reply["consistent"] and reply["citations"]
        print(f"  websocket via proxy: {reply['reply'][:40]}…")

        _http("POST", f"{web}/api/sessions/{sid}/branches", {"option_id": "w-nick-asks-rumor"})
        assert _http("GET", f"{web}/api/sessions/{sid}")["mode"] == "what_if"
        rep = _http("GET", f"{web}/api/sessions/{sid}/report")
        assert rep["canon"]["facts"] and rep["what_if"]
        print("  branch + report via proxy ok")
    finally:
        for p in procs:
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)], capture_output=True)
            else:
                p.terminate()


def stage4() -> None:
    out = REPO / "evals" / "reports" / "smoke-mock-bm25.json"
    _run([sys.executable, str(REPO / "evals" / "run_eval.py"), "--llm", "mock", "--retriever",
          "bm25", "--out", str(out), "--check"], REPO / "backend")  # fmt: skip
    rep = json.loads(out.read_text(encoding="utf-8"))
    out.unlink()
    print(
        f"  eval: hit@5 {rep['retrieval']['hit@5']}, fact {rep['canon']['fact_accuracy']}, "
        f"unsupported {rep['canon']['unsupported_claim_rate']}, "
        f"knowledge violation {rep['character']['knowledge_violation_rate']}, "
        f"guard detection {rep['character']['guard_detection_rate']}, "
        f"canon mutation {rep['branch']['canon_mutation_rate']}"
    )
    ci = (REPO / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    assert "permissions:\n  contents: read" in ci
    for step in ("ruff check", "integrity", "pytest", "run_eval.py", "typecheck", "npm run build"):
        assert step in ci, step
    print("  ci.yml: read-only permissions, all checks present")


STAGES: dict[int, Callable[[], None]] = {1: stage1, 2: stage2, 3: stage3, 4: stage4}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", type=int, choices=sorted(STAGES))
    args = parser.parse_args()
    for number in [args.stage] if args.stage else sorted(STAGES):
        print(f"[smoke] stage {number}")
        try:
            STAGES[number]()
        except AssertionError as e:
            print(f"[smoke] stage {number} FAILED: {e!r}")
            return 1
        print(f"[smoke] stage {number} ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
