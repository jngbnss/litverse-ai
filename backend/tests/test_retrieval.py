import pytest

from app.canon.knowledge import KnowledgeView
from app.retrieval.bm25 import BM25Retriever

P = "gatsby-ch03-p{:03d}".format


def top(retriever: BM25Retriever, query: str, view: KnowledgeView, k: int = 5) -> list[str]:
    return [h.passage_id for h in retriever.search(query, view, k=k)]


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("개츠비가 사람을 죽였다는 소문이 있어?", {P(30), P(35)}),
        ("독일 스파이라는 말은 뭐야?", {P(32)}),
        ("서재의 책은 진짜야?", {P(45), P(48), P(50)}),
        ("오렌지 상자는 뭐에 쓰는 거야?", {P(2)}),
        ("개츠비는 옥스퍼드 출신이야?", {P(83)}),
        ("who sent the invitation note?", {P(8)}),
    ],
)
def test_nick_finds_gold_passage(retriever, view, query, expected):
    assert expected & set(top(retriever, query, view("nick"), k=3))


def test_gatsby_cannot_retrieve_rumors(retriever, view):
    hits = top(retriever, "사람을 죽였다는 소문", view("gatsby"), k=10)
    assert P(30) not in hits
    assert P(35) not in hits


def test_hidden_passages_are_flagged(retriever, view):
    hits = retriever.search("데이지 저택", view("gatsby"), k=10)
    hidden = {h.passage_id for h in hits if h.hidden}
    assert "gatsby-ch04-p157" in hidden


def test_nick_cannot_retrieve_future(retriever, view):
    hits = top(retriever, "데이지 저택 만 건너", view("nick"), k=20)
    assert not any(h.startswith("gatsby-ch04") for h in hits)


def test_topic_filter(retriever, view):
    hits = retriever.search("개츠비 소문", view("nick"), k=20, topics=frozenset({"rumor"}))
    assert hits
    assert all("rumor" in retriever.work.passages[h.passage_id].topics for h in hits)


def test_view_from_other_work_is_rejected(retriever, view):
    v = view("nick")
    foreign = KnowledgeView("other", "nick", v.at, v.visible, v.hidden)
    with pytest.raises(ValueError):
        retriever.search("개츠비", foreign)
