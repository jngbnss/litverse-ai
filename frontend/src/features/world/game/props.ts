/** 조사 오브젝트 모델. 모르는 id는 빛나는 받침대로 그린다 */
import * as THREE from "three";

import { boxMesh, makeCar, mat } from "./models";

export function makeProp(objectId: string): THREE.Group {
  const g = new THREE.Group();
  switch (objectId) {
    case "invitation": {
      const top = boxMesh(1, 0.08, 0.7, "#7a4e33");
      top.position.y = 0.8;
      const leg = boxMesh(0.12, 0.8, 0.12, "#5a3a26");
      leg.position.y = 0.4;
      const note = boxMesh(0.36, 0.02, 0.26, "#f4ecd8", "#3a3420");
      note.position.set(0, 0.86, 0);
      note.rotation.y = 0.3;
      const seal = boxMesh(0.08, 0.025, 0.08, "#b33a3a");
      seal.position.set(0.02, 0.87, 0.02);
      g.add(top, leg, note, seal);
      break;
    }
    case "fruit-crates": {
      const orange = new THREE.SphereGeometry(0.1, 6, 4);
      for (const [x, y, z] of [[-0.5, 0.3, 0], [0.5, 0.3, 0], [0, 0.9, 0], [0, 0.3, 0.8]]) {
        const crate = boxMesh(0.9, 0.6, 0.7, "#9a6a3c");
        crate.position.set(x, y, z);
        g.add(crate);
        for (let i = 0; i < 4; i++) {
          const o = new THREE.Mesh(orange, mat(i % 2 ? "#f08a24" : "#f2d43a"));
          o.position.set(x - 0.3 + i * 0.2, y + 0.35, z);
          g.add(o);
        }
      }
      break;
    }
    case "library-books": {
      const shelf = boxMesh(1.8, 2.2, 0.45, "#5a3a26");
      shelf.position.y = 1.1;
      g.add(shelf);
      const colors = ["#8c3b2f", "#2f5a7a", "#6b7a32", "#a8783a", "#e6dccb"];
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 9; i++) {
          const book = boxMesh(0.14, 0.38, 0.3, colors[(i * 3 + row) % 5]);
          book.position.set(-0.7 + i * 0.175, 0.35 + row * 0.5, 0.1);
          g.add(book);
        }
      }
      break;
    }
    case "orchestra": {
      for (const x of [-4, 0, 4]) {
        const stand = boxMesh(0.05, 1.1, 0.05, "#2a2420");
        stand.position.set(x, 1 + 0.55, -2);
        const sheet = boxMesh(0.5, 0.35, 0.03, "#e9e4d4");
        sheet.position.set(x, 1 + 1.15, -1.98);
        sheet.rotation.x = -0.4;
        g.add(stand, sheet);
      }
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 12), mat("#c9a24a"));
      drum.position.set(5.5, 1.25, -3.5);
      const bass = boxMesh(0.5, 1.6, 0.3, "#7a4a2a");
      bass.position.set(-5.5, 1.8, -3.5);
      g.add(drum, bass);
      break;
    }
    case "ditch-coupe": {
      // 바퀴 하나가 떨어져 나간 채 도랑에 박힌 쿠페
      const { root, wheels } = makeCar("#2f3d5a", "#8a8a8a");
      wheels[0].visible = false;
      root.rotation.z = 0.18;
      root.position.y = -0.2;
      const lost = wheels[0].clone();
      lost.visible = true;
      lost.position.set(2.4, 0.15, 1.5);
      lost.rotation.set(0, 0, 0);
      g.add(root, lost);
      break;
    }
    default: {
      const base = boxMesh(0.8, 0.8, 0.8, "#d8d0bf");
      base.position.y = 0.4;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), mat("#f5c542", "#a07a10"));
      gem.position.y = 1.1;
      g.add(base, gem);
    }
  }
  return g;
}
