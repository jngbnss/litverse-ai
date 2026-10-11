"""환경 설정. 값은 환경변수로 덮어쓴다 (.env.example 참고)."""

import os
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class Settings:
    llm: Literal["mock", "ollama"] = "mock"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:8b"
    ollama_timeout: float = 120.0
    database_url: str = "sqlite:///./litverse.db"
    retrieval_k: int = 5
    max_attempts: int = 2
    excerpt_chars: int = 240

    @classmethod
    def from_env(cls) -> "Settings":
        llm = os.environ.get("LITVERSE_LLM", cls.llm)
        if llm not in ("mock", "ollama"):
            raise ValueError(f"LITVERSE_LLM must be mock or ollama, got {llm!r}")
        return cls(
            llm=llm,  # type: ignore[arg-type]
            ollama_url=os.environ.get("OLLAMA_URL", cls.ollama_url),
            ollama_model=os.environ.get("OLLAMA_MODEL", cls.ollama_model),
            ollama_timeout=float(os.environ.get("OLLAMA_TIMEOUT", cls.ollama_timeout)),
            database_url=os.environ.get("LITVERSE_DATABASE_URL", cls.database_url),
        )
