import { Badge } from "../../components/Badge";
import { Portrait } from "../../components/Portrait";
import ui from "../../components/ui.module.css";
import { useSession } from "../../store/session";
import type { CharacterReplyPayload } from "./types";
import s from "../screens.module.css";

/** 화면 5: 가상 분기 — 원작에서 벗어나는 선택, 바뀐 사건, 인물 반응, AI WHAT-IF 표시 */
export function WhatIfScreen() {
  const { scene, session, branch, startBranch, exitBranch, busy, go } = useSession();
  if (!scene || !session) return null;
  const name = (id: string | null) =>
    scene.characters.find((c) => c.character_id === id)?.display_name_ko ?? id ?? "";

  if (!branch) {
    return (
      <div className={s.stack}>
        <div>
          <div className={s.eyebrow}>AI WHAT-IF</div>
          <h1 className={s.title}>원작과 다른 선택을 해 보기</h1>
          <p className={s.muted}>
            가상 분기는 원작 데이터와 따로 저장됩니다. 분기 안에서 생긴 일은 모두 AI WHAT-IF로
            표시되고, 원작 사실로 기록되지 않습니다.
          </p>
        </div>
        {scene.branches.map((b) => (
          <article key={b.branch_id} className={`${ui.panel} ${s.whatIfCard}`}>
            <Badge type="WHAT_IF" />
            <h3 style={{ marginTop: 8 }}>{b.title_ko}</h3>
            <p>{b.premise_ko}</p>
            <p className={`${s.muted} ${s.small}`}>
              갈라지는 시점: 파티 자정 무렵 · 영향받는 인물: {b.affected_characters.map(name).join(", ")}
            </p>
            <button className={`${ui.button} ${ui.primary}`} disabled={busy} onClick={() => startBranch(b.branch_id)}>
              {busy ? "분기를 만드는 중…" : "이 가정으로 들어가기"}
            </button>
          </article>
        ))}
      </div>
    );
  }

  const choice = branch.events.find((e) => e.kind === "choice");
  const changes = branch.events.filter((e) => e.kind === "relation_change");
  const reactions = branch.events.filter((e) => e.kind === "reaction");

  return (
    <div className={s.stack}>
      <section className={`${ui.panel} ${s.whatIfCard}`}>
        <Badge type="WHAT_IF" />
        <h2 style={{ marginTop: 8 }}>{branch.title_ko}</h2>
        <p>{String(choice?.payload.premise_ko ?? "")}</p>
        <div className={s.row}>
          <button className={`${ui.button} ${ui.primary}`} onClick={() => go("dialogue")}>
            분기 세계에서 대화하기
          </button>
          <button className={ui.button} onClick={() => go("graph")}>
            바뀐 관계도 보기
          </button>
          <button className={ui.button} onClick={() => exitBranch()}>
            원작으로 돌아가기
          </button>
        </div>
      </section>

      <div className={s.grid2}>
        <section className={ui.panel}>
          <h3>인물 반응</h3>
          <ul className={s.list}>
            {reactions.map((e, i) => {
              const reply = e.payload.reply as CharacterReplyPayload;
              return (
                <li key={i} className={s.answer}>
                  <Portrait id={e.character_id ?? ""} size={36} label={name(e.character_id)} />
                  <div className={s.bubble}>
                    <strong>{name(e.character_id)}</strong>
                    <div>{reply.reply}</div>
                    {!e.consistent && <div className={s.error}>일관성 검사 실패</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <aside className={ui.panel}>
          <h3>바뀐 사건과 관계</h3>
          <ul className={s.list}>
            <li className={s.event}>
              <strong>새 사건</strong> — {String(choice?.payload.premise_ko ?? "")}
            </li>
            {changes.map((e, i) => (
              <li key={i} className={s.event}>
                {name(String(e.payload.source))} → {name(String(e.payload.target))}:{" "}
                <strong>{String(e.payload.label_ko)}</strong>
              </li>
            ))}
          </ul>
          <p className={`${s.muted} ${s.small}`}>
            원작 스냅샷 {branch.snapshot.canon_fingerprint.slice(0, 12)}… — 분기를 만드는 동안 원작
            데이터가 바뀌지 않았음을 서버가 확인했습니다.
          </p>
        </aside>
      </div>
    </div>
  );
}
