# backend 설계

Python 3.12 · uv · FastAPI · Pydantic · SQLAlchemy(SQLite) · pytest · Ruff

## 모듈

```
app/
  canon/          원작 데이터와 그 위의 규칙. 쓰기 API 없음
    models.py       works/ 파일 스키마 (frozen)
    store.py        works/<id>/ → Work (MappingProxyType로 불변)
    integrity.py    참조 무결성, 허용 파일 목록, 라이선스 상태
    knowledge.py    KnowledgeView: 인물 × 시점 → 볼 수 있는 / 숨기는 문단
    guard.py        canon-guard: CharacterReply → ConsistencyReport
  retrieval/      Retriever Protocol + BM25 (2·4단계: 임베딩)
  ai/             schemas.py (LLM 출력), adapters/ (mock, ollama)        [2단계]
  characters/     프롬프트 빌더, 인물 응답 생성                           [2단계]
  dialogue/       파이프라인: 검색 → 생성 → 검증 → 재생성 → 안전 답변      [2단계]
  relationships/  NetworkX 그래프, 시점별 공개                            [2단계]
  branching/      가상 분기 상태와 이벤트                                 [2단계]
  api/            FastAPI 라우터, WebSocket                               [2단계]
  core/           설정, DB 세션                                           [2단계]
```

의존 방향: `api → dialogue → (characters, retrieval, canon, ai)`. `canon`은 다른 모듈에 의존하지 않는다. `canon/knowledge + guard`는 나중에 `canon-guard` 라이브러리로 분리할 수 있게 `Work`·`KnowledgeView`·스키마에만 의존한다.

## 대화 한 턴의 흐름

```
질문(text, character_id, session)
 → session.mode, session.now, (분기면) branch_id
 → view = build_view(work, character_id, now)            지식 필터 (D-003)
 → hits = retriever.search(question, view, k=5)          볼 수 있는 문단만
 → prompt = build_prompt(character, hits, mode)          hidden 문단은 "말하지 말 것" 표시
 → raw = llm.generate(prompt, schema=CharacterReply)     JSON 스키마 출력
 → reply = CharacterReply.model_validate(raw)            실패하면 재생성
 → report = check_reply(work, view, reply, mode)
 → 실패하면 위반 내용을 붙여 1회 재생성, 그래도 실패하면 safe_reply
 → turns 테이블에 질문, 답변, 사용한 passage_ids, report 저장
 → 클라이언트에 검증된 답변 전송 (스트리밍 없음, D-011)
```

## 지식 규칙 (canon/knowledge.py)

인물 c가 시점 t에 문단 p를 아는 경우:
1. `c ∈ p.characters` 이고, `p.timeline_point ≤ t` 이고, `p.narrative_layer ≠ retrospective`
2. 또는 c에게 `knowledge_grant(p)`가 있고 `grant.known_from ≤ t`

grant의 disclosure가 `hidden`이면, 그 문단은 컨텍스트에는 들어가지만 원작 모드에서 인용하거나 `leak_terms`를 말하면 위반이다.

## canon-guard 검사 (canon/guard.py)

| 검사 | 결과 필드 |
|---|---|
| CANON 주장에 근거가 없음 / 없는 passage_id | `unsupported_claims` |
| 다른 작품의 passage_id | `canon_conflicts` |
| 인물이 볼 수 없는 문단 인용, 모르는 사실의 누설 표현, 미래 사건 표현 | `knowledge_violations` |
| 숨긴 문단 인용, 숨긴 사실의 누설 표현 (원작 모드) | `hidden_disclosures` |
| 해석인데 완곡 표현이 없음 | `interpretation_as_fact` |
| 원작 모드에 WHAT_IF 주장, 모드 불일치 | `mode_violation` |

한계: 주장 내용이 인용 문단과 실제로 맞는지(의미 근거성)는 규칙으로 확인하지 못한다. 2단계에서 LLM 판정을 보조 점수로 붙이되, LLM 판정만으로 통과시키지는 않는다(D-006).

## 원작 데이터와 분기 데이터의 분리

- `works/`는 프로세스 시작 시 한 번 읽고 불변 객체로 들고 있다.
- 분기 이벤트는 SQLite `branch_events`에만 저장한다. `works/` 디렉터리에 쓰는 코드는 없다.
- 스모크·CI에서 분기 전후의 `works/` 파일 해시가 같은지 확인한다.

## 테스트

- `tests/`: 단위 테스트. 실제 `works/gatsby` 데이터로 함정 케이스를 검증한다.
- `tools/smoke.py`: 단계별 시나리오 스모크 테스트.
- 모델이 필요한 테스트는 모두 `MockLLM`으로 돌린다. CI에서 모델을 다운로드하지 않는다.
