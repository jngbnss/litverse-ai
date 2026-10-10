# Experiments

형식: 문제 → 기준 성능 → 원인 분석 → 개선 → 재측정 → 결과
평가 실행: `uv run --project backend python evals/run_eval.py --llm mock --retriever bm25 --out evals/reports/mock-bm25.json`

## E-000 · 2026-10-11 · BM25 + 한→영 용어집 기준선

- 문제: 질문은 한국어인데 근거 원문은 영어다.
- 기준: retrieval-cases 30개 (한국어 20, 영어 10), k=5.
- 결과: hit@5 **1.0**, recall@5 **0.922**, 다른 작품 검색률 0, 지식 범위 밖 검색률 0, 평균 0.05ms.
- 주의: 용어집(`glossary.yaml`)은 평가 질문을 본 뒤에 3개 항목(노란, 미군, 도착)을 추가했다. 평가 질문에 맞춘 **과적합 가능성이 크다**. 새 질문을 만든 사람이 용어집을 보지 않은 상태에서 다시 재야 한다 (E-003 후보).

## E-001 · 2026-10-11 · 근거 없는 질문에 원작 사실로 답함

- 문제: "개츠비가 제일 좋아하는 음식은?"처럼 원문에 없는 질문에도 mock이 CANON 주장을 만든다.
- 기준: canon-cases 20개 기준 **근거 없는 주장 비율 0.6** (5개 중 3개), 사실 정확도 0.8, 분류 정확도 0.8, 잘못된 인용률 0.111.
- 원인: BM25가 "gatsby", "party", "house"처럼 장면 전체에 흔한 단어 하나만 겹쳐도 문단을 돌려준다. 파이프라인은 검색 결과가 있으면 근거가 있다고 보고 사실 문장을 고른다.
- 개선: 작품별 `low_information` 단어 목록을 두고, 그 단어만 겹친 문단은 검색 결과에서 뺀다 (`bm25.py`).
- 재측정: 근거 없는 주장 비율 **0.0**, 사실 정확도 **0.9**, 분류 정확도 **0.95**, 잘못된 인용률 **0.0**. 검색 hit@5 1.0 유지.
- 결과: 채택. 남은 오류는 c10 하나다. 조던에게 "서재에서 들은 이야기"를 물으면 근거 없음으로 답하는데, 숨긴 정보를 지키는 쪽이라 위험한 오류는 아니다.
- 한계: mock은 팀이 쓴 사실 문장을 그대로 돌려주므로, 이 수치는 **파이프라인과 검사기의 정확도**이지 생성 모델의 품질이 아니다.

## E-002 · 2026-10-11 · BGE-M3 임베딩 비교 — 보류

- 문제: BM25 + 용어집은 과적합 위험이 있다. 다국어 임베딩(BGE-M3)으로 용어집 없이 비교하려 했다.
- 진행: `EmbeddingRetriever`(FAISS 내적), `HybridRetriever`(RRF)를 구현했고, 가짜 인코더 테스트는 통과했다.
- 막힘: 이 개발 PC에서 `sentence-transformers`를 import할 때 NumPy DLL(`numpy.random._common`)을 Windows 애플리케이션 제어 정책이 차단했다. 보안 정책은 우회하지 않았다.
- 다음: 정책이 없는 환경(다른 PC, WSL, CI 수동 job)에서 `uv sync --extra embeddings` 후
  `run_eval.py --retriever embedding`과 `--retriever hybrid`를 돌려 E-000과 비교한다.

## E-003 · 예정 · 실모델(Qwen3-8B) 대화 품질

- 준비: `OllamaLLM` 어댑터가 JSON 스키마 출력, `think: false`로 구현되어 있고 MockTransport 테스트를 통과한다.
- 막힘: 로컬에 Ollama가 설치되어 있지 않다 (시스템 설치는 사용자가 결정할 일).
- 실행: `ollama pull qwen3:8b` 후 `LITVERSE_LLM=ollama uv run --project backend python evals/run_eval.py --llm ollama`.
  mock 대비 재생성률, 안전 답변 대체율, 근거 없는 주장 비율, 숨긴 정보 누설률을 비교한다.
