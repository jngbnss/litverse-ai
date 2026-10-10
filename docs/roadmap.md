# 4단계 구현 로드맵

각 단계는 프롬프트 하나로 진행한다. 단계가 끝날 때마다 `pytest`와 `ruff`가 통과해야 하고, decision-log와 experiments에 기록을 남긴다.

| 단계 | 결과물 | 완료 조건 (README 21번 시나리오 기준) |
|---|---|---|
| 1 | 작품 데이터 + Canon Engine + 검색 + 검사기 | 데이터 무결성, 지식 범위, 누설 탐지 테스트 통과 |
| 2 | 대화 파이프라인 + LLM 어댑터 + FastAPI/WebSocket + 분기 백엔드 | mock 모델로 질문 → 근거 답변 → 검증이 API로 동작 (시나리오 4·5·8·9) |
| 3 | 프론트엔드 6개 화면 | 브라우저에서 시나리오 1~10 진행 |
| 4 | 평가 스크립트 + CI + 실모델 실험 | 시나리오 11, GitHub Actions 녹색, experiments.md 기준 성능 |

---

## 1단계 프롬프트 (완료)

> docs/mvp-proposal.md 권장안으로 1단계를 구현해. backend/(Python 3.12, uv)에 Pydantic 데이터 모델, works/gatsby 로더와 무결성 검사, 인물별 지식 필터, BM25 검색(메타데이터 필터 포함), LLM 응답 스키마, 규칙 기반 canon-guard 검사기를 만들고 pytest로 지식 누설 함정 케이스를 검증해. 원문은 Project Gutenberg #64317에서 3장 파티 장면과 4장 일부를 문단 단위로 추출해.

## 2단계 프롬프트

> 2단계를 구현해. backend에 (1) LLMAdapter 인터페이스와 MockLLM·OllamaLLM(Qwen3-8B, JSON 스키마 출력) 어댑터, (2) 질문 → 의도 분석 → 지식 필터 검색 → 생성 → canon-guard 검증 → 재생성 1회 → 안전 답변 파이프라인, (3) FastAPI REST + WebSocket 엔드포인트(works, scenes, sessions, dialogue, objects, graph, branches, report), (4) SQLAlchemy+SQLite 세션·대화 로그·분기 이벤트 저장(원작 데이터와 분리), (5) NetworkX 관계 그래프의 시점별 공개 노드 계산을 추가하고, 각각 mock 기반 pytest를 작성해. 임베딩(BGE-M3+FAISS)은 선택 의존성으로 두고 없으면 BM25로 대체해.

## 3단계 프롬프트

> 3단계를 구현해. frontend/에 React+TypeScript+Vite+Zustand+CSS Modules로 화면 6개(작품 선택, 2.5D 탐험 공간과 오브젝트 핫스팟, 인물 대화와 근거 패널, 관계도, AI WHAT-IF 분기, 탐험 기록)를 만들어. 백엔드 API 타입을 frontend/src/types에 맞추고, 원작/해석/WHAT-IF 배지와 분기 화면의 보라색 테두리를 구현해. 배경과 초상화는 저작권 문제가 없도록 CSS·SVG 자체 도형으로만 그려. vitest로 주요 컴포넌트를 테스트하고 `npm run build`와 타입 검사가 통과해야 해.

## 4단계 프롬프트

> 4단계를 구현해. evals/의 retrieval·canon·character·branch 케이스를 80개까지 채우고, evals/run_eval.py로 Recall@K, 근거 없는 주장 비율, 지식 범위 위반률, 미래 사건 누설률, 원작 데이터 오염률을 측정해 JSON 리포트를 출력해. .github/workflows/ci.yml(permissions: contents: read)에서 ruff, pytest, 작품 데이터 검사, 평가(mock), 프론트 타입 검사와 빌드를 돌려. Ollama가 있으면 로컬에서 BM25와 BGE-M3, mock과 Qwen3를 비교해 experiments.md에 "문제 → 기준 → 원인 → 개선 → 재측정 → 결과" 형식으로 기록해.
