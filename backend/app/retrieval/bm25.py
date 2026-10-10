"""BM25 기준선 검색기.

한국어 질의는 작품별 glossary로 영어 검색어를 확장한 뒤 영어 원문에 매칭한다.
임베딩 검색(BGE-M3)은 같은 Retriever 인터페이스로 2단계에서 추가한다.
"""

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import Protocol

from app.canon.knowledge import KnowledgeView
from app.canon.store import Work

STOPWORDS = frozenset(
    "a an and are as at be but by did do for from had has have he her his i in is it its me my "
    "no not of on or our she so that the their them then there they this to was we were what "
    "when which who why will with you your".split()
)
_EN = re.compile(r"[a-z0-9éè]+")


def tokenize_en(text: str) -> list[str]:
    text = text.lower().replace("’", "'")
    return [t for t in _EN.findall(text) if t not in STOPWORDS and len(t) > 1]


@dataclass(frozen=True)
class Hit:
    passage_id: str
    score: float
    hidden: bool


class Retriever(Protocol):
    def search(
        self, query: str, view: KnowledgeView, k: int = 5, topics: frozenset[str] | None = None
    ) -> list[Hit]: ...


class BM25Retriever:
    def __init__(self, work: Work, k1: float = 1.5, b: float = 0.75) -> None:
        self.work = work
        self.k1 = k1
        self.b = b
        self._docs = {pid: Counter(tokenize_en(p.text)) for pid, p in work.passages.items()}
        self._len = {pid: sum(c.values()) for pid, c in self._docs.items()}
        self._avg = sum(self._len.values()) / max(len(self._len), 1)
        df: Counter[str] = Counter()
        for counts in self._docs.values():
            df.update(counts.keys())
        n = len(self._docs)
        self._idf = {t: math.log(1 + (n - d + 0.5) / (d + 0.5)) for t, d in df.items()}

    def expand(self, query: str) -> list[str]:
        terms = tokenize_en(query)
        for entry in self.work.glossary:
            if entry.ko in query:
                terms.extend(entry.en)
        return terms

    def _score(self, pid: str, terms: list[str]) -> float:
        counts = self._docs[pid]
        norm = self.k1 * (1 - self.b + self.b * self._len[pid] / self._avg)
        score = 0.0
        for t in set(terms):
            tf = counts.get(t, 0)
            if tf:
                score += self._idf[t] * tf * (self.k1 + 1) / (tf + norm)
        return score

    def search(
        self, query: str, view: KnowledgeView, k: int = 5, topics: frozenset[str] | None = None
    ) -> list[Hit]:
        if view.work_id != self.work.work_id:
            raise ValueError("knowledge view belongs to a different work")
        terms = self.expand(query)
        # 장면 어디에나 나오는 단어만 겹친 문단은 근거가 아니다 (E-001)
        informative = set(terms) - self.work.low_information
        hits = []
        for pid in view.visible:
            if topics and not topics & set(self.work.passages[pid].topics):
                continue
            if not informative & self._docs[pid].keys():
                continue
            score = self._score(pid, terms)
            if score > 0:
                hits.append(Hit(pid, score, view.is_hidden(pid)))
        hits.sort(key=lambda h: (-h.score, h.passage_id))
        return hits[:k]
