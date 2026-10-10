# evals 설계 (4단계에서 구현)

모델을 연결한 것만으로 완료 처리하지 않는다. 아래 지표를 측정하고 [docs/experiments.md](../docs/experiments.md)에 기록한다.

## 데이터 파일

| 파일 | 개수 | 한 줄의 형식 |
|---|---|---|
| `retrieval-cases.jsonl` | 30 (한국어 20, 영어 10) | `{case_id, character_id, at, question, gold_passage_ids}` |
| `canon-cases.jsonl` | 20 (사실 10, 해석 유도 5, 근거 없음 5) | `{case_id, character_id, question, expected: canon\|interpretation\|no_evidence, gold_passage_ids}` |
| `character-cases.jsonl` | 20 (함정 질문) | `{case_id, character_id, question, must_not: [fact_id\|spoiler_id], expect_refusal}` |
| `branch-cases.jsonl` | 10 | `{case_id, branch_id, user_choice, checks: [no_canon_mutation, internal_consistency]}` |

작성 규칙: 질문 작성자와 문단 태거를 분리한다. 두 명이 교차 검수한다.

## 지표

| 영역 | 지표 |
|---|---|
| 검색 | Recall@5, 잘못된 작품 검색률, 잘못된 인물 문단 검색률, 검색 지연 |
| 원작 사실 | 근거 없는 주장 비율, 잘못된 인용률, 사실·해석 구분 정확도, 미래 누설률 |
| 인물 | 지식 범위 위반률, 숨긴 정보 누설률, 시간선 위반률 |
| 분기 | 원작 데이터 오염률(해시 비교), 분기 내부 모순율 |

## 실행 (예정)

```bash
uv run --project backend python evals/run_eval.py --llm mock --retriever bm25 --out evals/reports/
```

CI는 mock으로만 돌린다. 실모델(Qwen3) 결과는 로컬에서 만들고 리포트 JSON만 커밋한다.
