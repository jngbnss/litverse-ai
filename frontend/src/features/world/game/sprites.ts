/**
 * 도트 스프라이트. 이미지 파일 없이 코드로 픽셀을 찍어 만든다 (저작권, frontend/DESIGN.md).
 * 한 칸은 12x16 픽셀이고, 방향(down/up/side)마다 정지·걸음 2프레임이다.
 */
import type Phaser from "phaser";

export const CELL_W = 12;
export const CELL_H = 16;

// H 머리 · S 피부 · E 눈 · T 상의 · N 넥타이/칼라 · B 허리(바지·치마) · L 다리 · K 신발
const DOWN = [
  "....HHHH....",
  "...HHHHHH...",
  "..HHSSSSHH..",
  "...SSSSSS...",
  "...SESSES...",
  "....SSSS....",
  "....TNNT....",
  "..TTTNNTTT..",
  "..TTTTTTTT..",
  ".STTTTTTTTS.",
  ".S.TTTTTT.S.",
  "...BBBBBB...",
  "...LL..LL...",
  "...LL..LL...",
  "...KK..KK...",
  "............",
];
const UP = [
  "....HHHH....",
  "...HHHHHH...",
  "..HHHHHHHH..",
  "...HHHHHH...",
  "...HHHHHH...",
  "....SSSS....",
  "....TTTT....",
  "..TTTTTTTT..",
  "..TTTTTTTT..",
  ".STTTTTTTTS.",
  ".S.TTTTTT.S.",
  "...BBBBBB...",
  "...LL..LL...",
  "...LL..LL...",
  "...KK..KK...",
  "............",
];
const SIDE = [
  "....HHHH....",
  "...HHHHHH...",
  "...HHSSSS...",
  "...HSSSSS...",
  "...HSSSES...",
  "....SSSS....",
  ".....TN.....",
  "....TTTN....",
  "....TTTT....",
  "....TTTT....",
  "....STTS....",
  "....BBBB....",
  "....LLLL....",
  "....L..L....",
  "....K..K....",
  "............",
];

/** 걸음 프레임: 다리 줄만 바꾼다 */
function walk(rows: string[], legs: [string, string, string]): string[] {
  return [...rows.slice(0, 12), ...legs, rows[15]];
}

const FRAMES: Record<string, string[]> = {
  down0: DOWN,
  down1: walk(DOWN, ["..LL....LL..", "..LL....LL..", "..KK....KK.."]),
  up0: UP,
  up1: walk(UP, ["..LL....LL..", "..LL....LL..", "..KK....KK.."]),
  side0: SIDE,
  side1: walk(SIDE, ["....LLLL....", "...L....L...", "...K....K..."]),
};
export const FRAME_NAMES = Object.keys(FRAMES);

export type Palette = Record<"H" | "S" | "E" | "T" | "N" | "B" | "L" | "K", string>;

const man = (H: string, T: string, B: string, N = "#ece6d6", S = "#f0c7a0"): Palette => ({
  H, S, E: "#2a2320", T, N, B, L: B, K: "#2a2018",
});
const woman = (H: string, T: string, N = "#f6e7b0", S = "#f2c8a2"): Palette => ({
  H, S, E: "#2a2320", T, N, B: T, L: S, K: "#5a4630",
});

/** 대화 인물과 손님. 영화 배우와 닮지 않도록 색만으로 구분한다 */
export const PALETTES: Record<string, Palette> = {
  player: man("#33334d", "#4a6fa5", "#2f3a4f", "#e8e8e8"),
  nick: man("#6b4a2b", "#8a6a48", "#4b4036"),
  gatsby: { ...man("#c9a46a", "#f4f1e8", "#f4f1e8", "#e58fa8", "#efc39c"), K: "#8a6a48" },
  jordan: woman("#4a2e1c", "#d9b55c"),
  guest1: woman("#1f1a17", "#b8496a"),
  guest2: man("#2b2b2b", "#2d2d38", "#2d2d38"),
  guest3: woman("#a8572e", "#3f8f86"),
  guest4: man("#5c3d24", "#6b5b8f", "#3a3550"),
  guest5: woman("#e0c27a", "#e9e0f2"),
  guest6: man("#1f1f1f", "#7a2f2f", "#2b2626"),
  owl: { ...man("#8c8c8c", "#5a5148", "#3d362f"), E: "#e8d070" },
};

function paint(ctx: CanvasRenderingContext2D, rows: string[], palette: Palette, ox: number) {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch as keyof Palette];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, y, 1, 1);
    });
  });
}

/** 팔레트마다 텍스처 하나(프레임 6개)와 방향별 걷기 애니메이션을 만든다 */
export function bakeCharacters(scene: Phaser.Scene): void {
  for (const [key, palette] of Object.entries(PALETTES)) {
    const tex = scene.textures.createCanvas(key, CELL_W * FRAME_NAMES.length, CELL_H);
    if (!tex) continue;
    const ctx = tex.getContext();
    FRAME_NAMES.forEach((name, i) => {
      paint(ctx, FRAMES[name], palette, i * CELL_W);
      tex.add(name, 0, i * CELL_W, 0, CELL_W, CELL_H);
    });
    tex.refresh();
    for (const dir of ["down", "up", "side"]) {
      scene.anims.create({
        key: `${key}-${dir}`,
        frames: [0, 1].map((n) => ({ key, frame: `${dir}${n}` })),
        frameRate: 6,
        repeat: -1,
      });
    }
  }
}
