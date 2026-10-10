/** 짧은 이름 (관계도 노드, 탐험 화면 라벨) */
const SHORT: Record<string, string> = {
  nick: "닉",
  gatsby: "개츠비",
  jordan: "조던",
  daisy: "데이지",
  tom: "톰",
  "owl-eyes": "올빼미 눈",
};

export const shortName = (id: string, fallback: string) => SHORT[id] ?? fallback.split(" ")[0];
