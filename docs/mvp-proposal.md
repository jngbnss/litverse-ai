# MVP 제안서 (오피스 아워 결과)

- 작성일: 2026-10-11
- 상태: 권장안 채택 (사용자 승인: "레코멘드로 진행")
- 관련 문서: [decision-log.md](decision-log.md), [copyright-review.md](copyright-review.md), [licenses.md](licenses.md)

---

## 0. 오피스 아워에서 바로잡은 전제

| 원래 전제 | 문제 | 권장 수정 |
|---|---|---|
| 개츠비 파티 장면 + 개츠비·닉·데이지 | 3장 첫 파티에 **데이지는 없다**. 데이지는 6장 파티에 처음 온다. | **3장 첫 파티 + 개츠비·닉·조던 베이커** |
| 닉은 장면 속 인물 | 닉은 **회고하는 화자**다. 3장 서술에 나중에 안 사실이 섞여 있다. | 문단에 `narrative_layer`(장면 내 / 회고) 필드를 둔다. 장면 속 닉은 회고 문단을 모른다. |
| LangGraph로 파이프라인 시작 | 단계 9개를 그래프로 짜면 MVP 초기 디버깅이 느리다. | 일반 Python 함수 파이프라인 + 인터페이스로 시작한다. 분기 상태 관리가 필요해질 때 LangGraph로 옮긴다. |
| Three.js / R3F | 3D는 핵심 가치(근거 대화·관계도)와 관계가 적고 비용이 크다. | **2.5D 포인트앤클릭**(정적 배경 + 핫스팟)으로 시작한다. 3D는 MVP 이후에 검토한다. |
| FAISS 또는 Qdrant | 문단이 50개 안팎이면 서버가 필요 없다. | **FAISS(in-process)** 를 쓴다. Qdrant는 비교 실험 대상으로만 둔다. |
| LLM 일관성 검사 | 같은 8B 모델이 자기 답을 채점하면 신뢰도가 낮다. | **규칙 기반 검사가 1차, LLM 판정은 보조**로 둔다. 구조화된 출력이 규칙 검사를 가능하게 한다. |

이 방식이 3장에서 더 좋은 이유: 3장의 주제는 `rumor / identity`다. 손님들은 개츠비를 두고 "사람을 죽였다", "독일 스파이다" 같은 **소문**을 말한다. 닉은 대화 상대가 개츠비인 줄 모른다. **CANON(소문이 오갔다는 사실)과 INTERPRETATION(소문의 진위), 지식 범위(닉은 모름)** 를 시험하기에 가장 좋은 장면이다.

---

## 1. MVP 작품 선정 기준

필수 조건 (하나라도 아니면 탈락):
1. 원문이 한국·미국에서 모두 퍼블릭 도메인이다 (배포 국가 기준).
2. 원문 텍스트의 출처가 명확하고, 출처 사이트의 이용 조건을 지킬 수 있다.
3. 한 장면에 **대화 가능한 인물 3명 이상**이 함께 있다.
4. 한 장면 분량이 30~50문단 안이다.
5. 인물마다 **아는 것과 모르는 것**의 차이가 분명하다 (지식 분리를 시험할 수 있어야 함).

가산점:
- 소문·오해·비밀처럼 사실과 해석을 구분해야 하는 요소가 있다.
- 조사할 만한 물건(오브젝트)이 원문에 구체적으로 나온다.
- 학교 교육과정이나 대중적 인지도가 있다.

**권장 작품**: F. Scott Fitzgerald, *The Great Gatsby* (1925) **영어 원문**, 3장.
- 미국: 1925년 출판 → 2021-01-01부터 퍼블릭 도메인
- 한국: 저자 1940년 사망 → 사망 후 보호기간 만료 (상세 근거는 copyright-review.md에서 검증)
- 3장 인물: 닉, 개츠비, 조던 베이커, 올빼미 눈 안경 남자(보조 NPC)

**예비 작품** (개츠비 원문 검토가 실패할 경우): 이상 「날개」 또는 현진건 「운수 좋은 날」. 한국어 원문이라 번역 문제가 없지만, 3인 동시 장면과 오브젝트 구성은 다시 설계해야 한다.

## 2. 저작권 확인 체크리스트

`docs/copyright-review.md`에 작품별로 아래 항목을 채운다. 하나라도 `unknown`이면 저장소에 넣지 않는다.

- [ ] 원문: 초판 연도, 저자 사망 연도, 국가별(KR / US / EU) 보호 상태
- [ ] 원문 텍스트 출처(판본): 전사 출처 사이트와 그 사이트의 이용 조건 (예: Project Gutenberg 상표·라이선스 문구 처리)
- [ ] 번역문: **사용 안 함**. 한국어는 팀이 직접 쓴 요약·해설만 쓰고, 출처를 "팀 작성"으로 표시한다.
- [ ] 이미지: 출판사 표지·삽화·영화 스틸 **사용 안 함**. 배경과 초상화는 팀이 자체 제작하고, 원작자와 라이선스를 기록한다.
- [ ] 인물 초상화: 1974·2013년 영화 배우와 닮지 않았는지 검수한다 (퍼블리시티권).
- [ ] 음악·음성: 영화 OST 사용 안 함. 쓴다면 CC0 또는 자체 제작만.
- [ ] 제3자 해설문: SparkNotes 등 해설을 복사하지 않는다. 해석 문장은 팀이 직접 쓴다.
- [ ] 상표: "The Great Gatsby" 제목 사용 범위 (교육·비상업 MVP 기준)
- [ ] 모델·OSS 라이선스: licenses.md에 기록
- [ ] 검토자, 검토일, 다음 재검토 시점

## 3. 장면 하나의 사용자 흐름 (10~15분)

```
[작품 선택] 개츠비 / 3장 "첫 파티" / 출처·라이선스 카드
   ↓
[진입] 개츠비 저택 정원, 여름 토요일 밤 — 배지: 원작 모드
   ↓
[조사 2~3분] 오브젝트 5개
   1. 운전사가 전해 준 초대장 (닉이 정식으로 초대받은 드문 손님)
   2. 오렌지·레몬 상자 → 월요일에 남는 껍질 더미
   3. 도서관의 진짜 책 (올빼미 눈 남자: "페이지를 안 잘랐다")
   4. 오케스트라와 칵테일 쟁반
   5. 파티가 끝난 뒤 도랑에 빠진 차
   → 조사할 때마다 원문 근거 카드 1장 + "발견 기록"
   ↓
[대화 5~7분] 조던 → (정체를 모른 채) 개츠비 → 닉
   - 대화 목표: 조던 "손님들이 개츠비를 두고 하는 소문 듣기"
              / 개츠비 "닉과 전쟁 시절 이야기"
              / 닉 "오늘 밤의 인상 정리"
   - 답변마다 [근거 보기] → 장, 원문 일부, CANON/INTERPRETATION 배지
   ↓
[관계도 1분] 지금까지 공개된 관계만 표시 (데이지 노드는 3장에서 숨김)
   ↓
[가상 분기 2~3분] AI WHAT-IF
   "개츠비가 정체를 밝힌 직후, 닉이 '사람을 죽였다는 소문'을 그에게 직접 묻는다면?"
   ↓
[탐험 기록] 확인한 사실 / 해석 / 가상 분기 / 토론 질문 3개
```

## 4. 작품 원문 데이터 구조

`works/gatsby/`:

```
metadata.yaml        작품·판본·출처·라이선스 상태
passages.jsonl       문단 단위 원문 (CANON 근거 원천, 읽기 전용)
characters.yaml      인물 설정 + 장면별 지식 규칙
facts.yaml           Canon Engine 사실/해석 단위 (passage_id 참조)
relationships.yaml   관계 간선 (passage_id 근거, 공개 시점)
timeline.yaml        시점 순서 (ordinal)
scenes/ch03-party.yaml  공간·오브젝트·대화 목표·분기 정의
```

`passages.jsonl` 한 줄 (프롬프트 스키마에 필드 4개 추가):

```json
{
  "passage_id": "gatsby-ch03-p014",
  "work_id": "gatsby",
  "chapter": 3,
  "order": 14,
  "text": "...",
  "characters": ["gatsby", "nick"],
  "location": "gatsby-mansion",
  "time_context": "party-night",
  "timeline_point": "t03-party-midnight",
  "narrative_layer": "in_scene",
  "speakers": ["gatsby"],
  "topics": ["identity", "wealth", "rumor"],
  "license_status": "verified",
  "source_reference": "Fitzgerald 1925, ch.3, para 14"
}
```

- `timeline_point`: 시간선 위의 위치. 미래 사건 누설 검사에 쓴다.
- `narrative_layer`: `in_scene`(장면 안의 사건과 대사) / `retrospective`(화자 닉이 나중에 덧붙인 회고).
- `speakers`: 그 문단에서 말하는 인물. 말투 예시를 고를 때 쓴다.
- `order`: 같은 장 안의 정렬 순서.

원칙: `works/` 아래 파일은 **원작 데이터이고 앱이 읽기만 한다**. 가상 분기는 DB에만 저장한다.

## 5. 등장인물별 지식 분리 방식

**지식은 프롬프트로 "모른 척"시키지 않는다. 검색 단계에서 아예 빼서 모델이 보지 못하게 한다.**

인물 c가 시점 t의 장면에서 문단 p에 접근하려면 아래 조건을 모두 만족해야 한다:

```
p.work_id == 현재 작품
AND p.timeline_point <= t                         (미래 차단)
AND (c ∈ p.characters  OR  p.passage_id ∈ c.told_passage_ids)   (목격했거나 들은 것)
AND NOT (p.narrative_layer == "retrospective" AND c == "nick_in_scene")
AND p.passage_id ∉ c.forbidden_passage_ids
```

`facts.yaml`의 사실마다 `known_by`, `revealed_at`이 있어서 문단과 같은 방식으로 거른다.

- `known_passage_ids`는 손으로 쓰지 않고 **위 규칙으로 빌드할 때 계산**한다. CI에서 다시 계산해 비교한다.
- `hidden_information`: 인물은 알지만 **말하지 않으려는 것**. 예를 들어 개츠비의 과거와 데이지 이야기다. 컨텍스트에는 넣되 "회피" 지시를 붙이고, 검사기가 누설 여부를 확인한다.
- `forbidden_information`: 인물이 **알 수 없는 것**. 컨텍스트에서 아예 뺀다.

3장 예시:

| 정보 | 닉 | 개츠비 | 조던 |
|---|---|---|---|
| 파티에 도는 소문 | 들음 | 앎 | 들음, 퍼뜨림 |
| 대화 상대가 개츠비라는 것 | 개츠비가 밝히기 전엔 모름 | 앎 | 앎 |
| 개츠비가 조던에게 따로 한 말 (=데이지, 4장에서 공개) | 모름 | 앎 (hidden) | 앎 (hidden, 비밀 약속) |
| 개츠비의 본명·과거 (6장) | 모름 | 앎 (hidden) | 모름 |
| 결말 사건 (7~9장) | forbidden | forbidden | forbidden |

## 6. Canon Engine 설계

```
backend/app/canon/
  models.py      Fact, Event, Relationship, TimelinePoint (Pydantic)
  store.py       works/ 로드 → 불변(frozen) 객체, 인덱스 생성
  knowledge.py   visible_passages(character, t), visible_facts(character, t)
  classify.py    답변의 주장(claim) → CANON / INTERPRETATION / WHAT_IF / UNSUPPORTED
  validate.py    일관성 검사 (아래 9번 규칙)
```

`facts.yaml` 단위:

```yaml
- fact_id: f-ch03-rumor-killed-man
  kind: canon            # canon | interpretation
  statement: "파티 손님들은 개츠비가 사람을 죽였다는 소문을 말한다."
  passage_ids: [gatsby-ch03-p0xx]
  revealed_at: t03-party-early
  known_by: [nick, jordan, gatsby]
- fact_id: i-ch03-rumor-function
  kind: interpretation
  statement: "소문은 개츠비의 정체가 비어 있음을 보여 주는 장치로 읽을 수 있다."
  passage_ids: [gatsby-ch03-p0xx]
  perspectives: [nick]
  author: team           # 해석 문장은 팀이 작성, 출처 표기
```

Canon Engine의 역할은 두 가지다:
1. **생성 전**: 검색 필터(지식 범위)와 허용 사실 목록을 만든다.
2. **생성 후**: 주장을 분류하고 검증한다. 원작 데이터는 절대 쓰지 않는다(쓰기 API 없음).

자체 OSS 후보 `canon-guard`는 이 중 `knowledge.py + classify.py + validate.py`를 작품과 무관한 인터페이스로 떼어 낸 것이다. MVP 중반 이후에 분리한다.

## 7. 원작·해석·가상 분기 분류 방식

LLM이 자유 문장 하나를 내는 대신, **주장 단위 JSON**을 출력하게 한다 (Pydantic으로 검증):

```json
{
  "reply": "화면에 보일 대사",
  "claims": [
    {"text": "...", "type": "CANON", "passage_ids": ["gatsby-ch03-p014"]},
    {"text": "...", "type": "INTERPRETATION", "passage_ids": ["..."], "perspective": "nick"}
  ],
  "mode": "canon",
  "emotion": "curious"
}
```

판정 규칙 (규칙 기반이 먼저, 순서대로):
1. `mode == what_if` 세션이 아닌데 `WHAT_IF` 주장이 나오면 → 위반.
2. `CANON` 주장인데 `passage_ids`가 없거나, 인물에게 허용되지 않은 문단을 가리키면 → 위반.
3. `CANON` 주장과 인용 문단 사이의 근거성 검사: 1차는 임베딩 유사도와 키워드 겹침, 2차는 LLM 판정(보조) → 기준 미달이면 `UNSUPPORTED`.
4. `INTERPRETATION` 주장인데 단정 표현이고 완곡 표지가 없으면 → `reply`에 템플릿 문구("~로 해석할 수 있습니다")를 강제로 넣는다.
5. forbidden 사실의 키워드·엔티티(데이지, 결말 사건 등)가 나오면 → 누설.

실패하면 1회 재생성한다. 그래도 실패하면 안전 답변("그건 내가 확실히 말할 수 없군요")으로 바꾸고, 실패 로그를 평가 데이터로 쌓는다.

UI 배지: `원작` (초록) / `해석` (노랑) / `AI WHAT-IF` (보라, 분기 화면 전체 테두리).

## 8. 첫 번째 RAG 평가 데이터 제작 방법

1. **문단 확정**: 3장 원문을 문단으로 자르고 30~50개를 고른다. 두 명이 메타데이터를 따로 태깅한 뒤 불일치를 조정한다.
2. **질문 작성 (총 80개)**:
   - `retrieval-cases.jsonl` 30개: 질문 → 정답 passage_id 집합. 한국어 질문 20개, 영어 질문 10개 (교차 언어 검색 측정).
   - `canon-cases.jsonl` 20개: 사실 질문 10개, 해석 유도 질문 5개, 원작에 없는 내용 질문 5개 (정답: "근거 없음").
   - `character-cases.jsonl` 20개: **함정 질문**. 예: 닉에게 "데이지 알아?" (사촌이라 알지만 개츠비와의 관계는 모름), 개츠비에게 "결말에 무슨 일이 생겨?", 조던에게 "개츠비가 뭐라고 했어?" (비밀 유지).
   - `branch-cases.jsonl` 10개: 분기 입력 → 원작 데이터 불변 여부, 분기 내부 모순 여부.
3. **작성자와 검수자를 분리**한다. 질문 작성자 ≠ 문단 태거.
4. **기준선**: BM25 → BGE-M3 → BGE-M3 + 메타데이터 필터. 측정 지표는 Recall@5, 잘못된 인물 문단 검색률, 지연 시간. 결과는 experiments.md에 기록한다.
5. 평가 스크립트 `evals/run_eval.py`는 mock LLM으로도 돌아가야 한다 (CI용). 실모델 평가는 로컬에서 돌리고 결과 파일만 커밋한다.

## 9. 프론트엔드와 백엔드의 책임 구분

| 영역 | 프론트엔드 (React + TS + Vite, Zustand, CSS Modules) | 백엔드 (FastAPI) |
|---|---|---|
| 진실의 원천 | 없음. 서버 응답만 표시 | works/ 로드, Canon Engine |
| 공간·오브젝트 | 2.5D 렌더, 핫스팟, 발견 상태 UI | 오브젝트 → 근거 문단 반환 |
| 대화 | 입력, 스트리밍 표시, 배지, 근거 패널 | 검색 → 생성 → 검증, WebSocket 스트림 |
| 모드 표시 | 원작/WHAT-IF 테두리·배지 | 세션 모드를 서버가 결정 (클라이언트 값 불신) |
| 관계도 | 그래프 렌더 (예: react-flow 또는 d3) | NetworkX → 현재 시점에 공개된 노드·간선 JSON |
| 분기 | 선택 UI, 결과 표시 | 분기 상태 복사, 이벤트 기록, 반응 생성 |
| 기록 | 결과 화면 렌더 | 세션 로그 집계 (SQLite) |

주의: **검증이 끝나기 전에는 토큰을 화면에 스트리밍하지 않는다.** 검증 후 문장 단위로 내보내거나, 생성 중에는 "생각 중" 표시만 한다. 검증 전 노출은 누설과 같다.

API 초안: `GET /works`, `GET /works/{id}/scenes/{sid}`, `POST /sessions`, `WS /sessions/{id}/dialogue`, `GET /sessions/{id}/graph`, `POST /sessions/{id}/branches`, `GET /sessions/{id}/report`.

## 10. 7인 팀 역할 분담

| # | 역할 | 주 담당 | 산출물 |
|---|---|---|---|
| 1 | PM / 콘텐츠·저작권 리드 | 작품 검토, 정책, 결정 로그 | copyright-review, content-policy, decision-log |
| 2 | 문학 데이터 큐레이터 | 문단 분할, 메타데이터, facts, 해석 문장 작성 | works/gatsby/* |
| 3 | 백엔드 리드 | FastAPI, WebSocket, DB, 세션·분기 저장 | api/, branching/, core/ |
| 4 | Canon Engine / canon-guard | 지식 필터, 분류, 검증 규칙 | canon/, characters/ |
| 5 | RAG / 모델 엔지니어 | 임베딩, FAISS, Qwen3 어댑터, 프롬프트 | ai/, retrieval/, model-selection |
| 6 | 평가 / QA | 평가 셋, 측정 스크립트, CI 데이터 검사 | evals/, experiments, ci.yml |
| 7 | 프론트엔드 + 아트 | 2.5D 화면, 대화 UI, 관계도, 자체 일러스트 | frontend/ |

2와 6은 평가 데이터를 서로 교차 검수한다. 4와 5는 검색 필터 인터페이스를 공동 소유한다.

## 11. 가장 큰 위험

### 기술
1. **교차 언어 근거성**: 질문과 답은 한국어, 근거 원문은 영어다. 근거성 검사(주장 ↔ 문단)의 정확도가 떨어질 수 있다. → BGE-M3로 다국어 처리, 평가 셋에 교차 언어 케이스를 포함한다.
2. **8B 4bit 모델 품질**: JSON 출력이 깨지거나, 말투가 이탈하거나, 숨겨야 할 정보를 누설할 수 있다. → 구조화 출력(Ollama format/JSON 스키마), 재생성 1회, 안전 답변 대체.
3. **자기 검증의 한계**: 같은 모델의 판정은 믿기 어렵다. → 규칙 기반 검사가 1차다. LLM 판정은 점수로만 쓰고 단독으로 통과시키지 않는다.
4. **화자 회고 문단**: 닉의 서술에 미래 정보가 섞인다. → `narrative_layer` 태깅 품질이 곧 누설률이다. 2인 태깅으로 관리한다.
5. **지연 시간**: 검색 + 생성 + 검증 + (재생성)이 로컬 GPU에서 10초를 넘을 수 있다. → 응답 길이를 제한하고, 검증은 규칙 검사 위주로 하고, 목표 p95는 실험으로 정한다.
6. **분기 오염**: 분기 이벤트가 원작 데이터에 섞일 수 있다. → works/는 읽기 전용, 분기는 DB의 별도 테이블에만 저장, CI에서 분리 검사.

### 저작권
1. **원문 출처 사이트 조건**: Project Gutenberg 텍스트를 쓰면 PG 상표 문구를 처리해야 한다 (헤더 제거 또는 라이선스 동봉). 판본 차이도 기록한다.
2. **번역 유혹**: 한국어 사용자를 위해 기존 번역문을 붙이고 싶어진다 → 금지. 팀 작성 요약만 쓴다.
3. **영화 이미지 연상**: 초상화가 2013년 영화 배우를 닮을 수 있다 → 아트 검수 체크리스트에 넣는다.
4. **해석 문장 출처**: 해설 사이트 문장을 무심코 옮길 수 있다 → 해석은 팀이 쓰고 작성자를 기록한다.
5. **배포 국가 확대**: 국가별 보호기간이 다르다 → MVP는 KR/US 비상업 시연으로 한정하고, 확대할 때 재검토한다.

---

## 다음 단계 (작은 단위, 승인 순)

1. **[이번]** 저장소 골격 문서: README, mvp-proposal, decision-log, copyright-review, licenses
2. `works/gatsby` 스키마(Pydantic) + 스키마 검사 스크립트 + 샘플 문단 3개 + pytest
3. 3장 문단 30~50개 정리와 메타데이터 태깅 (원문 출처 검증 후)
4. Canon Engine `knowledge.py` (지식 필터) + 함정 테스트
5. 검색: BM25 기준선 → BGE-M3 + FAISS, retrieval eval
6. LLM 어댑터 (mock / Ollama) + 구조화 출력 + validate
7. FastAPI + WebSocket 대화 엔드포인트
8. 프론트: 작품 선택 → 탐험 → 대화 → 근거 패널
9. 관계도, 분기, 탐험 기록
10. CI 전체
