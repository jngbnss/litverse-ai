"""임베딩 검색기 (선택 의존성: `uv sync --extra embeddings`).

BGE-M3 같은 다국어 임베딩으로 한국어 질문과 영어 원문을 바로 비교한다.
FAISS 내적 인덱스를 작품 하나에 하나씩 만들고, 검색 결과는 인물 지식 범위로 거른다.
CI는 모델을 다운로드하지 않는다. 테스트는 가짜 인코더로 돌린다.
"""

from typing import Protocol

import numpy as np

from app.canon.knowledge import KnowledgeView
from app.canon.store import Work
from app.retrieval.bm25 import Hit


class Encoder(Protocol):
    name: str

    def encode(self, texts: list[str]) -> np.ndarray:
        """L2 정규화된 (n, d) float32 행렬을 돌려준다."""
        ...


class SentenceTransformerEncoder:
    def __init__(self, model_name: str = "BAAI/bge-m3", device: str | None = None) -> None:
        from sentence_transformers import SentenceTransformer

        self.name = model_name
        self.model = SentenceTransformer(model_name, device=device)

    def encode(self, texts: list[str]) -> np.ndarray:
        vecs = self.model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
        return np.asarray(vecs, dtype="float32")


class EmbeddingRetriever:
    def __init__(self, work: Work, encoder: Encoder) -> None:
        import faiss

        self.work = work
        self.encoder = encoder
        self._ids = list(work.passages)
        vecs = encoder.encode([work.passages[p].text for p in self._ids])
        self._index = faiss.IndexFlatIP(vecs.shape[1])
        self._index.add(vecs)

    def search(
        self, query: str, view: KnowledgeView, k: int = 5, topics: frozenset[str] | None = None
    ) -> list[Hit]:
        if view.work_id != self.work.work_id:
            raise ValueError("knowledge view belongs to a different work")
        q = self.encoder.encode([query])
        # 문단 수가 적으므로 전체 점수를 받은 뒤 지식 범위로 거른다
        scores, idx = self._index.search(q, len(self._ids))
        hits = []
        for score, i in zip(scores[0], idx[0], strict=True):
            pid = self._ids[i]
            if not view.can_see(pid):
                continue
            if topics and not topics & set(self.work.passages[pid].topics):
                continue
            hits.append(Hit(pid, float(score), view.is_hidden(pid)))
            if len(hits) == k:
                break
        return hits


class HybridRetriever:
    """BM25와 임베딩 순위를 RRF(reciprocal rank fusion)로 합친다."""

    def __init__(self, *retrievers, k_rrf: int = 60) -> None:
        self.retrievers = retrievers
        self.k_rrf = k_rrf
        self.work = retrievers[0].work

    def search(
        self, query: str, view: KnowledgeView, k: int = 5, topics: frozenset[str] | None = None
    ) -> list[Hit]:
        fused: dict[str, float] = {}
        hidden: dict[str, bool] = {}
        for r in self.retrievers:
            for rank, h in enumerate(r.search(query, view, k=k * 4, topics=topics)):
                fused[h.passage_id] = fused.get(h.passage_id, 0.0) + 1 / (self.k_rrf + rank + 1)
                hidden[h.passage_id] = h.hidden
        ranked = sorted(fused.items(), key=lambda x: (-x[1], x[0]))[:k]
        return [Hit(pid, score, hidden[pid]) for pid, score in ranked]
