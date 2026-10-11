/**
 * 웨스트에그 오픈월드 배치. 단위는 미터, y가 위쪽, -z가 북쪽(바다 쪽)이다.
 *
 *            이스트에그 (데이지의 집, 초록 불빛) — 건널 수 없음
 *   ~~~~~~~~~~~~~~~~~~~~~~~~ 만(롱아일랜드 해협) ~~~~~~~~~~~~~~~~~~~~~~~~
 *   ........................ 해변 ...........│잔교│.....................
 *    닉의 오두막  │      개츠비 저택 잔디밭(파티)      │    이웃 저택
 *                 │          [저택 + 탑]                │
 *   ═══════════════════════ 마을 큰길 ═════════════════════════════════
 *      집   집   집        웨스트에그 마을        집   집   집
 */

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export interface Circle {
  x: number;
  z: number;
  r: number;
}
export interface Spot {
  x: number;
  z: number;
}

export const box = (minX: number, maxX: number, minZ: number, maxZ: number): Box => ({ minX, maxX, minZ, maxZ });
export const inBox = (b: Box, x: number, z: number) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

export const SHORE_Z = -58;
export const BOUNDS = box(-195, 195, SHORE_Z, 195);
export const DOCK = box(-1.5, 1.5, -80, SHORE_Z + 1);
export const SAND = box(-200, 200, SHORE_Z, -44);
export const ROAD = box(-200, 200, 85, 95);
export const DRIVEWAY = box(-4, 4, 57, 85);

// 개츠비 저택
export const ESTATE = box(-62, 62, -44, 82);
export const MANSION = box(-25, 25, 39, 57);
export const TOWER = box(23, 31, 41, 49);
export const TERRACE = box(-22, 22, 33, 39);
export const POOL = box(-40, -24, 0, 12);
export const STAGE = box(12, 28, -6, 2);
export const BAR = box(-8, -2, 20, 22);
export const TABLES: Spot[] = [
  { x: -16, z: -4 }, { x: -8, z: -10 }, { x: 0, z: -2 }, { x: -18, z: 18 },
  { x: 34, z: 14 }, { x: 40, z: -8 }, { x: 8, z: 22 }, { x: -4, z: -22 },
];
export const LANTERN_POLES: Spot[] = [
  { x: -44, z: -30 }, { x: -14, z: -34 }, { x: 16, z: -34 }, { x: 46, z: -30 },
  { x: 50, z: 24 }, { x: -48, z: 24 },
];

// 닉의 오두막과 이웃
export const COTTAGE = box(-92, -76, 36, 48);
export const PORCH = box(-90, -78, 32, 36);
export const NEIGHBOR = box(85, 125, 30, 55);

// 마을 집 (큰길 남쪽)
export const HOUSES: (Box & { color: string; roof: string })[] = [-176, -140, -104, -68, -32, 8, 44, 80, 116, 152].map(
  (x, i) => ({
    ...box(x, x + 18, 104 + (i % 3) * 4, 118 + (i % 3) * 4),
    color: ["#e8dcc4", "#c9d8e0", "#e6c9b8", "#d8e2c6", "#f0e6d0"][i % 5],
    roof: ["#7a4a3a", "#4a5a6a", "#6a4a5a", "#5a4a3a"][i % 4],
  }),
);
export const LAMPS: Spot[] = Array.from({ length: 20 }, (_, i) => ({ x: -190 + i * 20, z: 83.5 }));

// 건너편 이스트에그 (구경만)
export const EAST_EGG_Z = -140;
export const DAISY_HOUSE = { x: 70, z: -165 };
export const GREEN_LIGHT = { x: 62, z: -128 };

/** 시작 위치: 닉의 오두막 현관 앞. 여기서 파티장으로 걸어간다 */
export const SPAWN = { x: -84, z: 27, yaw: Math.PI / 2 };
export const CAR_SPAWN = { x: 8, z: 70, yaw: 0 };
export const BOAT = { x: 5, z: -72 };

/** 대화 인물이 서성이는 자리 (반경 r) */
export const HOMES: Record<string, Circle> = {
  gatsby: { x: 0, z: 31, r: 2 },
  jordan: { x: -10, z: 4, r: 6 },
  nick: { x: 6, z: 14, r: 5 },
};

/** 파티 손님: 색과 서성이는 자리 */
export const GUESTS: { colors: [string, string, string]; home: Circle; dancing?: boolean; dress?: boolean }[] = [
  { colors: ["#b8496a", "#1f1a17", "#b8496a"], home: { x: 16, z: -12, r: 4 }, dancing: true, dress: true },
  { colors: ["#2d2d38", "#2b2b2b", "#2d2d38"], home: { x: 22, z: -12, r: 4 }, dancing: true },
  { colors: ["#3f8f86", "#a8572e", "#3f8f86"], home: { x: 19, z: -16, r: 4 }, dancing: true, dress: true },
  { colors: ["#e9e0f2", "#e0c27a", "#e9e0f2"], home: { x: 26, z: -15, r: 4 }, dancing: true, dress: true },
  { colors: ["#6b5b8f", "#5c3d24", "#3a3550"], home: { x: -14, z: -8, r: 6 } },
  { colors: ["#7a2f2f", "#1f1f1f", "#2b2626"], home: { x: 36, z: 10, r: 6 } },
  { colors: ["#d9c9a3", "#3a2a1a", "#d9c9a3"], home: { x: -20, z: 16, r: 6 }, dress: true },
  { colors: ["#2f4f7f", "#4a3020", "#2a2a3a"], home: { x: -30, z: -20, r: 8 } },
  { colors: ["#c46a3a", "#2a1a10", "#c46a3a"], home: { x: 30, z: -26, r: 8 }, dress: true },
  { colors: ["#e6e6e6", "#2a2a2a", "#2a2a2a"], home: { x: -4, z: 18, r: 3 } },
  { colors: ["#8a6a48", "#6b4a2b", "#4b4036"], home: { x: -38, z: 22, r: 6 } },
  { colors: ["#5a5148", "#8c8c8c", "#3d362f"], home: { x: -14, z: 34, r: 1.5 } },
];

/** 조사 오브젝트 위치. 장면 데이터에 없는 위치는 hotspot(%)을 저택 마당에 펼쳐 놓는다 */
export const OBJECT_SPOTS: Record<string, Spot & { yaw?: number }> = {
  invitation: { x: -84, z: 33.2 },
  "fruit-crates": { x: -16, z: 60 },
  "library-books": { x: -14, z: 36.5 },
  orchestra: { x: 20, z: 3.5 },
  "ditch-coupe": { x: 26, z: 83.5, yaw: 0.4 },
};
export function objectSpot(id: string, hotspot: { x: number; y: number }): Spot & { yaw?: number } {
  return (
    OBJECT_SPOTS[id] ?? {
      x: ESTATE.minX + 10 + (hotspot.x / 100) * (ESTATE.maxX - ESTATE.minX - 20),
      z: ESTATE.minZ + 10 + (hotspot.y / 100) * (MANSION.minZ - ESTATE.minZ - 20),
    }
  );
}

/** 걸을 수 없는 곳 */
export const SOLID_BOXES: Box[] = [
  MANSION,
  TOWER,
  POOL,
  STAGE,
  BAR,
  COTTAGE,
  NEIGHBOR,
  ...HOUSES,
  // 저택 울타리 (정문과 닉의 오두막 쪽 샛길은 비운다)
  box(-62.5, -61.5, -44, 20),
  box(-62.5, -61.5, 34, 82),
  box(61.5, 62.5, -44, 82),
  box(-62, -5, 81.5, 82.5),
  box(5, 62, 81.5, 82.5),
];
export const SOLID_CIRCLES: Circle[] = [
  ...TABLES.map((t) => ({ ...t, r: 1.1 })),
  ...LANTERN_POLES.map((p) => ({ ...p, r: 0.3 })),
  ...LAMPS.map((p) => ({ ...p, r: 0.3 })),
];

/** 바닥 높이: 테라스와 현관, 잔교는 조금 높다 */
export function groundY(x: number, z: number): number {
  if (inBox(TERRACE, x, z)) return 0.5;
  if (inBox(PORCH, x, z)) return 0.4;
  if (inBox(DOCK, x, z)) return 0.3;
  return 0;
}

/** 물(바다)이 아닌 곳 */
export const walkable = (x: number, z: number) => inBox(BOUNDS, x, z) || inBox(DOCK, x, z);

export function areaName(x: number, z: number): string {
  if (inBox(DOCK, x, z)) return "개츠비의 잔교";
  if (z < -44) return "해변 · 롱아일랜드 해협";
  if (inBox(ESTATE, x, z) || inBox(box(-62, 62, 82, 85), x, z)) return "개츠비 저택";
  if (inBox(box(-112, -62, -44, 85), x, z)) return "닉의 오두막";
  if (inBox(box(70, 140, -44, 85), x, z)) return "이웃 저택";
  if (z >= 85) return "웨스트에그 마을";
  return "웨스트에그";
}

/** 시드 고정 난수 */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NO_TREES: Box[] = [
  box(-63, 63, -45, 83), box(-95, -73, 25, 52), box(80, 130, 25, 60), ROAD, box(-200, 200, 99, 128), SAND,
];
/** 나무: 저택·길·집을 피해 고르게 흩어 놓는다 */
export const TREES: Spot[] = (() => {
  const r = rng(1925);
  const out: Spot[] = [];
  while (out.length < 90) {
    const x = -190 + r() * 380;
    const z = -42 + r() * 232;
    if (NO_TREES.some((b) => inBox(b, x, z))) continue;
    out.push({ x, z });
  }
  // 저택 마당 가장자리
  for (const z of [-30, -10, 10, 44, 58, 70]) out.push({ x: -56, z }, { x: 56, z });
  return out;
})();
SOLID_CIRCLES.push(...TREES.map((t) => ({ ...t, r: 0.6 })));
