import hashlib

import pytest

np = pytest.importorskip("numpy")
pytest.importorskip("faiss")

from app.retrieval.bm25 import BM25Retriever, tokenize_en  # noqa: E402
from app.retrieval.embedding import EmbeddingRetriever, HybridRetriever  # noqa: E402


class HashEncoder:
    """모델 없이 쓰는 가짜 인코더: 단어 해시 bag-of-words."""

    name = "hash"

    def encode(self, texts):
        out = np.zeros((len(texts), 256), dtype="float32")
        for i, t in enumerate(texts):
            for tok in tokenize_en(t):
                out[i, int(hashlib.md5(tok.encode()).hexdigest(), 16) % 256] += 1
        norms = np.linalg.norm(out, axis=1, keepdims=True)
        return out / np.maximum(norms, 1e-9)


@pytest.fixture(scope="module")
def emb(work):
    return EmbeddingRetriever(work, HashEncoder())


def test_embedding_respects_knowledge(emb, view):
    hits = emb.search("killed a man rumour", view("gatsby"), k=10)
    assert "gatsby-ch03-p030" not in {h.passage_id for h in hits}
    hits = emb.search("killed a man", view("nick"), k=3)
    assert "gatsby-ch03-p030" in {h.passage_id for h in hits}


def test_embedding_flags_hidden(emb, view):
    hits = emb.search("Daisy across the bay house", view("gatsby"), k=5)
    assert any(h.hidden for h in hits)


def test_hybrid_fuses(work, emb, view):
    hybrid = HybridRetriever(BM25Retriever(work), emb)
    hits = hybrid.search("서재의 책은 진짜야?", view("nick"), k=5)
    assert {h.passage_id for h in hits} & {"gatsby-ch03-p045", "gatsby-ch03-p048"}
