# works 설계

원작 데이터. **앱은 이 디렉터리를 읽기만 한다.** 분기·세션·사용자 데이터는 여기에 두지 않는다. 허용되지 않은 파일이 있으면 무결성 검사가 실패한다.

## 작품 하나의 구성

```
works/<work_id>/
  metadata.yaml        작품, 판본, 출처, 국가별 라이선스 상태
  passage-tags.yaml    문단 큐레이션 원본 (사람이 편집, 원문 텍스트 없음)
  passages.jsonl       생성물: 태그 + 원문 텍스트 (tools/extract_passages.py)
  characters.yaml      인물 설정, 말투, 목표, knowledge_grants
  facts.yaml           원작 사실(f-*)과 해석(i-*), 근거 passage_ids, leak_terms
  spoilers.yaml        데이터에 없는 미래 사건의 누설 표현
  relationships.yaml   관계 간선, 근거, 공개 시점(revealed_at)
  timeline.yaml        시점과 순서(ordinal)
  glossary.yaml        한→영 검색어 확장 (BM25 기준선)
  scenes/<scene>.yaml  장면: 현재 시점, 인물, 오브젝트, 대화 목표, 분기, 토론 질문
```

## 문단 필드

| 필드 | 뜻 |
|---|---|
| `passage_id` | `<work>-ch<NN>-p<NNN>`. NNN은 PG 원문의 해당 장 안에서의 문단 번호 |
| `characters` | 그 문단의 일을 **직접 겪거나 본** 인물. 지식 필터의 기준 |
| `mentions` | 언급만 되는 인물 |
| `speakers` | 그 문단에서 말하는 인물. 말투 예시를 고를 때 쓴다 |
| `timeline_point` | 시간선 위치. 미래 누설 검사에 쓴다 |
| `narrative_layer` | `in_scene` / `summary` / `retrospective`(화자의 회고. 장면 속 인물에게 열리지 않음) |

## 문단을 추가하는 순서

1. `passage-tags.yaml`에 `{para, timeline_point, narrative_layer, characters, ...}`를 추가한다.
2. `uv run --project backend python tools/extract_passages.py <pg.txt> works/<id>`
3. `uv run --project backend python -m app.canon.integrity works/<id>`
4. 근거로 쓰려면 `facts.yaml`이나 `relationships.yaml`에서 참조한다.

## 새 작품을 추가할 때

[docs/copyright-review.md](../docs/copyright-review.md)의 체크리스트를 먼저 채운다. 하나라도 확인되지 않으면 커밋하지 않는다.
