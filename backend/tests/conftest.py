import pytest

from app.canon.knowledge import KnowledgeView, build_view
from app.canon.store import Work, get_work
from app.retrieval.bm25 import BM25Retriever

SCENE_NOW = "t03-party-end"


@pytest.fixture(scope="session")
def work() -> Work:
    return get_work("gatsby")


@pytest.fixture(scope="session")
def retriever(work: Work) -> BM25Retriever:
    return BM25Retriever(work)


@pytest.fixture
def view(work: Work):
    def make(character_id: str, at: str = SCENE_NOW) -> KnowledgeView:
        return build_view(work, character_id, at)

    return make
