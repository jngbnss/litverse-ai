import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../src/app/App";
import { gardenBridge } from "../src/features/world/game/gardenBridge";
import { useSession } from "../src/store/session";
import { mockFetch, reply, scene, session, work } from "./fixtures";

const routes = {
  "/works": [{ work_id: "gatsby", title: work.title, title_ko: work.title_ko, author: work.author, published: 1925 }],
  "/works/gatsby": work,
  "/works/gatsby/scenes/ch03-party": scene,
  "POST /sessions": session,
  "POST /sessions/s1/inspect/library-books": {
    object_id: "library-books",
    name_ko: "서재의 책",
    description_ko: "책장",
    passages: [{ passage_id: "gatsby-ch03-p045", chapter: 3, excerpt: "They're real." }],
    facts: [{ fact_id: "f-real-books", kind: "canon", statement_ko: "서재의 책은 진짜다." }],
  },
  "POST /sessions/s1/branches": {
    branch_id: "b1",
    option_id: "w-nick-asks-rumor",
    title_ko: "닉이 소문을 직접 묻는다면?",
    label: "AI WHAT-IF",
    diverges_at: "t03-party-midnight",
    snapshot: { canon_now: "t03-party-end", diverges_at: "t03-party-midnight", canon_fingerprint: "abcdef1234567890" },
    events: [
      { kind: "choice", character_id: null, payload: { premise_ko: "닉이 묻는다." }, consistent: true },
      { kind: "reaction", character_id: "gatsby", payload: { reply: { ...reply, reply: "(AI WHAT-IF) 당황했을 겁니다." } }, consistent: true },
    ],
  },
  "/sessions/s1": { ...session, mode: "what_if", branch_id: "b1" },
};

beforeEach(() => {
  useSession.getState().reset();
  vi.stubGlobal("fetch", mockFetch(routes));
});

afterEach(() => vi.unstubAllGlobals());

// jsdom에는 캔버스가 없어서 Phaser 게임은 띄우지 않는다. 게임 이벤트는 bridge로 흉내 낸다.
vi.mock("../src/features/world/game/createGame", () => ({
  createGame: () => ({ destroy: () => {} }),
}));

it("goes from work selection to exploring and inspecting an object", async () => {
  render(<App />);
  expect(await screen.findAllByText(/퍼블릭 도메인 확인/)).toHaveLength(2);
  await userEvent.click(screen.getByRole("button", { name: "탐험 시작" }));

  expect(await screen.findByTestId("mode-badge")).toHaveTextContent("원작 모드");
  expect(screen.getByText(/단서 0\/2/)).toBeInTheDocument();

  // 플레이어가 책장 앞에 서서 E를 누른다
  act(() => gardenBridge.game.emit("focus", { kind: "object", id: "library-books", label: "서재의 책" }));
  expect(screen.getByText("서재의 책 조사하기 (E)")).toBeInTheDocument();
  act(() => gardenBridge.game.emit("interact", { kind: "object", id: "library-books", label: "서재의 책" }));
  expect(await screen.findByText("서재의 책은 진짜다.")).toBeInTheDocument();
  expect(screen.getByText(/They're real/)).toBeInTheDocument();
  expect(screen.getByText(/단서 1\/2/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "조사 닫기" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /✓ 서재의 책/ })).toBeInTheDocument();
});

it("opens a dialogue box when talking to a character in the garden", async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "탐험 시작" }));
  await screen.findByTestId("mode-badge");

  const paused: boolean[] = [];
  const off = gardenBridge.ui.on("paused", (p) => paused.push(p));
  act(() => gardenBridge.game.emit("interact", { kind: "character", id: "gatsby", label: "개츠비" }));
  const box = await screen.findByRole("dialog", { name: /와의 대화/ });
  expect(box).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "질문" })).toHaveFocus();
  expect(paused.at(-1)).toBe(true);

  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(paused.at(-1)).toBe(false);
  off();
});

it("enters an AI WHAT-IF branch and marks the whole UI", async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "탐험 시작" }));
  await userEvent.click(await screen.findByRole("button", { name: "가상 분기" }));
  await userEvent.click(screen.getByRole("button", { name: "이 가정으로 들어가기" }));

  await waitFor(() => expect(screen.getByTestId("mode-badge")).toHaveTextContent("AI WHAT-IF 모드"));
  expect(screen.getByText(/원작과 다른 가정의 세계입니다/)).toBeInTheDocument();
  expect(screen.getByText(/당황했을 겁니다/)).toBeInTheDocument();
  expect(screen.getByText(/abcdef123456/)).toBeInTheDocument();
});
