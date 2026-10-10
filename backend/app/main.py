"""FastAPI 앱. 실행: uv run uvicorn --factory app.main:create_app --reload"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ai.adapters import LLMAdapter, make_llm
from app.api.routes import router
from app.canon.store import get_work
from app.core.config import Settings
from app.core.db import make_sessionmaker
from app.services.litverse import LitverseService


def create_app(settings: Settings | None = None, llm: LLMAdapter | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    app = FastAPI(title="LitVerse AI", version="0.2.0")
    app.state.service = LitverseService(
        settings=settings,
        db_factory=make_sessionmaker(settings.database_url),
        llm=llm or make_llm(settings.llm, settings.ollama_url, settings.ollama_model,
                            settings.ollama_timeout),
        work_loader=get_work,
    )  # fmt: skip
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router, prefix="/api")
    return app
