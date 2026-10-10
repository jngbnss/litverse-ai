import type { DialogueReply, Scene, SessionState, WorkDetail } from "../src/types/api";

export const work: WorkDetail = {
  work_id: "gatsby",
  title: "The Great Gatsby",
  title_ko: "위대한 개츠비",
  author: "F. Scott Fitzgerald",
  published: 1925,
  language: "en",
  summary_ko: "요약",
  source: { name: "Project Gutenberg", url: "https://www.gutenberg.org/ebooks/64317", edition: "#64317", retrieved: "2026-10-11" },
  license: { status: "verified", jurisdictions: { US: "verified", KR: "verified" }, note: "" },
  default_scene: "ch03-party",
  scenes: [{ scene_id: "ch03-party", title_ko: "3장 · 개츠비의 첫 파티", chapter: 3 }],
};

export const scene: Scene = {
  scene_id: "ch03-party",
  title_ko: "3장 · 개츠비의 첫 파티",
  chapter: 3,
  location: "gatsby-mansion",
  now: "t03-party-end",
  now_label_ko: "첫 파티 · 파티가 끝날 무렵",
  characters: [
    { character_id: "nick", display_name: "Nick Carraway", display_name_ko: "닉 캐러웨이", role_ko: "화자", default_emotion: "curious" },
    { character_id: "gatsby", display_name: "Jay Gatsby", display_name_ko: "제이 개츠비", role_ko: "주인", default_emotion: "composed" },
    { character_id: "jordan", display_name: "Jordan Baker", display_name_ko: "조던 베이커", role_ko: "골프 선수", default_emotion: "amused" },
  ],
  objects: [
    { object_id: "library-books", name_ko: "서재의 책", description_ko: "책장", hotspot: { x: 30, y: 35 } },
    { object_id: "invitation", name_ko: "초대 쪽지", description_ko: "쪽지", hotspot: { x: 12, y: 70 } },
  ],
  dialogue_goals: [{ character_id: "jordan", goal_ko: "소문 듣기" }],
  branches: [
    { branch_id: "w-nick-asks-rumor", title_ko: "닉이 소문을 직접 묻는다면?", premise_ko: "닉이 묻는다.", diverges_at: "t03-party-midnight", affected_characters: ["nick", "gatsby"] },
  ],
};

export const session: SessionState = {
  session_id: "s1",
  work_id: "gatsby",
  scene_id: "ch03-party",
  now: "t03-party-end",
  mode: "canon",
  branch_id: null,
};

export const reply: DialogueReply = {
  character_id: "nick",
  mode: "canon",
  reply: "노란 드레스의 손님이 그런 말을 했어요.",
  emotion: "calm",
  claims: [
    { text: "손님이 개츠비가 사람을 죽였다고 말했다.", type: "CANON", passage_ids: ["gatsby-ch03-p030"], perspective: null },
    { text: "소문은 상상을 보여 주는 것일 수 있다.", type: "INTERPRETATION", passage_ids: ["gatsby-ch03-p036"], perspective: "nick" },
  ],
  citations: [
    { passage_id: "gatsby-ch03-p030", chapter: 3, excerpt: "Somebody told me they thought he killed a man once.", claim_index: 0, type: "CANON" },
    { passage_id: "gatsby-ch03-p036", chapter: 3, excerpt: "She narrowed her eyes and shivered.", claim_index: 1, type: "INTERPRETATION" },
  ],
  fallback: false,
  attempts: 1,
  consistent: true,
};

/** 경로별 응답을 돌려주는 fetch 대역 */
export function mockFetch(routes: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const key = Object.keys(routes).find((k) => {
      const [m, p] = k.includes(" ") ? k.split(" ") : ["GET", k];
      return m === method && url === `/api${p}`;
    });
    if (!key) return new Response(JSON.stringify({ detail: `no route ${method} ${url}` }), { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}
