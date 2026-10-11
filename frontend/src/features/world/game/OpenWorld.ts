/**
 * 3인칭 오픈월드. 걷기·달리기, 마우스 시점, 자동차 운전, 인물·오브젝트 상호작용, 미니맵.
 * 서버 호출은 하지 않는다. 상호작용은 bridge로 React에 알린다.
 */
import * as THREE from "three";

import type { GameBridge, Target } from "./bridge";
import { buildEnvironment, type Environment } from "./environment";
import {
  areaName,
  CAR_SPAWN,
  type Circle,
  COTTAGE,
  DOCK,
  groundY,
  GUESTS,
  HOMES,
  HOUSES,
  MANSION,
  NEIGHBOR,
  objectSpot,
  POOL,
  ROAD,
  SHORE_Z,
  SOLID_BOXES,
  SOLID_CIRCLES,
  SPAWN,
  STAGE,
  TOWER,
  walkable,
} from "./layout";
import { makeCar, makeLabel, makeMarker, makePerson, type Person } from "./models";
import { makeProp } from "./props";

export interface WorldData {
  bridge: GameBridge;
  characters: { id: string; label: string }[];
  objects: { id: string; label: string; hotspot: { x: number; y: number } }[];
  found: string[];
}

const WALK = 3.2;
const RUN = 6.5;
const PLAYER_R = 0.35;
const CAR_R = 2.1;
const TALK_RANGE = 2.8;
const CAR_RANGE = 3.6;
const PLAYER_COLORS = { top: "#4a6fa5", hair: "#33334d", bottom: "#2f3a4f" };
const AGENT_COLORS: Record<string, { top: string; hair: string; bottom: string; dress?: boolean }> = {
  nick: { top: "#8a6a48", hair: "#6b4a2b", bottom: "#4b4036" },
  gatsby: { top: "#f4f1e8", hair: "#c9a46a", bottom: "#f4f1e8" },
  jordan: { top: "#d9b55c", hair: "#4a2e1c", bottom: "#d9b55c", dress: true },
};

interface Walker {
  person: Person;
  x: number;
  z: number;
  yaw: number;
  phase: number;
  home: Circle;
  goal: { x: number; z: number } | null;
  wait: number;
  dancing?: boolean;
  id?: string;
  label?: THREE.Sprite;
}

interface Prop {
  id: string;
  label: string;
  x: number;
  z: number;
  range: number;
  marker: THREE.Mesh;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** 원(반지름 r)이 벽·나무와 겹치지 않도록 밀어낸다 */
function resolve(x: number, z: number, r: number, extra: Circle[] = []): [number, number] {
  for (const b of SOLID_BOXES) {
    const cx = clamp(x, b.minX, b.maxX);
    const cz = clamp(z, b.minZ, b.maxZ);
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    } else {
      // 상자 안에 들어간 경우: 가장 가까운 면으로 뺀다
      const pen = [x - b.minX, b.maxX - x, z - b.minZ, b.maxZ - z];
      const i = pen.indexOf(Math.min(...pen));
      if (i === 0) x = b.minX - r;
      else if (i === 1) x = b.maxX + r;
      else if (i === 2) z = b.minZ - r;
      else z = b.maxZ + r;
    }
  }
  for (const c of [...SOLID_CIRCLES, ...extra]) {
    const dx = x - c.x;
    const dz = z - c.z;
    const min = r + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min || d2 < 1e-8) continue;
    const d = Math.sqrt(d2);
    x = c.x + (dx / d) * min;
    z = c.z + (dz / d) * min;
  }
  return [x, z];
}

export class OpenWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);
  private env: Environment;
  private timer = new THREE.Timer();
  private raf = 0;
  private resizeObserver: ResizeObserver;
  private minimap: HTMLCanvasElement;
  private cleanups: (() => void)[] = [];

  private player = makePerson(PLAYER_COLORS);
  private pos = { x: SPAWN.x, z: SPAWN.z };
  private yaw = SPAWN.yaw;
  private phase = 0;
  private camYaw = SPAWN.yaw;
  private camPitch = 0.32;
  private camDist = 6;
  private lastMouse = 0;

  private car = { ...makeCar(), x: CAR_SPAWN.x, z: CAR_SPAWN.z, yaw: CAR_SPAWN.yaw, speed: 0 };
  private driving = false;

  private walkers: Walker[] = [];
  private props: Prop[] = [];
  private found = new Set<string>();
  private prompt = makeLabel("[E]", "#ffe066");
  private focusKey = "";
  private focused: (Target & { x: number; z: number }) | null = null;
  private area = "";
  private areaTimer = 0;
  private mapTimer = 0;

  private keys = new Set<string>();
  private paused = false;

  constructor(
    private host: HTMLElement,
    private data: WorldData,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none";
    host.appendChild(this.renderer.domElement);

    this.minimap = document.createElement("canvas");
    this.minimap.width = 160;
    this.minimap.height = 160;
    this.minimap.setAttribute("aria-hidden", "true");
    this.minimap.style.cssText =
      "position:absolute;top:10px;right:10px;width:140px;height:140px;border-radius:50%;border:3px solid rgba(255,250,240,.85);box-shadow:0 2px 8px rgba(0,0,0,.4)";
    host.appendChild(this.minimap);

    this.env = buildEnvironment(this.scene);
    this.spawnActors();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.bindInput();
    this.cleanups.push(
      data.bridge.ui.on("paused", (p) => this.setPaused(p)),
      data.bridge.ui.on("found", (ids) => this.markFound(ids)),
    );
    this.markFound(data.found);
    this.loop();
  }

  private spawnActors() {
    this.player.root.position.set(this.pos.x, 0, this.pos.z);
    this.scene.add(this.player.root);

    this.car.root.position.set(this.car.x, 0, this.car.z);
    this.car.root.rotation.y = this.car.yaw;
    this.scene.add(this.car.root);

    for (const c of this.data.characters) {
      const home = HOMES[c.id];
      if (!home) continue;
      const w = this.addWalker(makePerson(AGENT_COLORS[c.id] ?? PLAYER_COLORS), home);
      w.id = c.id;
      w.label = makeLabel(c.label);
      this.scene.add(w.label);
    }
    for (const g of GUESTS) {
      const [top, hair, bottom] = g.colors;
      const w = this.addWalker(makePerson({ top, hair, bottom, dress: g.dress }), g.home);
      w.dancing = g.dancing;
    }

    for (const o of this.data.objects) {
      const spot = objectSpot(o.id, o.hotspot);
      const prop = makeProp(o.id);
      prop.position.set(spot.x, groundY(spot.x, spot.z), spot.z);
      prop.rotation.y = spot.yaw ?? 0;
      this.scene.add(prop);
      const marker = makeMarker();
      this.scene.add(marker);
      this.props.push({ id: o.id, label: o.label, x: spot.x, z: spot.z, range: o.id === "orchestra" ? 5 : 3, marker });
    }

    this.prompt.scale.set(1.2, 0.3, 1);
    this.prompt.visible = false;
    this.scene.add(this.prompt);
  }

  private addWalker(person: Person, home: Circle): Walker {
    const a = Math.random() * Math.PI * 2;
    const w: Walker = {
      person,
      x: home.x + Math.cos(a) * home.r * 0.5,
      z: home.z + Math.sin(a) * home.r * 0.5,
      yaw: Math.random() * Math.PI * 2,
      phase: 0,
      home,
      goal: null,
      wait: Math.random() * 3,
    };
    this.scene.add(person.root);
    this.walkers.push(w);
    return w;
  }

  // --- 입력 ----------------------------------------------------------------
  private bindInput() {
    const canvas = this.renderer.domElement;
    const typing = (e: Event) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    };
    const onDown = (e: KeyboardEvent) => {
      if (this.paused || typing(e)) return;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === "KeyE" && !e.repeat) this.interact();
    };
    const onUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    const onBlur = () => this.keys.clear();
    const onClick = () => {
      if (this.paused || document.pointerLockElement === canvas) return;
      try {
        const p = canvas.requestPointerLock() as unknown;
        if (p instanceof Promise) p.catch(() => {});
      } catch {
        /* 포인터 잠금을 못 쓰면 드래그로 돌린다 */
      }
    };
    const onMove = (e: PointerEvent) => {
      const locked = document.pointerLockElement === canvas;
      if (!locked && !(e.buttons & 1)) return;
      this.camYaw -= e.movementX * 0.0035;
      this.camPitch = clamp(this.camPitch + e.movementY * 0.003, 0.05, 1.2);
      this.lastMouse = performance.now();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.camDist = clamp(this.camDist + e.deltaY * 0.01, 3, 14);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    canvas.addEventListener("click", onClick);
    window.addEventListener("pointermove", onMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    this.cleanups.push(() => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("wheel", onWheel);
    });
  }

  private setPaused(paused: boolean) {
    this.paused = paused;
    this.keys.clear();
    if (paused && document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
  }

  private markFound(ids: string[]) {
    this.found = new Set(ids);
  }

  private interact() {
    if (this.driving) {
      this.exitCar();
      return;
    }
    const f = this.focused;
    if (!f) return;
    if (f.kind === "vehicle") this.enterCar();
    else this.data.bridge.game.emit("interact", { kind: f.kind, id: f.id, label: f.label });
  }

  private enterCar() {
    this.driving = true;
    this.player.root.visible = false;
    this.car.speed = 0;
  }

  private exitCar() {
    if (Math.abs(this.car.speed) > 3) return;
    // 운전석 쪽(왼쪽)부터 내릴 자리를 찾는다
    const { x, z, yaw } = this.car;
    for (const side of [1, -1]) {
      const px = x + Math.cos(yaw) * 1.8 * side;
      const pz = z - Math.sin(yaw) * 1.8 * side;
      const [rx, rz] = resolve(px, pz, PLAYER_R);
      if (walkable(rx, rz) && Math.hypot(rx - px, rz - pz) < 0.5) {
        this.pos = { x: rx, z: rz };
        this.driving = false;
        this.car.speed = 0;
        this.player.root.visible = true;
        this.yaw = yaw;
        return;
      }
    }
  }

  // --- 매 프레임 -------------------------------------------------------------
  private loop = (now?: number) => {
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update(now);
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();
    if (this.driving) this.drive(dt);
    else this.walk(dt);
    for (const w of this.walkers) this.moveWalker(w, dt);
    this.updateProps(t);
    this.updateFocus();
    this.updateCamera(dt);
    this.env.tick(t);
    this.areaTimer -= dt;
    if (this.areaTimer <= 0) {
      this.areaTimer = 0.3;
      const p = this.driving ? this.car : this.pos;
      const name = areaName(p.x, p.z);
      if (name !== this.area) {
        this.area = name;
        this.data.bridge.game.emit("area", name);
      }
    }
    this.mapTimer -= dt;
    if (this.mapTimer <= 0) {
      this.mapTimer = 0.1;
      this.drawMinimap();
    }
    this.renderer.render(this.scene, this.camera);
  };

  private input() {
    const k = this.keys;
    const fwd = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const right = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    return { fwd, right, run: k.has("ShiftLeft") || k.has("ShiftRight") };
  }

  private walk(dt: number) {
    const { fwd, right, run } = this.paused ? { fwd: 0, right: 0, run: false } : this.input();
    let dx = 0;
    let dz = 0;
    if (fwd || right) {
      const s = Math.sin(this.camYaw);
      const c = Math.cos(this.camYaw);
      dx = s * fwd - c * right;
      dz = c * fwd + s * right;
      const len = Math.hypot(dx, dz);
      const speed = run ? RUN : WALK;
      dx = (dx / len) * speed * dt;
      dz = (dz / len) * speed * dt;
      this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 12));
      this.phase += Math.hypot(dx, dz) * (run ? 1.3 : 1.6);
    }
    const carCircle = { x: this.car.x, z: this.car.z, r: CAR_R };
    const [nx, nz] = resolve(this.pos.x + dx, this.pos.z + dz, PLAYER_R, [carCircle]);
    if (walkable(nx, nz)) this.pos = { x: nx, z: nz };
    const p = this.player.root;
    p.position.set(this.pos.x, groundY(this.pos.x, this.pos.z), this.pos.z);
    p.rotation.y = this.yaw;
    this.player.animate(this.phase, !!(fwd || right));
  }

  private drive(dt: number) {
    const car = this.car;
    const { fwd, right } = this.paused ? { fwd: 0, right: 0 } : this.input();
    if (fwd > 0) car.speed += (car.speed < 0 ? 16 : 8) * dt;
    else if (fwd < 0) car.speed -= (car.speed > 0 ? 16 : 5) * dt;
    car.speed -= car.speed * 0.6 * dt;
    if (!fwd && Math.abs(car.speed) < 0.15) car.speed = 0;
    car.speed = clamp(car.speed, -6, 24);
    const grip = clamp(Math.abs(car.speed) / 6, 0, 1) * Math.sign(car.speed);
    car.yaw -= right * 1.5 * grip * dt;
    const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
    const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
    const [rx, rz] = resolve(nx, nz, CAR_R);
    const blocked = Math.hypot(rx - nx, rz - nz) > 0.01 || !walkable(rx, rz) || (rz < SHORE_Z + 2 && !walkable(rx, rz - 2));
    if (blocked) {
      car.speed *= -0.25;
      if (walkable(rx, rz) && rz >= SHORE_Z + 2) {
        car.x = rx;
        car.z = rz;
      }
    } else {
      car.x = rx;
      car.z = rz;
    }
    car.root.position.set(car.x, 0, car.z);
    car.root.rotation.y = car.yaw;
    for (const w of car.wheels.slice(0, 2)) w.rotation.y = right * -0.4;
    this.pos = { x: car.x, z: car.z };
  }

  private moveWalker(w: Walker, dt: number) {
    const talking = this.focused?.kind === "character" && this.focused.id === w.id;
    let moving = false;
    if (talking) {
      w.yaw = lerpAngle(w.yaw, Math.atan2(this.pos.x - w.x, this.pos.z - w.z), Math.min(1, dt * 6));
    } else if (!w.goal) {
      w.wait -= dt;
      if (w.wait <= 0) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * w.home.r;
        w.goal = { x: w.home.x + Math.cos(a) * d, z: w.home.z + Math.sin(a) * d };
      }
    } else {
      const dx = w.goal.x - w.x;
      const dz = w.goal.z - w.z;
      const dist = Math.hypot(dx, dz);
      const step = 1.1 * dt;
      if (dist < 0.2) {
        w.goal = null;
        w.wait = 2 + Math.random() * 5;
      } else {
        const [nx, nz] = resolve(w.x + (dx / dist) * step, w.z + (dz / dist) * step, PLAYER_R);
        if (Math.hypot(nx - w.x, nz - w.z) < step * 0.3) {
          w.goal = null;
          w.wait = 1 + Math.random() * 2;
        } else {
          w.x = nx;
          w.z = nz;
          w.yaw = lerpAngle(w.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
          w.phase += step * 1.6;
          moving = true;
        }
      }
    }
    const root = w.person.root;
    root.position.set(w.x, groundY(w.x, w.z), w.z);
    root.rotation.y = w.yaw;
    w.person.animate(w.phase, moving, w.dancing);
    w.label?.position.set(w.x, groundY(w.x, w.z) + 2.5, w.z);
  }

  private updateProps(t: number) {
    for (const p of this.props) {
      const found = this.found.has(p.id);
      p.marker.position.set(p.x, groundY(p.x, p.z) + (found ? 2.4 : 2.6) + Math.sin(t * 2 + p.x) * 0.15, p.z);
      p.marker.rotation.y = t * 1.5;
      p.marker.scale.setScalar(found ? 0.6 : 1);
      (p.marker.material as THREE.MeshBasicMaterial).color.set(found ? "#7ddc8a" : "#ffd84a");
    }
  }

  private updateFocus() {
    let best: (Target & { x: number; z: number }) | null = null;
    if (this.driving) {
      best = { kind: "vehicle", id: "car-exit", label: "개츠비의 차", x: this.car.x, z: this.car.z };
    } else {
      let bestD = Infinity;
      const consider = (t: Target & { x: number; z: number }, range: number) => {
        const d = Math.hypot(t.x - this.pos.x, t.z - this.pos.z);
        if (d < range && d < bestD) {
          bestD = d;
          best = t;
        }
      };
      for (const w of this.walkers) {
        if (!w.id) continue;
        const label = this.data.characters.find((c) => c.id === w.id)?.label ?? w.id;
        consider({ kind: "character", id: w.id, label, x: w.x, z: w.z }, TALK_RANGE);
      }
      for (const p of this.props) consider({ kind: "object", id: p.id, label: p.label, x: p.x, z: p.z }, p.range);
      consider({ kind: "vehicle", id: "car", label: "개츠비의 차", x: this.car.x, z: this.car.z }, CAR_RANGE);
    }
    const chosen = best as (Target & { x: number; z: number }) | null;
    const key = chosen ? `${chosen.kind}:${chosen.id}` : "";
    this.focused = chosen;
    if (key !== this.focusKey) {
      this.focusKey = key;
      this.data.bridge.game.emit("focus", chosen && { kind: chosen.kind, id: chosen.id, label: chosen.label });
    }
    this.prompt.visible = !!chosen && !this.paused && !this.driving;
    if (chosen) this.prompt.position.set(chosen.x, groundY(chosen.x, chosen.z) + (chosen.kind === "character" ? 2.95 : 2.1), chosen.z);
  }

  private updateCamera(dt: number) {
    const target = this.driving
      ? new THREE.Vector3(this.car.x, 1.4, this.car.z)
      : new THREE.Vector3(this.pos.x, groundY(this.pos.x, this.pos.z) + 1.6, this.pos.z);
    // 운전 중 마우스를 놓고 있으면 카메라가 차 뒤로 돌아간다
    if (this.driving && performance.now() - this.lastMouse > 1500) {
      this.camYaw = lerpAngle(this.camYaw, this.car.yaw + (this.car.speed < -0.5 ? Math.PI : 0), Math.min(1, dt * 2.5));
    }
    const dist = this.driving ? Math.max(this.camDist, 9) : this.camDist;
    const h = Math.cos(this.camPitch) * dist;
    const desired = new THREE.Vector3(
      target.x - Math.sin(this.camYaw) * h,
      Math.max(target.y + Math.sin(this.camPitch) * dist, 0.6),
      target.z - Math.cos(this.camYaw) * h,
    );
    this.camera.position.lerp(desired, Math.min(1, dt * 10));
    this.camera.lookAt(target);
  }

  private drawMinimap() {
    const c = this.minimap.getContext("2d");
    if (!c) return;
    const S = 160;
    const scale = 0.9; // 1m = 0.9px
    const cx = this.driving ? this.car.x : this.pos.x;
    const cz = this.driving ? this.car.z : this.pos.z;
    const X = (x: number) => S / 2 + (x - cx) * scale;
    const Z = (z: number) => S / 2 + (z - cz) * scale;
    const rect = (b: { minX: number; maxX: number; minZ: number; maxZ: number }, color: string) => {
      c.fillStyle = color;
      c.fillRect(X(b.minX), Z(b.minZ), (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    };
    c.save();
    c.beginPath();
    c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = "#3f6b3e";
    c.fillRect(0, 0, S, S);
    c.fillStyle = "#1f4f78";
    c.fillRect(0, 0, S, Math.max(0, Z(SHORE_Z)));
    rect(ROAD, "#77736a");
    rect(DOCK, "#8a6a48");
    for (const b of [MANSION, TOWER, COTTAGE, NEIGHBOR, ...HOUSES]) rect(b, "#e6dccb");
    rect(POOL, "#5fb3d8");
    rect(STAGE, "#b33a3a");
    for (const p of this.props) {
      c.fillStyle = this.found.has(p.id) ? "#7ddc8a" : "#ffd84a";
      c.beginPath();
      c.arc(X(p.x), Z(p.z), 3.5, 0, Math.PI * 2);
      c.fill();
    }
    for (const w of this.walkers) {
      if (!w.id) continue;
      c.fillStyle = "#f2a83a";
      c.beginPath();
      c.arc(X(w.x), Z(w.z), 3, 0, Math.PI * 2);
      c.fill();
    }
    if (!this.driving) {
      c.fillStyle = "#efe2b4";
      c.fillRect(X(this.car.x) - 2.5, Z(this.car.z) - 2.5, 5, 5);
    }
    // 플레이어 화살표 (위쪽이 북쪽)
    const yaw = this.driving ? this.car.yaw : this.yaw;
    c.translate(S / 2, S / 2);
    c.rotate(-yaw + Math.PI);
    c.fillStyle = "#ffffff";
    c.strokeStyle = "#1b1b1b";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, -7);
    c.lineTo(5, 5);
    c.lineTo(0, 2);
    c.lineTo(-5, 5);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
    c.fillStyle = "rgba(255,250,240,.9)";
    c.font = "bold 11px sans-serif";
    c.fillText("N", S / 2 - 4, 13);
  }

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** 개발 모드 자동 점검용 */
  readonly debug = {
    teleport: (x: number, z: number) => {
      this.driving = false;
      this.player.root.visible = true;
      this.pos = { x, z };
    },
    state: () => ({ ...this.pos, driving: this.driving, speed: this.car.speed, focused: this.focusKey, area: this.area }),
    targets: () => [
      ...this.walkers.filter((w) => w.id).map((w) => ({ kind: "character", id: w.id!, x: w.x, z: w.z })),
      ...this.props.map((p) => ({ kind: "object", id: p.id, x: p.x, z: p.z })),
      { kind: "vehicle", id: "car", x: this.car.x, z: this.car.z },
    ],
  };

  destroy() {
    cancelAnimationFrame(this.raf);
    this.cleanups.splice(0).forEach((f) => f());
    this.resizeObserver.disconnect();
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) o.geometry.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.minimap.remove();
  }
}
