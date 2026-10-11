# frontend 설계

React · TypeScript · Vite · Zustand · CSS Modules · Phaser 4(탐험 화면) · vitest

## 원칙

- 진실의 원천은 서버다. 프론트는 원작·해석·분기를 스스로 판단하지 않고, 서버가 준 `type`·`mode`만 표시한다.
- 모드 표시는 서버 세션 값을 따른다. 클라이언트에서 모드를 바꾸는 버튼은 서버에 요청만 보낸다.
- 이미지는 쓰지 않는다. 배경과 초상화는 SVG·CSS 자체 도형으로, 탐험 화면의 맵과 도트 캐릭터는 코드로 픽셀을 찍어 그린다 (저작권, G-8·G-9).

## 구조

```
src/
  app/            App 셸(헤더·탭·모드 배너), 전역 테마 토큰 (라우터 없이 store.screen으로 전환)
  components/     Badge(원작/해석/WHAT-IF), CitationList, Portrait(자체 SVG), ui.module.css
  features/
    works/          화면 1: 작품 선택
    world/          화면 2: 탐험 (도트 게임. 걸어 다니며 말 걸기·조사)
      game/           Phaser 장면(GardenScene), 맵(world.ts), 도트 스프라이트(sprites.ts), React와의 이벤트 통로(bridge.ts)
    dialogue/       화면 3: 인물 대화, 근거 패널
    relationships/  화면 4: 관계도 (SVG)
    what-if/        화면 5: 가상 분기
    report/         화면 6: 탐험 기록
  services/       api.ts (REST), dialogueSocket.ts (WebSocket)
  store/          session.ts (Zustand): screen, session, discoveries, turns, branch
  types/          백엔드 스키마와 같은 타입
tests/            vitest + Testing Library
```

## 상태 (Zustand)

| 슬라이스 | 내용 |
|---|---|
| `session` | sessionId, workId, sceneId, now, mode(`canon`/`what_if`), branchId |
| `discoveries` | 조사한 오브젝트, 확인한 근거 passage_ids |
| `dialogue` | 인물별 대화 기록, 진행 상태(`thinking`) |
| `branch` | 분기 선택, 이벤트, 인물 반응 |

## 화면별 핵심 동작

1. 작품 선택: `GET /works` → 출처·라이선스 카드 → `POST /sessions`
2. 탐험: WASD·방향키(또는 클릭)로 정원을 걷는다. 인물·오브젝트 가까이에서 E → 게임이 `bridge`로 `interact`를 알리고, React가 대화창(WebSocket) 또는 조사 창(`POST /sessions/{id}/inspect/{object}`)을 연다. 창이 열린 동안 게임은 멈추고 키 가로채기를 끈다 (입력칸에 W·A·S·D를 칠 수 있게).
   - Phaser는 탐험 화면에 들어갈 때만 동적 import한다 (첫 화면 번들에서 제외, jsdom 테스트에서는 `createGame`을 mock).
   - 오브젝트 위치는 장면 데이터의 `hotspot`(%)을 맵 크기로 바꿔 쓴다. 맵 모양과 인물이 서성이는 자리는 `game/world.ts`에 있다.
3. 대화: WebSocket으로 질문 → `thinking` 표시 → 검증된 `reply` 수신 → 주장별 배지, [근거 보기]
4. 관계도: `GET /sessions/{id}/graph` → 공개된 노드와 간선만 그림, 간선 클릭 시 근거
5. 분기: `POST /sessions/{id}/branches` → 화면 전체 보라 테두리, `AI WHAT-IF` 배지 상시 표시
6. 기록: `GET /sessions/{id}/report` → 사실 / 해석 / 분기 3열, 토론 질문

## 실행

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, /api는 127.0.0.1:8010으로 프록시 (LITVERSE_BACKEND로 변경 가능)
npm test           # vitest
npm run build      # 타입 검사 + 빌드
```

## 검증 (3단계 스모크)

`tsc --noEmit` · `vitest run` · `vite build` · uvicorn + `vite preview`로 프록시를 거친 REST·WebSocket 시나리오
