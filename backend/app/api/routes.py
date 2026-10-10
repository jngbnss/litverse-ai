"""REST + WebSocket 엔드포인트."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, ValidationError

from app.branching.engine import BranchError
from app.canon.store import WORKS_DIR
from app.core.db import SessionRow
from app.dialogue.pipeline import DialogueError
from app.services.litverse import LitverseService, NotFound

router = APIRouter()


class CreateSession(BaseModel):
    work_id: str
    scene_id: str


class Ask(BaseModel):
    character_id: str
    question: str = Field(min_length=1, max_length=500)


class CreateBranch(BaseModel):
    option_id: str


def svc(request: Request) -> LitverseService:
    return request.app.state.service


def _call(fn, *args):
    try:
        return fn(*args)
    except NotFound as e:
        raise HTTPException(404, str(e)) from e
    except (DialogueError, BranchError) as e:
        raise HTTPException(400, str(e)) from e


def session_json(s: SessionRow) -> dict[str, Any]:
    return {"session_id": s.id, "work_id": s.work_id, "scene_id": s.scene_id, "now": s.now,
            "mode": s.mode, "branch_id": s.branch_id}  # fmt: skip


@router.get("/health")
def health(request: Request) -> dict[str, str]:
    return {"status": "ok", "llm": svc(request).llm.name}


@router.get("/works")
def list_works(request: Request) -> list[dict[str, Any]]:
    out = []
    for d in sorted(p for p in WORKS_DIR.iterdir() if (p / "metadata.yaml").exists()):
        m = svc(request).work(d.name).metadata
        out.append({"work_id": m.work_id, "title": m.title, "title_ko": m.title_ko,
                    "author": m.author, "published": m.published})  # fmt: skip
    return out


@router.get("/works/{work_id}")
def get_work(request: Request, work_id: str) -> dict[str, Any]:
    work = _call(svc(request).work, work_id)
    return {
        **work.metadata.model_dump(),
        "scenes": [{"scene_id": s.scene_id, "title_ko": s.title_ko, "chapter": s.chapter}
                   for s in work.scenes.values()],
    }  # fmt: skip


@router.get("/works/{work_id}/scenes/{scene_id}")
def get_scene(request: Request, work_id: str, scene_id: str) -> dict[str, Any]:
    work = _call(svc(request).work, work_id)
    scene = work.scenes.get(scene_id)
    if scene is None:
        raise HTTPException(404, f"scene '{scene_id}'")
    characters = [
        {k: getattr(work.characters[c], k) for k in
         ("character_id", "display_name", "display_name_ko", "role_ko", "default_emotion")}
        for c in scene.characters
    ]  # fmt: skip
    return {
        "scene_id": scene.scene_id,
        "title_ko": scene.title_ko,
        "chapter": scene.chapter,
        "location": scene.location,
        "now": scene.now,
        "now_label_ko": work.timeline[scene.now].label_ko,
        "characters": characters,
        "objects": [o.model_dump(exclude={"passage_ids"}) for o in scene.objects],
        "dialogue_goals": [g.model_dump() for g in scene.dialogue_goals],
        "branches": [b.model_dump(exclude={"relation_changes"}) for b in scene.branches],
    }


@router.post("/sessions", status_code=201)
def create_session(request: Request, body: CreateSession) -> dict[str, Any]:
    return session_json(_call(svc(request).create_session, body.work_id, body.scene_id))


@router.get("/sessions/{session_id}")
def get_session(request: Request, session_id: str) -> dict[str, Any]:
    return session_json(_call(svc(request).get_session, session_id))


@router.post("/sessions/{session_id}/inspect/{object_id}")
def inspect(request: Request, session_id: str, object_id: str) -> dict[str, Any]:
    return _call(svc(request).inspect, session_id, object_id)


@router.post("/sessions/{session_id}/dialogue")
def ask(request: Request, session_id: str, body: Ask) -> dict[str, Any]:
    return _call(svc(request).dialogue, session_id, body.character_id, body.question)


@router.get("/sessions/{session_id}/graph")
def graph(request: Request, session_id: str) -> dict[str, Any]:
    return _call(svc(request).graph, session_id)


@router.post("/sessions/{session_id}/branches", status_code=201)
def branch(request: Request, session_id: str, body: CreateBranch) -> dict[str, Any]:
    return _call(svc(request).branch, session_id, body.option_id)


@router.post("/sessions/{session_id}/branches/exit")
def exit_branch(request: Request, session_id: str) -> dict[str, Any]:
    return session_json(_call(svc(request).exit_branch, session_id))


@router.get("/sessions/{session_id}/report")
def report(request: Request, session_id: str) -> dict[str, Any]:
    return _call(svc(request).report, session_id)


@router.websocket("/sessions/{session_id}/ws")
async def dialogue_ws(ws: WebSocket, session_id: str) -> None:
    """이벤트: thinking → reply(검증을 마친 전체 답변) → done. 검증 전 토큰은 보내지 않는다."""
    service: LitverseService = ws.app.state.service
    await ws.accept()
    try:
        await run_in_threadpool(service.get_session, session_id)
    except NotFound:
        await ws.send_json({"type": "error", "detail": f"session '{session_id}' not found"})
        await ws.close(code=4404)
        return
    try:
        while True:
            raw = await ws.receive_json()
            try:
                body = Ask.model_validate(raw)
            except ValidationError as e:
                await ws.send_json({"type": "error", "detail": e.errors()[0]["msg"]})
                continue
            await ws.send_json({"type": "thinking", "character_id": body.character_id})
            try:
                out = await run_in_threadpool(
                    service.dialogue, session_id, body.character_id, body.question
                )
            except (NotFound, DialogueError) as e:
                await ws.send_json({"type": "error", "detail": str(e)})
                continue
            await ws.send_json({"type": "reply", **out})
            await ws.send_json({"type": "done"})
    except WebSocketDisconnect:
        return
