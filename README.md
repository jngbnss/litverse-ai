# LitVerse AI

문학 작품 속 장면에 들어가 등장인물과 대화하는 AI 문학 탐험 서비스.
등장인물은 원문 근거로 답하고, 모든 답변을 **원작 사실 / 해석 / AI WHAT-IF**로 구분해 보여 준다.

## 현재 상태

4단계 중 **2단계 완료**: 작품 데이터, Canon Engine, BM25 검색, canon-guard 검사기(1단계) + 대화 파이프라인, LLM 어댑터(mock/Ollama), FastAPI·WebSocket, 관계 그래프, 가상 분기, 탐험 기록(2단계). 작업별 진행 상황은 [docs/implementation-plan.md](docs/implementation-plan.md)에 있다.

## MVP

*The Great Gatsby* (1925, 영어 원문) 3장, 첫 파티 장면.
등장인물: 닉, 개츠비, 조던 베이커. 원문은 3장 44문단과, 인물이 숨기는 지식으로 쓰는 4장 4문단이다.

## 구조

```
backend/app/
  canon/               원작 데이터 스키마·로더·무결성·지식 범위·canon-guard
  retrieval/           BM25 + 한→영 용어집 검색
  ai/                  LLM 출력 스키마, 어댑터 (mock / ollama)
  characters/          인물 프롬프트
  dialogue/            대화 파이프라인 (검색 → 생성 → 검증 → 재생성)
  relationships/       NetworkX 관계 그래프
  branching/           가상 분기
  services/ api/       유스케이스, REST·WebSocket
works/gatsby/          원작 데이터 (passage-tags.yaml → passages.jsonl)
tools/                 원문 추출, 스모크 테스트
docs/                  제안서, 결정 기록, 저작권, 라이선스, 실험
```

## 실행

```bash
cd backend
uv sync
uv run pytest
uv run ruff check . ../tools
uv run python -m app.canon.integrity ../works/gatsby
uv run python ../tools/smoke.py   # 단계별 스모크 테스트

# API 서버 (기본 mock 모델, http://127.0.0.1:8000/docs)
uv run uvicorn --factory app.main:create_app --reload
# 실모델: Ollama에서 `ollama pull qwen3:8b` 후
LITVERSE_LLM=ollama uv run uvicorn --factory app.main:create_app
```

설정은 [.env.example](.env.example) 참고. 설계는 [backend/DESIGN.md](backend/DESIGN.md).

원문을 다시 추출하려면 (PG 원문 파일은 커밋하지 않는다):

```bash
curl -L -o pg64317.txt https://www.gutenberg.org/cache/epub/64317/pg64317.txt
uv run --project backend python tools/extract_passages.py pg64317.txt works/gatsby
```

## 원칙

- 원작 데이터(`works/`)는 읽기 전용이다. 가상 분기는 따로 저장한다.
- 인물별 지식 범위는 검색 단계에서 거른다.
- 저작권 상태가 불명확한 자료는 저장소에 넣지 않는다.

## 문서

[구현 계획](docs/implementation-plan.md) · [MVP 제안](docs/mvp-proposal.md) · [로드맵](docs/roadmap.md) · [결정 기록](docs/decision-log.md) · [저작권](docs/copyright-review.md) · [라이선스](docs/licenses.md) · [실험](docs/experiments.md)
