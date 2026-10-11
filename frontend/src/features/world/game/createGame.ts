import Phaser from "phaser";

import { type GardenData, GardenScene } from "./GardenScene";

/** 화면 크기 480x300, 카메라 2배 확대. 컨테이너 너비에 맞춰 늘어난다 */
export function createGame(parent: HTMLElement, data: GardenData): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 480,
    height: 300,
    pixelArt: true,
    banner: false,
    audio: { noAudio: true },
    physics: { default: "arcade", arcade: { debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  });
  game.scene.add("garden", GardenScene, true, data);
  return game;
}
