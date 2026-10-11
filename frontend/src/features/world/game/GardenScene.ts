import Phaser from "phaser";

import type { GameBridge, Target } from "./bridge";
import { bakeCharacters, CELL_H } from "./sprites";
import {
  bakeObject,
  bakeTree,
  bakeWorld,
  GUESTS,
  HOMES,
  MUSICIANS,
  OBSTACLES,
  SPAWN,
  toWorld,
  TREES,
  WORLD_H,
  WORLD_W,
} from "./world";

export interface GardenData {
  bridge: GameBridge;
  characters: { id: string; label: string }[];
  objects: { id: string; label: string; hotspot: { x: number; y: number } }[];
  found: string[];
}

type Dir = "down" | "up" | "side";
const SPEED = 80;
const NPC_SPEED = 26;
const TALK_RANGE = 26;
const INSPECT_RANGE = 30;

interface Walker {
  sprite: Phaser.Physics.Arcade.Sprite;
  key: string;
  home: { x: number; y: number; r: number };
  goal: { x: number; y: number } | null;
  wait: number;
  stuck: number;
}

interface Interactable extends Target {
  x: number;
  y: number;
  range: number;
  walker?: Walker;
  marker?: Phaser.GameObjects.Text;
}

function face(sprite: Phaser.Physics.Arcade.Sprite, key: string, dx: number, dy: number, moving: boolean) {
  const dir: Dir = Math.abs(dx) > Math.abs(dy) ? "side" : dy < 0 ? "up" : "down";
  if (dir === "side") sprite.setFlipX(dx < 0);
  if (moving) sprite.anims.play(`${key}-${dir}`, true);
  else {
    sprite.anims.stop();
    sprite.setFrame(`${dir}0`);
  }
}

export class GardenScene extends Phaser.Scene {
  private data_!: GardenData;
  private player!: Phaser.Physics.Arcade.Sprite;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private walkers: Walker[] = [];
  private targets: Interactable[] = [];
  private focused: Interactable | null = null;
  private prompt!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private moveTo: { x: number; y: number; then?: Interactable } | null = null;
  private paused = false;
  private unsubscribe: (() => void)[] = [];

  constructor() {
    super("garden");
  }

  init(data: GardenData) {
    this.data_ = data;
  }

  create() {
    const { bridge } = this.data_;
    bakeWorld(this);
    bakeTree(this);
    bakeCharacters(this);

    this.add.image(0, 0, "garden").setOrigin(0).setDepth(-10000);
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    const walls = this.physics.add.staticGroup();
    for (const r of OBSTACLES) {
      const zone = this.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h);
      walls.add(zone);
    }
    for (const t of TREES) this.add.image(t.x, t.y + 2, "tree").setOrigin(0.5, 1).setDepth(t.y);

    // 조사 오브젝트
    for (const o of this.data_.objects) {
      const p = toWorld(o.hotspot);
      const { key, solid } = bakeObject(this, o.id);
      this.add.image(p.x, p.y, key).setOrigin(0.5, 1).setDepth(p.y);
      if (solid) walls.add(this.add.zone(p.x + solid.x + solid.w / 2, p.y + solid.y + solid.h / 2, solid.w, solid.h));
      const marker = this.add
        .text(p.x, p.y - 30, "!", { fontFamily: "monospace", fontSize: "12px", color: "#ffe066", stroke: "#3a2a10", strokeThickness: 3 })
        .setOrigin(0.5)
        .setDepth(20000);
      this.tweens.add({ targets: marker, y: p.y - 34, yoyo: true, repeat: -1, duration: 600, ease: "Sine.inOut" });
      this.targets.push({ kind: "object", id: o.id, label: o.label, x: p.x, y: p.y - 4, range: INSPECT_RANGE, marker });
    }
    this.markFound(this.data_.found);

    // 악단과 손님
    for (const m of MUSICIANS) this.add.sprite(m.x, m.y, m.key, "down0").setOrigin(0.5, 1).setDepth(m.y);
    for (const g of GUESTS) this.spawnWalker(g.key, g, walls);

    // 대화 인물
    for (const c of this.data_.characters) {
      const home = HOMES[c.id];
      if (!home) continue;
      const w = this.spawnWalker(c.id, home, walls);
      this.add
        .text(0, 0, c.label, { fontFamily: "sans-serif", fontSize: "8px", color: "#ffffff", stroke: "#1b1b1b", strokeThickness: 2, resolution: 4 })
        .setOrigin(0.5, 1)
        .setDepth(20000)
        .setName(`label-${c.id}`)
        .texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.targets.push({ kind: "character", id: c.id, label: c.label, x: home.x, y: home.y, range: TALK_RANGE, walker: w });
    }

    // 플레이어
    this.player = this.physics.add.sprite(SPAWN.x, SPAWN.y, "player", "side0").setOrigin(0.5, 1);
    this.player.setCollideWorldBounds(true);
    this.player.body!.setSize(8, 5).setOffset(2, CELL_H - 5);
    this.physics.add.collider(this.player, walls);

    // 상호작용 안내: 머리 위 작은 E 키 (글 안내는 React 화면 아래쪽에 뜬다)
    this.promptText = this.add.text(0, 0, "E", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#1b1b1b",
      backgroundColor: "#fffaf0",
      padding: { x: 2, y: 1 },
      resolution: 4,
    });
    this.promptText.setOrigin(0.5, 1);
    this.promptText.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.prompt = this.add.container(0, 0, [this.promptText]).setDepth(30000).setVisible(false);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.setZoom(2);
    cam.setRoundPixels(true);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setBackgroundColor("#2c5631");

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ENTER") as Record<string, Phaser.Input.Keyboard.Key>;
    for (const k of ["E", "SPACE", "ENTER"]) this.keys[k].on("down", () => this.interact());

    // 클릭·터치: 대상 근처면 가서 상호작용, 아니면 그 자리로 걸어간다
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.paused) return;
      const hit = this.targets.find((t) => Phaser.Math.Distance.Between(p.worldX, p.worldY, t.x, t.y - 6) < 14);
      this.moveTo = hit ? { x: hit.x, y: hit.y + 10, then: hit } : { x: p.worldX, y: p.worldY };
    });

    this.unsubscribe.push(
      bridge.ui.on("paused", (paused) => {
        this.paused = paused;
        this.moveTo = null;
        this.player.setVelocity(0);
        // 대화창에 글자를 칠 수 있도록 키 가로채기를 끈다
        if (paused) kb.disableGlobalCapture();
        else kb.enableGlobalCapture();
        kb.enabled = !paused;
        if (!paused) kb.resetKeys();
      }),
      bridge.ui.on("found", (ids) => this.markFound(ids)),
    );
    const off = () => this.unsubscribe.splice(0).forEach((u) => u());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.events.once(Phaser.Scenes.Events.DESTROY, off);
  }

  private spawnWalker(key: string, home: { x: number; y: number; r: number }, walls: Phaser.Physics.Arcade.StaticGroup): Walker {
    const sprite = this.physics.add.sprite(home.x, home.y, key, "down0").setOrigin(0.5, 1);
    sprite.body!.setSize(8, 5).setOffset(2, CELL_H - 5);
    sprite.setCollideWorldBounds(true);
    this.physics.add.collider(sprite, walls);
    const w: Walker = { sprite, key, home, goal: null, wait: Phaser.Math.Between(300, 2500), stuck: 0 };
    this.walkers.push(w);
    return w;
  }

  private markFound(ids: string[]) {
    for (const t of this.targets) {
      if (t.kind === "object" && t.marker) t.marker.setText(ids.includes(t.id) ? "✓" : "!").setColor(ids.includes(t.id) ? "#9be59b" : "#ffe066");
    }
  }

  private interact() {
    if (this.paused || !this.focused) return;
    const { kind, id, label } = this.focused;
    this.data_.bridge.game.emit("interact", { kind, id, label });
  }

  update(_time: number, delta: number) {
    this.movePlayer();
    for (const w of this.walkers) this.moveWalker(w, delta);
    this.updateFocus();
    for (const t of this.targets) {
      if (!t.walker) continue;
      t.x = t.walker.sprite.x;
      t.y = t.walker.sprite.y;
      const label = this.children.getByName(`label-${t.id}`) as Phaser.GameObjects.Text | null;
      label?.setPosition(Math.round(t.x), Math.round(t.y - CELL_H - 1));
    }
    for (const obj of [this.player, ...this.walkers.map((w) => w.sprite)]) obj.setDepth(obj.y);
  }

  private movePlayer() {
    const k = this.keys;
    let dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (this.paused) dx = dy = 0;
    if (dx || dy) this.moveTo = null;
    else if (this.moveTo) {
      const ox = this.moveTo.x - this.player.x;
      const oy = this.moveTo.y - this.player.y;
      const reach = this.moveTo.then ? this.moveTo.then.range - 6 : 3;
      if (Math.hypot(ox, oy) < reach) {
        const then = this.moveTo.then;
        this.moveTo = null;
        if (then) this.data_.bridge.game.emit("interact", { kind: then.kind, id: then.id, label: then.label });
      } else {
        dx = ox;
        dy = oy;
      }
    }
    const len = Math.hypot(dx, dy);
    if (len) this.player.setVelocity((dx / len) * SPEED, (dy / len) * SPEED);
    else this.player.setVelocity(0);
    if (len) face(this.player, "player", dx, dy, true);
    else if (this.player.anims.isPlaying) face(this.player, "player", 0, 1, false);
  }

  private moveWalker(w: Walker, delta: number) {
    const s = w.sprite;
    const talking = this.focused?.walker === w;
    if (talking) {
      s.setVelocity(0);
      face(s, w.key, this.player.x - s.x, this.player.y - s.y, false);
      return;
    }
    if (!w.goal) {
      w.wait -= delta;
      if (w.wait <= 0) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * w.home.r;
        w.goal = { x: w.home.x + Math.cos(a) * d, y: w.home.y + Math.sin(a) * d };
        w.stuck = 0;
      }
      return;
    }
    const dx = w.goal.x - s.x;
    const dy = w.goal.y - s.y;
    const dist = Math.hypot(dx, dy);
    const body = s.body as Phaser.Physics.Arcade.Body;
    w.stuck = body.blocked.none ? 0 : w.stuck + delta;
    if (dist < 2 || w.stuck > 400) {
      w.goal = null;
      w.wait = Phaser.Math.Between(1200, 4000);
      s.setVelocity(0);
      face(s, w.key, dx, dy, false);
      return;
    }
    s.setVelocity((dx / dist) * NPC_SPEED, (dy / dist) * NPC_SPEED);
    face(s, w.key, dx, dy, true);
  }

  private updateFocus() {
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const t of this.targets) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y);
      if (d < t.range && d < bestDist) {
        best = t;
        bestDist = d;
      }
    }
    if (best !== this.focused) {
      this.focused = best;
      this.data_.bridge.game.emit("focus", best && { kind: best.kind, id: best.id, label: best.label });
    }
    this.prompt.setVisible(!!best && !this.paused);
    if (best) this.prompt.setPosition(Math.round(best.x), Math.round(best.y - CELL_H - (best.kind === "character" ? 11 : 16)));
  }
}
