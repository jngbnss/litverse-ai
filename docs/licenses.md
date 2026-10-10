# Licenses

도입할 때 라이선스와 버전을 **원문에서 다시 확인**하고 상태를 `verified`로 바꾼다. 아래 표는 초안 예상값이다.

| 구성요소 | 용도 | 예상 라이선스 | 버전 | 상태 |
|---|---|---|---|---|
| Qwen3-8B | 대화 생성 | Apache-2.0 | - | pending |
| Ollama | 로컬 모델 실행 | MIT | - | pending |
| llama.cpp | 실행 방식 비교 | MIT | - | pending |
| BGE-M3 | 다국어 임베딩 | MIT | - | pending |
| sentence-transformers | 임베딩 로더 | Apache-2.0 | - | pending |
| FAISS | 벡터 검색 | MIT | - | pending |
| Qdrant | 비교 실험 | Apache-2.0 | - | pending |
| LangGraph | (후순위) 파이프라인 | MIT | - | pending |
| spaCy | 인물·장소 추출 | MIT | - | pending |
| NetworkX | 관계 그래프 | BSD-3-Clause | 3.7 | pending |
| FastAPI | API 서버 | MIT | 0.143.0 | pending |
| Pydantic | 스키마 검증 | MIT | 2.14.0 | pending |
| SQLAlchemy | 세션 DB | MIT | 2.1.4 | pending |
| uvicorn | ASGI 서버 | BSD-3-Clause | 0.54.0 | pending |
| httpx | Ollama 호출, 테스트 | BSD-3-Clause | 0.28.1 | pending |
| PyYAML | 작품 데이터 로드 | MIT | 6.0.3 | pending |
| React / Vite / Zustand | 프론트엔드 | MIT | - | pending |
| Kokoro-82M (선택) | TTS | Apache-2.0 | - | pending |

모델 가중치는 저장소에 넣지 않는다.
