/** 정적인 배경: 땅, 바다, 길, 건물, 나무, 파티 장식, 하늘 */
import * as THREE from "three";

import {
  BAR,
  BOAT,
  type Box,
  COTTAGE,
  DAISY_HOUSE,
  DOCK,
  DRIVEWAY,
  EAST_EGG_Z,
  GREEN_LIGHT,
  HOUSES,
  LAMPS,
  LANTERN_POLES,
  MANSION,
  NEIGHBOR,
  POOL,
  PORCH,
  rng,
  ROAD,
  SAND,
  SHORE_Z,
  STAGE,
  TABLES,
  TERRACE,
  TOWER,
  TREES,
} from "./layout";
import { boxMesh, hipRoof, mat, tree, windows } from "./models";

const size = (b: Box) => ({ w: b.maxX - b.minX, d: b.maxZ - b.minZ, cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2 });

function flat(scene: THREE.Object3D, b: Box, color: string, y: number) {
  const { w, d, cx, cz } = size(b);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color));
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, y, cz);
  scene.add(m);
  return m;
}

function block(scene: THREE.Object3D, b: Box, h: number, color: string, y = 0) {
  const { w, d, cx, cz } = size(b);
  const m = boxMesh(w, h, d, color);
  m.position.set(cx, y + h / 2, cz);
  scene.add(m);
  return m;
}

function mansion(scene: THREE.Scene) {
  const g = new THREE.Group();
  const { w, d, cx, cz } = size(MANSION);
  block(g, MANSION, 14, "#e6dccb");
  const roof = hipRoof(w + 2, d + 2, 7, "#5a473c");
  roof.position.set(cx, 14 + 3.5, cz);
  g.add(roof);
  // 노르망디 시청을 흉내 낸 한쪽 탑
  block(g, TOWER, 24, "#ded3c0");
  const t = size(TOWER);
  const spire = hipRoof(t.w + 1, t.d + 1, 8, "#4a3a30");
  spire.position.set(t.cx, 24 + 4, t.cz);
  g.add(spire);
  windows(g, { x0: -22, x1: 20, z: MANSION.minZ, rows: [3, 8, 12], step: 4, facing: -1 });
  windows(g, { x0: -22, x1: 20, z: MANSION.maxZ, rows: [3, 8], step: 6, facing: 1 });
  windows(g, { x0: 25, x1: 29, z: TOWER.minZ, rows: [16, 20], step: 4, facing: -1 });
  // 기둥과 정문
  for (let x = -20; x <= 20; x += 5) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 8, 8), mat("#f2ece0"));
    col.position.set(x, 4.5, MANSION.minZ - 1.2);
    g.add(col);
  }
  const portico = boxMesh(44, 0.6, 3, "#efe7d8");
  portico.position.set(0, 8.6, MANSION.minZ - 1.2);
  const door = boxMesh(3, 5, 0.2, "#4a3526");
  door.position.set(0, 3, MANSION.minZ - 0.05);
  const doorLight = boxMesh(1, 4.2, 0.22, "#f6dc8a", "#c9a24a");
  doorLight.position.set(0, 2.9, MANSION.minZ - 0.06);
  g.add(portico, door, doorLight);
  // 서재 쪽 열린 창 너머 책장
  for (let i = 0; i < 4; i++) {
    const shelf = boxMesh(0.5, 1, 0.1, ["#8c3b2f", "#2f5a7a", "#6b7a32", "#a8783a"][i]);
    shelf.position.set(-15.5 + i * 0.9, 3 + (i % 2) * 0.2, MANSION.minZ - 0.04);
    g.add(shelf);
  }
  // 테라스와 계단
  block(g, TERRACE, 0.5, "#d8d0bf");
  for (let i = 0; i < 3; i++) {
    const step = boxMesh(12 - i * 2, 0.17, 1, "#cbc2af");
    step.position.set(0, 0.08 + i * 0.17, TERRACE.minZ - 2.5 + i * 0.8);
    g.add(step);
  }
  scene.add(g);
}

function partyGrounds(scene: THREE.Scene) {
  // 대리석 수영장
  block(scene, POOL, 0.4, "#e8e2d4");
  const water = flat(scene, { minX: POOL.minX + 0.8, maxX: POOL.maxX - 0.8, minZ: POOL.minZ + 0.8, maxZ: POOL.maxZ - 0.8 }, "#4fa3c8", 0.42);
  (water.material as THREE.MeshLambertMaterial).emissive.set("#0d3a50");
  // 악단 무대
  block(scene, STAGE, 1, "#7a4e33");
  const s = size(STAGE);
  const canopy = boxMesh(s.w + 1, 0.3, s.d + 1, "#b33a3a");
  canopy.position.set(s.cx, 5, s.cz);
  scene.add(canopy);
  for (const x of [STAGE.minX, STAGE.maxX]) {
    for (const z of [STAGE.minZ, STAGE.maxZ]) {
      const pole = boxMesh(0.2, 4, 0.2, "#e9e4d4");
      pole.position.set(x, 3, z);
      scene.add(pole);
    }
  }
  // 바
  block(scene, BAR, 1.1, "#5a3a26");
  for (let i = 0; i < 6; i++) {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 6), mat(["#2f6b3a", "#8a5a2a", "#e6e0c8"][i % 3]));
    bottle.position.set(BAR.minX + 0.6 + i * 0.9, 1.3, (BAR.minZ + BAR.maxZ) / 2);
    scene.add(bottle);
  }
  // 둥근 테이블
  for (const t of TABLES) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 14), mat("#f2efe6"));
    top.position.set(t.x, 0.8, t.z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.8, 6), mat("#d9d3c4"));
    leg.position.set(t.x, 0.4, t.z);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.2, 6), mat("#e2c25a", "#7a5a10"));
    glass.position.set(t.x + 0.3, 0.94, t.z);
    scene.add(top, leg, glass);
  }
  // 색 전구 줄
  const colors = ["#f5c542", "#e2564a", "#6cc28a", "#f08bc0"];
  const bulbGeo = new THREE.SphereGeometry(0.12, 6, 4);
  for (const p of LANTERN_POLES) {
    const pole = boxMesh(0.15, 5, 0.15, "#3a3026");
    pole.position.set(p.x, 2.5, p.z);
    scene.add(pole);
  }
  for (let i = 0; i < LANTERN_POLES.length; i++) {
    const a = LANTERN_POLES[i];
    const b = LANTERN_POLES[(i + 1) % LANTERN_POLES.length];
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const v = new THREE.Vector3(a.x + (b.x - a.x) * t, 4.9 - Math.sin(t * Math.PI) * 1.2, a.z + (b.z - a.z) * t);
      pts.push(v);
      if (k % 2 === 1) {
        const c = colors[(i + k) % colors.length];
        const bulb = new THREE.Mesh(bulbGeo, mat(c, c));
        bulb.position.copy(v).y -= 0.15;
        scene.add(bulb);
      }
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: "#2a2420" })));
  }
  // 파티장을 비추는 따뜻한 불빛 (조명 수는 적게)
  for (const [x, z] of [[-14, -14], [20, -10], [0, 22]]) {
    const light = new THREE.PointLight("#ffcf7a", 60, 40, 1.6);
    light.position.set(x, 6, z);
    scene.add(light);
  }
}

function cottageAndNeighbors(scene: THREE.Scene) {
  // 닉의 낡은 오두막
  block(scene, COTTAGE, 4.5, "#b8a88c");
  const c = size(COTTAGE);
  const roof = hipRoof(c.w + 1.5, c.d + 1.5, 3, "#5a4a3a");
  roof.position.set(c.cx, 4.5 + 1.5, c.cz);
  scene.add(roof);
  windows(scene, { x0: -90, x1: -80, z: COTTAGE.minZ, rows: [2.2], step: 5, facing: -1, w: 1.2, h: 1.2 });
  block(scene, PORCH, 0.4, "#8a7458");
  const door = boxMesh(1.2, 2.2, 0.1, "#4a3526");
  door.position.set(-84, 1.5, COTTAGE.minZ - 0.05);
  scene.add(door);
  // 이웃 저택
  block(scene, NEIGHBOR, 10, "#d6d0c4");
  const n = size(NEIGHBOR);
  const nroof = hipRoof(n.w + 2, n.d + 2, 5, "#3e4a5a");
  nroof.position.set(n.cx, 10 + 2.5, n.cz);
  scene.add(nroof);
  windows(scene, { x0: 88, x1: 122, z: NEIGHBOR.minZ, rows: [3, 7], step: 5, facing: -1 });
  // 마을 집
  for (const h of HOUSES) {
    block(scene, h, 5, h.color);
    const s = size(h);
    const r = hipRoof(s.w + 1, s.d + 1, 3, h.roof);
    r.position.set(s.cx, 5 + 1.5, s.cz);
    scene.add(r);
    windows(scene, { x0: h.minX + 3, x1: h.maxX - 3, z: h.minZ, rows: [2.5], step: 6, facing: -1, w: 1.2, h: 1.3 });
  }
  // 가로등
  for (const l of LAMPS) {
    const pole = boxMesh(0.15, 4, 0.15, "#2a2a2a");
    pole.position.set(l.x, 2, l.z);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), mat("#fff1c0", "#f0c060"));
    lamp.position.set(l.x, 4.1, l.z);
    scene.add(pole, lamp);
  }
}

function hedges(scene: THREE.Scene) {
  const green = "#2c5631";
  block(scene, { minX: -62.5, maxX: -61.5, minZ: -44, maxZ: 20 }, 1.6, green);
  block(scene, { minX: -62.5, maxX: -61.5, minZ: 34, maxZ: 82 }, 1.6, green);
  block(scene, { minX: 61.5, maxX: 62.5, minZ: -44, maxZ: 82 }, 1.6, green);
  block(scene, { minX: -62, maxX: -5, minZ: 81.5, maxZ: 82.5 }, 1.2, "#d8d0bf");
  block(scene, { minX: 5, maxX: 62, minZ: 81.5, maxZ: 82.5 }, 1.2, "#d8d0bf");
  for (const x of [-5.5, 5.5]) {
    const gate = boxMesh(1.2, 3, 1.2, "#e6dccb");
    gate.position.set(x, 1.5, 82);
    scene.add(gate);
  }
}

function waterfront(scene: THREE.Scene) {
  // 잔교와 모터보트 (개츠비는 수상비행기와 모터보트를 가지고 있다)
  block(scene, DOCK, 0.3, "#8a6a48");
  const boat = new THREE.Group();
  const hull = boxMesh(2, 0.8, 6, "#f2efe6");
  hull.position.y = -0.1;
  const deck = boxMesh(1.8, 0.1, 3, "#a8783a");
  deck.position.set(0, 0.35, -0.8);
  const shield = boxMesh(1.6, 0.5, 0.08, "#9fc3d8");
  shield.position.set(0, 0.6, 0.8);
  boat.add(hull, deck, shield);
  boat.position.set(BOAT.x, 0, BOAT.z);
  scene.add(boat);
  // 건너편 이스트에그
  flat(scene, { minX: -400, maxX: 400, minZ: -600, maxZ: EAST_EGG_Z }, "#3f6b3e", 0.05);
  flat(scene, { minX: -400, maxX: 400, minZ: EAST_EGG_Z, maxZ: EAST_EGG_Z + 6 }, "#cdbb8a", 0.06);
  const daisy = new THREE.Group();
  const main = boxMesh(30, 10, 14, "#c45a4a");
  main.position.y = 5;
  const trim = boxMesh(31, 0.6, 15, "#f2efe6");
  trim.position.y = 10;
  const r = hipRoof(32, 16, 5, "#3a2a2a");
  r.position.y = 12.8;
  daisy.add(main, trim, r);
  windows(daisy, { x0: -12, x1: 12, z: 7, rows: [3, 7], step: 4, facing: 1 });
  daisy.position.set(DAISY_HOUSE.x, 0, DAISY_HOUSE.z);
  scene.add(daisy);
  const dock = boxMesh(1.5, 0.3, 14, "#6a5038");
  dock.position.set(GREEN_LIGHT.x, 0.15, GREEN_LIGHT.z - 6);
  scene.add(dock);
}

function sky(scene: THREE.Scene) {
  const r = rng(64317);
  const pos: number[] = [];
  for (let i = 0; i < 600; i++) {
    const theta = r() * Math.PI * 2;
    const phi = Math.acos(0.15 + r() * 0.85);
    pos.push(Math.sin(phi) * Math.cos(theta) * 450, Math.cos(phi) * 450, Math.sin(phi) * Math.sin(theta) * 450);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)),
    new THREE.PointsMaterial({ color: "#ffffff", size: 1.4, sizeAttenuation: false, fog: false }),
  );
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), new THREE.MeshBasicMaterial({ color: "#fff6dc", fog: false }));
  moon.position.set(-160, 180, -320);
  scene.add(moon);
}

export interface Environment {
  /** 초록 불빛 깜빡임, 물결 */
  tick: (t: number) => void;
}

export function buildEnvironment(scene: THREE.Scene): Environment {
  scene.background = new THREE.Color("#16233f");
  scene.fog = new THREE.Fog("#16233f", 60, 320);
  scene.add(new THREE.HemisphereLight("#9fb4e0", "#3a4a2a", 1.6));
  const moonLight = new THREE.DirectionalLight("#cfd8ff", 1.6);
  moonLight.position.set(-80, 120, -100);
  scene.add(moonLight);

  // 땅, 모래, 바다
  flat(scene, { minX: -400, maxX: 400, minZ: SHORE_Z, maxZ: 400 }, "#4a7f45", 0);
  flat(scene, SAND, "#d8c79a", 0.01);
  const sea = flat(scene, { minX: -800, maxX: 800, minZ: -700, maxZ: SHORE_Z + 0.5 }, "#1f4f78", -0.3);
  const seaMat = sea.material as THREE.MeshLambertMaterial;
  seaMat.emissive.set("#0a1a2c");
  flat(scene, ROAD, "#5a5650", 0.02);
  flat(scene, DRIVEWAY, "#c9bb98", 0.02);
  flat(scene, { minX: -86, maxX: -82, minZ: 36, maxZ: 85 }, "#b5a682", 0.02);

  mansion(scene);
  partyGrounds(scene);
  cottageAndNeighbors(scene);
  hedges(scene);
  waterfront(scene);
  sky(scene);
  const r = rng(7);
  for (const t of TREES) scene.add(tree(t.x, t.z, 0.8 + r() * 0.6));

  // 만 건너편 데이지 집 잔교 끝의 초록 불빛
  const green = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: "#5dff8a", fog: false }));
  green.position.set(GREEN_LIGHT.x, 1.6, GREEN_LIGHT.z);
  const glow = new THREE.PointLight("#5dff8a", 40, 30, 1.5);
  glow.position.copy(green.position);
  scene.add(green, glow);

  return {
    tick(t) {
      const on = Math.sin(t * 1.6) > -0.3;
      green.visible = on;
      glow.intensity = on ? 40 : 0;
      seaMat.emissive.setRGB(0.04, 0.1 + Math.sin(t * 0.8) * 0.015, 0.17);
    },
  };
}
