import { useState } from "react";

import { Badge } from "../../components/Badge";
import { CitationList } from "../../components/CitationList";
import { Portrait } from "../../components/Portrait";
import ui from "../../components/ui.module.css";
import { useSession } from "../../store/session";
import s from "../screens.module.css";
import { GardenArt } from "./GardenArt";

// 장면 위 인물 위치 (%)
const PLACES: Record<string, { x: number; y: number }> = {
  gatsby: { x: 40, y: 58 },
  jordan: { x: 49, y: 82 },
  nick: { x: 23, y: 84 },
};

/** 화면 2: 문학 세계 탐험 — 장면 공간, 오브젝트, 인물, 시간과 장소, 모드 */
export function WorldScreen() {
  const { scene, discoveries, inspect, go, setCharacter } = useSession();
  const [active, setActive] = useState<string | null>(null);
  if (!scene) return null;

  const current = active ? discoveries[active] : null;
  const found = Object.keys(discoveries).length;

  return (
    <div className={s.grid2}>
      <div className={s.stack}>
        <div className={s.stage}>
          <GardenArt />
          {scene.objects.map((o) => (
            <button
              key={o.object_id}
              className={s.hotspot}
              style={{ left: `${o.hotspot.x}%`, top: `${o.hotspot.y}%` }}
              data-found={o.object_id in discoveries}
              data-active={o.object_id === active}
              onClick={async () => {
                setActive(o.object_id);
                await inspect(o.object_id);
              }}
            >
              🔍 {o.name_ko}
            </button>
          ))}
          {scene.characters.map((c) => {
            const p = PLACES[c.character_id] ?? { x: 50, y: 80 };
            return (
              <button
                key={c.character_id}
                className={s.person}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onClick={() => {
                  setCharacter(c.character_id);
                  go("dialogue");
                }}
                aria-label={`${c.display_name_ko}와 대화하기`}
              >
                <Portrait id={c.character_id} size={44} label={c.display_name_ko} />
                {c.display_name_ko.split(" ")[0]}
              </button>
            );
          })}
        </div>
        <p className={`${s.muted} ${s.small}`}>
          🔍 표시를 눌러 조사하고, 인물을 눌러 대화하세요. 발견 {found}/{scene.objects.length}
        </p>
      </div>

      <div className={s.stack}>
        <section className={ui.panel}>
          {current ? (
            <>
              <div className={s.eyebrow}>조사</div>
              <h3>{current.name_ko}</h3>
              <p>{current.description_ko}</p>
              <ul className={s.claims}>
                {current.facts.map((f) => (
                  <li key={f.fact_id}>
                    <Badge type={f.kind === "canon" ? "CANON" : "INTERPRETATION"} />
                    <span>{f.statement_ko}</span>
                  </li>
                ))}
              </ul>
              <CitationList items={current.passages.map((p) => ({ ...p, type: "CANON" as const }))} />
            </>
          ) : active ? (
            <p className={s.muted}>조사 중…</p>
          ) : (
            <>
              <div className={s.eyebrow}>{scene.now_label_ko}</div>
              <h3>{scene.title_ko}</h3>
              <p className={s.muted}>
                웨스트에그, 개츠비 저택의 정원. 파티가 끝나 가는 새벽입니다. 오늘 밤 처음 초대받은
                닉의 눈으로 이 공간을 둘러보세요.
              </p>
            </>
          )}
        </section>
        <section className={ui.panel}>
          <h3>대화 목표</h3>
          <ul className={s.list}>
            {scene.dialogue_goals.map((g) => {
              const c = scene.characters.find((x) => x.character_id === g.character_id);
              return (
                <li key={g.character_id} className={s.row}>
                  <Portrait id={g.character_id} size={28} label={c?.display_name_ko ?? ""} />
                  <span>
                    <strong>{c?.display_name_ko}</strong> — {g.goal_ko}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
