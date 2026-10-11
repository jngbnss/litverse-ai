/**
 * 로우폴리 모델. 이미지·외부 모델 파일 없이 기본 도형만 조합한다 (저작권, frontend/DESIGN.md).
 * 인물은 배우와 닮지 않도록 색만으로 구분한다.
 */
import * as THREE from "three";

const mats = new Map<string, THREE.MeshLambertMaterial>();
/** 색마다 재질 하나를 같이 쓴다 */
export function mat(color: string, emissive?: string): THREE.MeshLambertMaterial {
  const key = `${color}|${emissive ?? ""}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, emissive: emissive ?? "#000000" });
    mats.set(key, m);
  }
  return m;
}

export function boxMesh(w: number, h: number, d: number, color: string, emissive?: string): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, emissive));
}

/** 피부, 머리, 상의, 하의 색 */
export interface PersonColors {
  top: string;
  hair: string;
  bottom: string;
  skin?: string;
  dress?: boolean;
}

export interface Person {
  root: THREE.Group;
  /** 걷기 애니메이션: phase는 누적 거리, speed 0이면 멈춤 */
  animate: (phase: number, moving: boolean, dancing?: boolean) => void;
}

export function makePerson(c: PersonColors): Person {
  const root = new THREE.Group();
  const skin = c.skin ?? "#f0c7a0";
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  for (const [g, x] of [[legL, -0.13], [legR, 0.13]] as const) {
    const leg = boxMesh(0.2, 0.8, 0.22, c.dress ? skin : c.bottom);
    leg.position.y = -0.4;
    const shoe = boxMesh(0.22, 0.1, 0.32, "#2a2018");
    shoe.position.set(0, -0.82, 0.05);
    g.add(leg, shoe);
    g.position.set(x, 0.86, 0);
    root.add(g);
  }
  const body = boxMesh(0.56, 0.7, 0.32, c.top);
  body.position.y = 1.2;
  root.add(body);
  if (c.dress) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 0.5, 8), mat(c.top));
    skirt.position.y = 0.76;
    root.add(skirt);
  } else {
    const hips = boxMesh(0.5, 0.18, 0.3, c.bottom);
    hips.position.y = 0.86;
    root.add(hips);
  }
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  for (const [g, x] of [[armL, -0.36], [armR, 0.36]] as const) {
    const arm = boxMesh(0.15, 0.62, 0.17, c.top);
    arm.position.y = -0.3;
    const hand = boxMesh(0.13, 0.12, 0.13, skin);
    hand.position.y = -0.66;
    g.add(arm, hand);
    g.position.set(x, 1.52, 0);
    root.add(g);
  }
  const head = boxMesh(0.36, 0.38, 0.36, skin);
  head.position.y = 1.76;
  const hair = boxMesh(0.4, 0.14, 0.4, c.hair);
  hair.position.y = 1.97;
  const hairBack = boxMesh(0.4, c.dress ? 0.34 : 0.22, 0.1, c.hair);
  hairBack.position.set(0, c.dress ? 1.78 : 1.86, -0.17);
  const eyes = boxMesh(0.24, 0.05, 0.02, "#2a2320");
  eyes.position.set(0, 1.78, 0.185);
  root.add(head, hair, hairBack, eyes);

  // 발밑 그림자
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 12),
    new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.25, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  return {
    root,
    animate(phase, moving, dancing) {
      const swing = moving ? Math.sin(phase * 2.2) * 0.6 : 0;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.8;
      armR.rotation.x = swing * 0.8;
      if (dancing && !moving) {
        const t = performance.now() / 300;
        armL.rotation.z = 0.4 + Math.sin(t) * 0.5;
        armR.rotation.z = -0.4 - Math.sin(t) * 0.5;
      } else {
        armL.rotation.z = 0;
        armR.rotation.z = 0;
      }
    },
  };
}

/** 머리 위 이름표 */
export function makeLabel(text: string, color = "#ffffff"): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(20,18,14,0.85)";
  ctx.strokeText(text, 128, 34);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 34);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }),
  );
  sprite.scale.set(2, 0.5, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** 조사할 곳 위에 떠 있는 표시 */
export function makeMarker(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28),
    new THREE.MeshBasicMaterial({ color: "#ffd84a" }),
  );
  m.renderOrder = 5;
  return m;
}

/** 개츠비의 크림색 자동차 (차체 길이 약 5m, 앞이 +z) */
export function makeCar(body = "#efe2b4", trim = "#c9c9c9"): { root: THREE.Group; wheels: THREE.Mesh[] } {
  const root = new THREE.Group();
  const chassis = boxMesh(1.9, 0.5, 5, body);
  chassis.position.y = 0.6;
  const hood = boxMesh(1.5, 0.45, 2, body);
  hood.position.set(0, 1.05, 1.4);
  const cabin = boxMesh(1.7, 0.85, 1.6, body);
  cabin.position.set(0, 1.25, -0.6);
  const glass = boxMesh(1.5, 0.5, 0.05, "#9fc3d8");
  glass.position.set(0, 1.45, 0.22);
  glass.rotation.x = -0.25;
  const grill = boxMesh(1.1, 0.6, 0.08, trim);
  grill.position.set(0, 1.0, 2.42);
  root.add(chassis, hood, cabin, glass, grill);
  for (const x of [-0.98, 0.98]) {
    const fender = boxMesh(0.3, 0.25, 1.4, "#3a3a2a");
    fender.position.set(x, 0.8, 1.6);
    const board = boxMesh(0.32, 0.08, 2.4, "#3a3a2a");
    board.position.set(x * 1.05, 0.4, -0.2);
    root.add(fender, board);
  }
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat("#fff6c8", "#fff0a0"));
    lamp.position.set(x, 1.25, 2.45);
    root.add(lamp);
  }
  const wheels: THREE.Mesh[] = [];
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 14);
  for (const [x, z] of [[-1, 1.6], [1, 1.6], [-1, -1.6], [1, -1.6]]) {
    const w = new THREE.Mesh(wheelGeo, mat("#1a1a1a"));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.45, z);
    root.add(w);
    wheels.push(w);
  }
  return { root, wheels };
}

/** 사각 지붕 (네모뿔) */
export function hipRoof(w: number, d: number, h: number, color: string): THREE.Mesh {
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1), mat(color));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w, h, d);
  return roof;
}

/** 불 켜진 창문을 벽에 줄지어 붙인다 (facing: 벽이 바라보는 방향) */
export function windows(
  parent: THREE.Object3D,
  opts: { x0: number; x1: number; z: number; rows: number[]; step: number; facing: 1 | -1; w?: number; h?: number },
) {
  const geo = new THREE.PlaneGeometry(opts.w ?? 1.4, opts.h ?? 2);
  const lit = mat("#f6dc8a", "#c9a24a");
  for (let x = opts.x0; x <= opts.x1; x += opts.step) {
    for (const y of opts.rows) {
      const win = new THREE.Mesh(geo, lit);
      win.position.set(x, y, opts.z + opts.facing * 0.02);
      if (opts.facing < 0) win.rotation.y = Math.PI;
      parent.add(win);
    }
  }
}

export function tree(x: number, z: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.4, 6), mat("#5a3d26"));
  trunk.position.y = 1.2;
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), mat("#2f6236"));
  leaves.position.y = 3.6;
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), mat("#3f7a45"));
  top.position.set(0.3, 4.6, 0.2);
  g.add(trunk, leaves, top);
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  return g;
}
