# LitVerse AI

문학 작품 속 장면에 들어가 등장인물과 대화하는 AI 문학 탐험 서비스.
등장인물은 원문 근거로 답하고, 모든 답변을 **원작 사실 / 해석 / AI WHAT-IF**로 구분해 보여 준다.

## 현재 상태

4단계 계획 중 1~4단계 구현 완료. 실모델은 Qwen3-4B로 측정했고(docs/experiments.md E-003), Qwen3-8B와 BGE-M3 실측은 보류 중이다. 작업별 진행 상황과 막힌 점은 [docs/implementation-plan.md](docs/implementation-plan.md)에 있다.

| 단계 | 내용 |
|---|---|
| 1 | 작품 데이터, Canon Engine(지식 범위), BM25 검색, canon-guard |
| 2 | 대화 파이프라인, LLM 어댑터(mock/Ollama), FastAPI·WebSocket, 관계 그래프, 가상 분기, 탐험 기록 |
| 3 | 프론트엔드 6개 화면 (React + Vite) |
| 4 | 평가 80케이스 + 측정 스크립트, GitHub Actions CI, 임베딩 검색(선택) |

## 로컬에서 실행

```bash
# 터미널 1: 백엔드 (기본 mock 모델) → http://127.0.0.1:8010/docs
cd backend
uv sync
uv run uvicorn --factory app.main:create_app --port 8010

# 터미널 2: 프론트엔드 → http://localhost:5173
cd frontend
npm install
npm run dev
```

실모델을 쓰려면 Ollama에서 `ollama pull qwen3:8b`를 받은 뒤 백엔드를 `LITVERSE_LLM=ollama`로 띄운다. 설정은 [.env.example](.env.example)에 있다.

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
frontend/src/          React 화면 6개, API 클라이언트, Zustand 상태
evals/                 평가 데이터 80개, run_eval.py, 리포트
works/gatsby/          원작 데이터 (passage-tags.yaml → passages.jsonl)
tools/                 원문 추출, 스모크 테스트
docs/                  제안서, 결정 기록, 저작권, 라이선스, 실험
```

## 검사

```bash
cd backend
uv run pytest
uv run ruff check . ../tools ../evals
uv run python -m app.canon.integrity ../works/gatsby
uv run python ../evals/run_eval.py --llm mock --retriever bm25 --check
uv run python ../tools/smoke.py          # 단계별 스모크 (stage 3은 npm 필요)
cd ../frontend && npm test && npm run build
```

설계: [backend/DESIGN.md](backend/DESIGN.md) · [frontend/DESIGN.md](frontend/DESIGN.md) · [works/README.md](works/README.md) · [evals/README.md](evals/README.md)

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
