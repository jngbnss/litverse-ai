import { OpenWorld, type WorldData } from "./OpenWorld";

/** 탐험 화면의 3D 오픈월드를 host 안에 띄운다 */
export function createGame(host: HTMLElement, data: WorldData): OpenWorld {
  return new OpenWorld(host, data);
}
