/**
 * 개츠비 저택 정원 맵. 배경은 캔버스에 한 번 그려 텍스처로 쓴다.
 * 오브젝트 위치는 장면 데이터의 hotspot(%)을 이 맵 크기로 바꿔서 쓴다.
 */
import type Phaser from "phaser";

export const WORLD_W = 768;
export const WORLD_H = 512;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MANSION: Rect = { x: 96, y: 24, w: 448, h: 120 };
const SERVICE: Rect = { x: 600, y: 232, w: 120, h: 88 };
const FOUNTAIN = { x: 320, y: 300, r: 26 };
const STAGE: Rect = { x: 404, y: 214, w: 88, h: 44 };
const TABLES = [
  { x: 176, y: 250 },
  { x: 214, y: 296 },
  { x: 536, y: 330 },
  { x: 500, y: 396 },
  { x: 262, y: 404 },
];
export const TREES = [
  { x: 44, y: 196 },
  { x: 120, y: 236 },
  { x: 40, y: 300 },
  { x: 572, y: 196 },
  { x: 742, y: 160 },
  { x: 732, y: 380 },
  { x: 400, y: 420 },
];
const LANTERN_POLES = [72, 184, 296, 408, 520, 632];

/** 걸을 수 없는 곳 */
export const OBSTACLES: Rect[] = [
  { x: 0, y: 0, w: WORLD_W, h: 12 },
  { x: 0, y: 0, w: 12, h: 340 },
  { x: 0, y: 388, w: 12, h: 64 },
  { x: 0, y: 440, w: 600, h: 12 },
  { x: 756, y: 0, w: 12, h: 440 },
  MANSION,
  SERVICE,
  { x: FOUNTAIN.x - 26, y: FOUNTAIN.y - 20, w: 52, h: 40 },
  STAGE,
  ...TABLES.map((t) => ({ x: t.x - 8, y: t.y - 4, w: 16, h: 8 })),
  ...TREES.map((t) => ({ x: t.x - 4, y: t.y - 4, w: 8, h: 6 })),
];

export const SPAWN = { x: 44, y: 364 };

/** 대화 인물이 서성이는 자리 */
export const HOMES: Record<string, { x: number; y: number; r: number }> = {
  gatsby: { x: 352, y: 168, r: 24 },
  jordan: { x: 236, y: 344, r: 36 },
  nick: { x: 150, y: 400, r: 30 },
};

/** 분위기용 손님: 팔레트, 자리, 서성이는 반경 */
export const GUESTS: { key: string; x: number; y: number; r: number }[] = [
  { key: "guest1", x: 420, y: 300, r: 30 },
  { key: "guest3", x: 456, y: 312, r: 30 },
  { key: "guest5", x: 392, y: 336, r: 30 },
  { key: "guest4", x: 560, y: 380, r: 40 },
  { key: "guest2", x: 200, y: 196, r: 40 },
  { key: "guest6", x: 640, y: 420, r: 30 },
  { key: "owl", x: 196, y: 168, r: 8 },
];
export const MUSICIANS = [
  { key: "guest2", x: 424, y: 226 },
  { key: "guest6", x: 448, y: 222 },
  { key: "guest4", x: 472, y: 226 },
];

export const toWorld = (hotspot: { x: number; y: number }) => ({
  x: Math.round((hotspot.x / 100) * WORLD_W),
  y: Math.round((hotspot.y / 100) * WORLD_H),
});

/** 매번 같은 그림이 나오도록 시드 고정 난수 */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

const rect = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};

function speckle(c: Ctx, r: () => number, area: Rect, colors: string[], density: number) {
  const n = Math.floor(area.w * area.h * density);
  for (let i = 0; i < n; i++) {
    rect(c, colors[i % colors.length], area.x + Math.floor(r() * area.w), area.y + Math.floor(r() * area.h), 1, 1);
  }
}

function paving(c: Ctx, area: Rect, base: string, line: string, size = 8) {
  rect(c, base, area.x, area.y, area.w, area.h);
  for (let y = area.y; y < area.y + area.h; y += size) rect(c, line, area.x, y, area.w, 1);
  for (let y = area.y, row = 0; y < area.y + area.h; y += size, row++) {
    for (let x = area.x + (row % 2) * (size / 2); x < area.x + area.w; x += size) rect(c, line, x, y, 1, size);
  }
}

function hedge(c: Ctx, r: () => number, area: Rect) {
  rect(c, "#2c5631", area.x, area.y, area.w, area.h);
  speckle(c, r, area, ["#3b6f40", "#234827"], 0.35);
}

function mansion(c: Ctx) {
  const m = MANSION;
  rect(c, "#e6dccb", m.x, m.y, m.w, m.h);
  rect(c, "#6a5548", m.x - 6, m.y, m.w + 12, 30);
  rect(c, "#5a473c", m.x - 6, m.y + 28, m.w + 12, 3);
  for (let x = m.x - 6; x < m.x + m.w + 6; x += 6) rect(c, "#7a6456", x, m.y + 4, 3, 22);
  // 기둥과 창 (불 켜진 창)
  for (let x = m.x + 16; x < m.x + m.w - 16; x += 32) {
    rect(c, "#d4c8b3", x - 3, m.y + 31, 3, m.h - 31);
    if (x > m.x + 200 && x < m.x + 248) continue; // 정문 자리
    rect(c, "#3a3026", x + 8, m.y + 46, 14, 20);
    rect(c, "#f6dc8a", x + 9, m.y + 47, 12, 18);
    rect(c, "#3a3026", x + 8, m.y + 80, 14, 20);
    rect(c, "#f6dc8a", x + 9, m.y + 81, 12, 18);
  }
  // 서재 쪽 창: 책장
  for (let x = 160; x < 272; x += 32) {
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 6; i++) {
        rect(c, ["#8c3b2f", "#2f5a7a", "#6b7a32", "#a8783a"][(i + row) % 4], x + 9 + i * 2, m.y + 82 + row * 6, 2, 5);
      }
    }
  }
  // 정문과 계단
  rect(c, "#4a3526", 304, m.y + 82, 32, m.h - 82);
  rect(c, "#f6dc8a", 318, m.y + 84, 4, m.h - 84);
  for (let i = 0; i < 3; i++) rect(c, i % 2 ? "#d8d0bf" : "#cbc2af", 292 - i * 4, 144 + i * 6, 56 + i * 8, 6);
}

function service(c: Ctx) {
  const s = SERVICE;
  rect(c, "#d6c9b2", s.x, s.y, s.w, s.h);
  rect(c, "#7a5240", s.x - 4, s.y, s.w + 8, 22);
  for (let x = s.x - 4; x < s.x + s.w + 4; x += 5) rect(c, "#8a604c", x, s.y + 2, 2, 18);
  rect(c, "#4a3526", s.x + 34, s.y + 56, 16, 32);
  rect(c, "#3a3026", s.x + 72, s.y + 40, 16, 14);
  rect(c, "#f6dc8a", s.x + 73, s.y + 41, 14, 12);
}

function fountain(c: Ctx) {
  const { x, y, r } = FOUNTAIN;
  c.fillStyle = "#cfc6b4";
  c.beginPath();
  c.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#5fa6c8";
  c.beginPath();
  c.ellipse(x, y, r - 5, (r - 5) * 0.75, 0, 0, Math.PI * 2);
  c.fill();
  rect(c, "#9fd3ea", x - 10, y - 4, 6, 1);
  rect(c, "#9fd3ea", x + 4, y + 5, 7, 1);
  rect(c, "#d8d0bf", x - 3, y - 14, 6, 16);
  rect(c, "#cfe9f5", x - 1, y - 20, 2, 6);
}

function stage(c: Ctx) {
  const s = STAGE;
  rect(c, "#7a4e33", s.x, s.y, s.w, s.h);
  for (let x = s.x; x < s.x + s.w; x += 8) rect(c, "#6a432c", x, s.y, 1, s.h);
  rect(c, "#4f321f", s.x, s.y + s.h - 5, s.w, 5);
  rect(c, "#b33a3a", s.x - 4, s.y - 6, s.w + 8, 6);
}

function table(c: Ctx, x: number, y: number) {
  c.fillStyle = "#f2efe6";
  c.beginPath();
  c.ellipse(x, y - 2, 9, 6, 0, 0, Math.PI * 2);
  c.fill();
  rect(c, "#d9d3c4", x - 8, y + 1, 16, 2);
  rect(c, "#e2c25a", x - 3, y - 5, 2, 4);
  rect(c, "#c9e1ea", x + 2, y - 4, 2, 3);
}

function lanterns(c: Ctx) {
  const y = 196;
  for (const x of LANTERN_POLES) rect(c, "#3a3026", x, y - 18, 2, 22);
  for (let i = 0; i < LANTERN_POLES.length - 1; i++) {
    const a = LANTERN_POLES[i];
    const b = LANTERN_POLES[i + 1];
    for (let x = a; x <= b; x += 2) {
      const t = (x - a) / (b - a);
      const sag = Math.round(Math.sin(t * Math.PI) * 8);
      rect(c, "#2a2420", x, y - 18 + sag, 2, 1);
      if ((x - a) % 14 === 6) rect(c, ["#f5c542", "#e2564a", "#6cc28a", "#f08bc0"][(x / 14) % 4 | 0], x, y - 16 + sag, 2, 3);
    }
  }
}

/** 정원 배경 전체를 텍스처 하나로 그린다 */
export function bakeWorld(scene: Phaser.Scene, key = "garden"): void {
  const tex = scene.textures.createCanvas(key, WORLD_W, WORLD_H);
  if (!tex) return;
  const c = tex.getContext();
  const r = rng(1925);

  rect(c, "#4f8a4a", 0, 0, WORLD_W, WORLD_H);
  speckle(c, r, { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, ["#5c9a55", "#447c40", "#5c9a55"], 0.06);
  for (let i = 0; i < 90; i++) {
    rect(c, ["#f2e6a0", "#e9a3c0", "#ffffff"][i % 3], Math.floor(r() * WORLD_W), 190 + Math.floor(r() * 250), 1, 1);
  }

  // 길: 테라스, 정문 앞 길, 진입로, 길가 도로
  paving(c, { x: 64, y: 144, w: 512, h: 40 }, "#cfc6b4", "#bdb3a0");
  paving(c, { x: 304, y: 184, w: 32, h: 92 }, "#d8cfbb", "#c4baa5");
  rect(c, "#c9bb98", 0, 350, 304, 28);
  speckle(c, r, { x: 0, y: 350, w: 304, h: 28 }, ["#b5a682", "#d8cba8"], 0.25);
  rect(c, "#c9bb98", 304, 320, 32, 58);
  speckle(c, r, { x: 304, y: 320, w: 32, h: 58 }, ["#b5a682", "#d8cba8"], 0.25);
  rect(c, "#9c8a6a", 0, 476, WORLD_W, 36);
  speckle(c, r, { x: 0, y: 476, w: WORLD_W, h: 36 }, ["#8a7a5c", "#ad9b7a"], 0.2);
  rect(c, "#7f6f52", 0, 476, WORLD_W, 1);
  // 도랑 (길가 오른쪽)
  rect(c, "#3c5a34", 620, 452, 148, 22);
  speckle(c, r, { x: 620, y: 452, w: 148, h: 22 }, ["#2f4a29", "#4a6b40"], 0.3);

  hedge(c, r, { x: 0, y: 0, w: WORLD_W, h: 12 });
  hedge(c, r, { x: 0, y: 0, w: 12, h: 340 });
  hedge(c, r, { x: 0, y: 388, w: 12, h: 64 });
  hedge(c, r, { x: 0, y: 440, w: 600, h: 12 });
  hedge(c, r, { x: 756, y: 0, w: 12, h: 440 });
  // 정문 기둥
  rect(c, "#d8d0bf", 0, 332, 14, 10);
  rect(c, "#d8d0bf", 0, 386, 14, 10);

  mansion(c);
  service(c);
  fountain(c);
  stage(c);
  lanterns(c);
  TABLES.forEach((t) => table(c, t.x, t.y));
  tex.refresh();
}

/** 나무는 플레이어가 뒤로 지나갈 수 있게 따로 그린다 */
export function bakeTree(scene: Phaser.Scene, key = "tree"): void {
  const tex = scene.textures.createCanvas(key, 28, 34);
  if (!tex) return;
  const c = tex.getContext();
  rect(c, "#5a3d26", 12, 22, 4, 12);
  c.fillStyle = "#2f6236";
  c.beginPath();
  c.arc(14, 13, 13, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#3f7a45";
  c.beginPath();
  c.arc(11, 10, 7, 0, Math.PI * 2);
  c.fill();
  rect(c, "#5a9a5c", 8, 6, 3, 2);
  tex.refresh();
}

/** 조사 오브젝트 그림. 모르는 id는 반짝이는 표시만 그린다 */
export function bakeObject(scene: Phaser.Scene, objectId: string): { key: string; solid?: Rect } {
  const key = `obj-${objectId}`;
  const draw: Record<string, [number, number, (c: Ctx) => void, Rect?]> = {
    invitation: [20, 16, (c) => {
      rect(c, "#7a4e33", 2, 8, 16, 4);
      rect(c, "#5a3a26", 3, 12, 2, 4);
      rect(c, "#5a3a26", 15, 12, 2, 4);
      rect(c, "#f4ecd8", 6, 3, 9, 6);
      rect(c, "#c9a24a", 6, 3, 9, 1);
      rect(c, "#b33a3a", 10, 5, 2, 2);
    }, { x: -8, y: 0, w: 16, h: 6 }],
    "fruit-crates": [28, 22, (c) => {
      for (const [x, y] of [[0, 10], [14, 10], [7, 0]]) {
        rect(c, "#9a6a3c", x, y, 13, 11);
        rect(c, "#7a5230", x, y + 5, 13, 1);
        for (let i = 0; i < 4; i++) rect(c, "#f08a24", x + 2 + i * 3, y + 1, 2, 3);
      }
    }, { x: -14, y: -6, w: 28, h: 10 }],
    "library-books": [24, 28, (c) => {
      rect(c, "#5a3a26", 0, 0, 24, 28);
      for (let row = 0; row < 4; row++) {
        rect(c, "#3e2818", 1, 6 + row * 6, 22, 1);
        for (let i = 0; i < 10; i++) rect(c, ["#8c3b2f", "#2f5a7a", "#6b7a32", "#a8783a", "#e6dccb"][(i * 3 + row) % 5], 2 + i * 2, 1 + row * 6, 2, 5);
      }
    }, { x: -12, y: -6, w: 24, h: 8 }],
    orchestra: [36, 14, (c) => {
      rect(c, "#2a2420", 2, 4, 1, 10);
      rect(c, "#e9e4d4", 0, 2, 6, 3);
      rect(c, "#c9a24a", 14, 6, 8, 6);
      rect(c, "#2a2420", 30, 4, 1, 10);
      rect(c, "#e9e4d4", 28, 2, 6, 3);
    }],
    "ditch-coupe": [40, 24, (c) => {
      c.save();
      c.translate(20, 12);
      c.rotate(-0.18);
      rect(c, "#2f3d5a", -17, -6, 34, 10);
      rect(c, "#22304a", -9, -11, 18, 6);
      rect(c, "#9fc3d8", -7, -10, 6, 4);
      rect(c, "#9fc3d8", 1, -10, 6, 4);
      rect(c, "#1a1a1a", -14, 3, 7, 6);
      rect(c, "#d8d0bf", 14, -4, 3, 3);
      c.restore();
      rect(c, "#1a1a1a", 30, 18, 6, 6); // 떨어진 바퀴
    }, { x: -20, y: -4, w: 34, h: 10 }],
  };
  const spec = draw[objectId];
  const [w, h, paintFn, solid] = spec ?? [12, 12, (c: Ctx) => rect(c, "#f5c542", 4, 4, 4, 4)];
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, w, h);
    if (tex) {
      paintFn(tex.getContext());
      tex.refresh();
    }
  }
  return { key, solid };
}
