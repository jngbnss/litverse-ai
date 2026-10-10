# Licenses

라이선스는 설치된 패키지의 메타데이터(`License-Expression`, npm `license` 필드)로 확인했다 (2026-10-11).
상태 값: `verified`는 메타데이터 확인 완료, `pending`은 아직 도입하지 않아 미확인.

## 사용 중

| 구성요소 | 용도 | 라이선스 | 버전 | 상태 |
|---|---|---|---|---|
| FastAPI | API 서버 | MIT | 0.143.0 | verified |
| Pydantic | 스키마 검증 | MIT | 2.14.0 | verified |
| SQLAlchemy | 세션 DB | MIT | 2.1.4 | verified |
| uvicorn | ASGI 서버 | BSD-3-Clause | 0.54.0 | verified |
| httpx | Ollama 호출, 테스트 | BSD-3-Clause | 0.28.1 | verified |
| PyYAML | 작품 데이터 로드 | MIT | 6.0.3 | verified |
| NetworkX | 관계 그래프 | BSD-3-Clause | 3.7 | verified |
| React / React DOM | 프론트엔드 | MIT | 19.3.0 | verified |
| Zustand | 상태 관리 | MIT | 5.0.15 | verified |
| Vite | 번들러 | MIT | 8.3.4 | verified |
| TypeScript | 타입 검사 | Apache-2.0 | 7.0.2 | verified |
| Vitest | 테스트 | MIT | 5.0.3 | verified |

## 선택 의존성 (`uv sync --extra embeddings`)

| 구성요소 | 용도 | 라이선스 | 버전 | 상태 |
|---|---|---|---|---|
| faiss-cpu | 벡터 검색 | MIT | 1.15.1 | verified |
| sentence-transformers | 임베딩 로더 | Apache-2.0 | 6.1.0 | verified |
| PyTorch | 임베딩 실행 | Apache-2.0 계열 (메타데이터 기준) | 2.14.1 | verified |
| NumPy | 수치 연산 | BSD-3-Clause 외 (번들 라이브러리 포함) | 2.5.4 | verified |
| BGE-M3 (모델) | 다국어 임베딩 | MIT (모델 카드 기준, 다운로드 전 재확인) | - | pending — 로컬 로드 실패 (E-002) |

## 미도입 (도입할 때 확인)

| 구성요소 | 용도 | 예상 라이선스 | 상태 |
|---|---|---|---|
| Qwen3-8B | 대화 생성 (OllamaLLM 어댑터 준비됨) | Apache-2.0 | pending |
| Ollama | 로컬 모델 실행 | MIT | pending |
| llama.cpp | 실행 방식 비교 | MIT | pending |
| Qdrant | 비교 실험 | Apache-2.0 | pending |
| LangGraph | (후순위) 파이프라인 | MIT | pending |
| spaCy | 인물·장소 추출 | MIT | pending |
| Kokoro-82M | TTS (선택) | Apache-2.0 | pending |

모델 가중치는 저장소에 넣지 않는다.

## 이 저장소의 라이선스

**미정.** 코드 라이선스(MIT, Apache-2.0 등)는 팀이 정해야 한다. 원작 텍스트(`works/gatsby/passages.jsonl`)는 퍼블릭 도메인이고, 팀이 쓴 요약·해석·데이터 태그는 코드와 다른 라이선스(예: CC BY 4.0)를 줄 수도 있다.
