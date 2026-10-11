# 구현 계획

설계 근거는 [mvp-proposal.md](mvp-proposal.md)와 [decision-log.md](decision-log.md)에 있다. 디렉터리별 상세 설계는 아래 문서에 있다.

| 디렉터리 | 설계 문서 |
|---|---|
| `backend/` | [backend/DESIGN.md](../backend/DESIGN.md) |
| `works/` | [works/README.md](../works/README.md) |
| `frontend/` | [frontend/DESIGN.md](../frontend/DESIGN.md) |
| `evals/` | [evals/README.md](../evals/README.md) |
| `tools/` | 원문 추출(`extract_passages.py`), 스모크 테스트(`smoke.py`) |

## 작업 규칙

1. 작업을 시작하기 전에 아래 표에서 해당 항목을 **`진행중`** 으로 바꾸고, 커밋해서 push한다.
2. 구현하고, 단위 테스트(`pytest`)와 lint(`ruff`)를 통과시킨다.
3. **스모크 테스트**(`tools/smoke.py --stage N`)를 통과시킨다.
4. 문제가 없으면 항목을 **`완료`** 로 바꾸고, 커밋해서 push한다.
5. 실패하면 `진행중`으로 두고 "막힌 점"에 원인을 적는다. 거짓으로 `완료`를 찍지 않는다.

상태 값: `대기` · `진행중` · `완료` · `보류`

```bash
# 공통 검사
cd backend
uv run pytest -q
uv run ruff check . ../tools && uv run ruff format --check . ../tools
uv run python -m app.canon.integrity ../works/gatsby
uv run python ../tools/smoke.py
```

---

## 1단계 · 작품 데이터 + Canon Engine — `완료`

목표: 원작 데이터를 읽기 전용으로 불러오고, 인물별 지식 범위와 답변 규칙 검사를 코드로 보장한다.

| ID | 작업 | 산출물 | 상태 |
|---|---|---|---|
| 1-1 | 작품 데이터 스키마 | `backend/app/canon/models.py` | 완료 |
| 1-2 | 원문 추출 (PG #64317 → 48문단) | `tools/extract_passages.py`, `works/gatsby/passages.jsonl` | 완료 |
| 1-3 | 인물·사실·관계·시간선·장면 데이터 | `works/gatsby/*.yaml` | 완료 |
| 1-4 | 로더 + 무결성 검사 | `canon/store.py`, `canon/integrity.py` | 완료 |
| 1-5 | 인물별 지식 필터 | `canon/knowledge.py` | 완료 |
| 1-6 | BM25 + 한→영 용어집 검색 | `retrieval/bm25.py` | 완료 |
| 1-7 | LLM 출력 스키마 + canon-guard | `ai/schemas.py`, `canon/guard.py` | 완료 |
| 1-8 | 스모크 테스트 | `tools/smoke.py` stage 1 | 완료 |

스모크 기준: 데이터 무결성 오류 0개. 닉은 소문 문단을 검색하고 개츠비는 검색하지 못함. 근거 있는 답변은 통과하고, 조던의 비밀 누설은 차단됨.

## 2단계 · 대화 백엔드 — `완료`

목표: mock 모델로 "질문 → 근거 검색 → 생성 → 검증 → 답변"이 API로 동작한다. 시나리오 2·3·4·5·6·8·9.

| ID | 작업 | 설계 요약 | 상태 |
|---|---|---|---|
| 2-1 | LLM 어댑터 | `LLMAdapter` Protocol. `MockLLM`(규칙 기반, 검색 결과로 CANON 주장 생성), `OllamaLLM`(Qwen3-8B, JSON 스키마 출력, httpx). 환경변수 `LITVERSE_LLM=mock\|ollama` | 완료 |
| 2-2 | 프롬프트 빌더 | 인물 설정, 말투, 허용 문단(숨김 표시 포함), 모드 규칙을 조립한다. 원문은 `passage_id` 태그로 감싼다 | 완료 |
| 2-3 | 대화 파이프라인 | 의도 분류(사실/해석/잡담/분기) → 지식 필터 검색 → 생성 → canon-guard → 실패 시 1회 재생성 → 안전 답변. 사용한 근거 ID를 모두 기록 | 완료 |
| 2-4 | 세션 저장소 | SQLAlchemy + SQLite. `sessions`, `turns`, `discoveries`, `branch_events` 테이블. 원작 데이터는 DB에 넣지 않는다 | 완료 |
| 2-5 | 관계 그래프 | NetworkX `MultiDiGraph`. `revealed_at <= now`인 간선만 공개. 노드·간선·근거를 JSON으로 출력 | 완료 |
| 2-6 | 가상 분기 엔진 | 분기 = 원작 시점 스냅샷 id + 사용자 선택 이벤트. 분기 안의 답변은 `what_if` 모드. 원작 데이터 해시가 바뀌지 않았는지 검사 | 완료 |
| 2-7 | REST API | FastAPI (`/api` 접두사): `GET /works`, `GET /works/{id}`, `GET /works/{id}/scenes/{sid}`, `POST /sessions`, `POST /sessions/{id}/inspect/{object}`, `GET /sessions/{id}/graph`, `POST /sessions/{id}/dialogue`, `POST /sessions/{id}/branches`, `POST /sessions/{id}/branches/exit`, `GET /sessions/{id}/report` | 완료 |
| 2-8 | WebSocket 대화 | `WS /sessions/{id}/ws` (같은 기능의 REST는 `POST /sessions/{id}/dialogue`). 이벤트: `thinking` → `reply`(검증된 전체 답변) → `done`. 검증 전 토큰은 보내지 않는다(D-011) | 완료 |
| 2-9 | 탐험 기록 | 세션 로그에서 확인한 사실, 해석, 분기, 토론 질문을 집계 | 완료 |
| 2-10 | 스모크 테스트 | stage 2: TestClient로 세션 생성 → 조사 → 대화(WS) → 관계도 → 분기 → 기록 | 완료 |

스모크 기준: mock 모델로 11개 시나리오 중 2~6, 8~10이 API로 통과. 분기 뒤에도 원작 데이터 해시가 같음.

결과 (2026-10-11): `smoke.py --stage 2` 통과, pytest 63개 통과, uvicorn 실서버 기동과 `/api/health`·`/api/sessions` 응답 확인. Ollama 실모델 연동은 로컬에 Ollama가 없어서 MockTransport 테스트로만 확인했고, 실측은 4-5에서 한다.

## 3단계 · 프론트엔드 — `완료`

목표: 브라우저에서 시나리오 1~10을 끝까지 진행한다.

| ID | 작업 | 설계 요약 | 상태 |
|---|---|---|---|
| 3-1 | 프로젝트 세팅 | Vite + React + TS + Zustand + CSS Modules + vitest. 백엔드 프록시 설정 | 완료 |
| 3-2 | API 타입과 클라이언트 | `src/types` (백엔드 스키마와 같게), `src/services/api.ts`, `dialogueSocket.ts` | 완료 |
| 3-3 | 작품 선택 화면 | 작품 소개, 저자, 출처·라이선스 카드, 탐험 시작 | 완료 |
| 3-4 | 탐험 화면 | 2.5D 정원 (SVG/CSS 자체 도형), 오브젝트 핫스팟, 시간·장소, 원작 모드 배지 | 완료 |
| 3-5 | 대화 + 근거 패널 | 인물 초상(자체 SVG), 자유 질문, 기록, 감정, 주장별 배지(원작/해석), 근거 펼치기 | 완료 |
| 3-6 | 관계도 | SVG 그래프 (외부 라이브러리 없이 고정 배치). 간선 클릭 시 근거 | 완료 |
| 3-7 | 가상 분기 화면 | 보라색 테두리 + `AI WHAT-IF` 배지 상시 표시, 변경된 사건, 인물 반응 | 완료 |
| 3-8 | 탐험 기록 화면 | 사실 / 해석 / 분기 구분 목록, 토론 질문 | 완료 |
| 3-9 | 스모크 테스트 | stage 3: `tsc --noEmit`, `vitest run`, `vite build`, 백엔드를 띄우고 시나리오 순서대로 API 호출 | 완료 |

결과 (2026-10-11): `smoke.py --stage 3` 통과. 타입 검사, vitest 9개, 빌드 통과. uvicorn과 `vite preview`를 실제로 띄워 프록시를 거친 REST·WebSocket·분기·기록 확인. 브라우저 화면은 사람이 직접 확인해야 한다.

## 4단계 · 평가 + CI + 실모델 — `완료` (4-5 보류, 4-6 일부 보류)

목표: 시나리오 11 (평가 스크립트로 사실 일치율과 인물 일관성 측정), CI 녹색.

| ID | 작업 | 설계 요약 | 상태 |
|---|---|---|---|
| 4-1 | 평가 데이터 80개 | retrieval 30, canon 20, character 20, branch 10 (`evals/*.jsonl`) | 완료 |
| 4-2 | 평가 스크립트 | `evals/run_eval.py`: Recall@K, 근거 없는 주장 비율, 지식 범위 위반률, 미래 누설률, 원작 오염률 → JSON 리포트 | 완료 |
| 4-3 | GitHub Actions | `permissions: contents: read`. ruff, pytest, 무결성 검사, 평가(mock), tsc, vite build, 스모크 | 완료 |
| 4-4 | 임베딩 검색 (선택 의존성) | BGE-M3 + FAISS를 `Retriever`로 구현. 없으면 BM25로 대체. CI에서는 다운로드하지 않음 | 완료 |
| 4-5 | 실모델 실험 | Ollama Qwen3-8B 4bit와 mock 비교, BM25와 BGE-M3 비교 → `experiments.md` | 진행중 |
| 4-6 | 라이선스 확정 | `licenses.md`의 버전과 라이선스 verified, 저장소 LICENSE 결정 | 보류 |
| 4-7 | 스모크 테스트 | stage 4: `run_eval.py --llm mock`이 기준치 이상 | 완료 |

결과 (2026-10-11): `smoke.py` stage 1~4 전부 통과. mock + BM25 평가: hit@5 1.0, recall@5 0.922, 사실 정확도 0.9, 분류 정확도 0.95, 근거 없는 주장 0.0 (E-001에서 0.6을 개선), 지식 범위 위반 0, 미래 누설 0, 검사기 탐지율 1.0, 오탐 0, 원작 오염 0. 리포트: `evals/reports/mock-bm25.json`.

## 막힌 점

- **4-4 / 4-5 BGE-M3**: 이 PC에서 `sentence-transformers`를 import할 때 Windows 애플리케이션 제어 정책이 NumPy DLL을 차단한다. 코드와 가짜 인코더 테스트는 완료했다. 실측은 정책이 없는 환경에서 해야 한다 (E-002).
- **4-5 Qwen3**: 로컬에 Ollama가 없다. 어댑터는 준비되어 있다. 설치 여부는 사용자가 결정한다 (E-003).
- **4-6 LICENSE**: 의존성 라이선스 표는 확정했다. 이 저장소 코드의 라이선스는 팀이 정해야 한다.
- **평가 과적합**: 용어집이 평가 질문을 보고 보강되었다. 용어집을 보지 않은 사람이 만든 새 질문으로 다시 측정해야 한다 (E-000).
