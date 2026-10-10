"""스모크 테스트. 단계를 완료로 표시하기 전에 반드시 통과해야 한다.

사용법:
    uv run --project backend python tools/smoke.py            # 지금까지 완료된 모든 단계
    uv run --project backend python tools/smoke.py --stage 1  # 특정 단계만

단위 테스트(pytest)와 달리, 실제 works/ 데이터로 사용자 시나리오 한 줄기를 끝까지 따라간다.
"""

import argparse
import sys
from collections.abc import Callable

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


STAGES: dict[int, Callable[[], None]] = {1: stage1}


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
