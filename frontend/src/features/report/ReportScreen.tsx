import { useEffect, useState } from "react";

import { Badge } from "../../components/Badge";
import { CitationList } from "../../components/CitationList";
import ui from "../../components/ui.module.css";
import { api } from "../../services/api";
import { useSession } from "../../store/session";
import type { Report } from "../../types/api";
import s from "../screens.module.css";

/** 화면 6: 탐험 기록 — 확인한 사실 / 작품 해석 / 가상 분기를 섞지 않고 나란히 */
export function ReportScreen() {
  const { session, scene, reset } = useSession();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    api.report(session.session_id).then(setReport).catch((e: Error) => setError(e.message));
  }, [session]);

  if (error) return <p className={s.error}>{error}</p>;
  if (!report || !scene) return <p className={s.muted}>기록을 정리하는 중…</p>;
  const name = (id: string) => scene.characters.find((c) => c.character_id === id)?.display_name_ko ?? id;
  const objectName = (id: string) => scene.objects.find((o) => o.object_id === id)?.name_ko ?? id;

  return (
    <div className={s.stack}>
      <div>
        <div className={s.eyebrow}>탐험 기록</div>
        <h1 className={s.title}>{report.scene.title_ko}</h1>
        <div className={s.row}>
          <span className={s.muted}>만난 인물:</span>
          {report.characters_met.length === 0 && <span className={s.muted}>없음</span>}
          {report.characters_met.map((c) => (
            <span key={c.character_id} className={s.chip}>
              {c.display_name_ko} · 질문 {c.turns}개
            </span>
          ))}
          <span className={s.muted}>조사한 물건:</span>
          {[...new Set(report.discoveries)].map((d) => (
            <span key={d} className={s.chip}>
              {objectName(d)}
            </span>
          ))}
        </div>
      </div>

      <div className={s.grid3}>
        <section className={ui.panel}>
          <h3>
            <Badge type="CANON" /> 확인한 원작 사실
          </h3>
          {report.canon.facts.length === 0 && <p className={s.muted}>아직 확인한 사실이 없습니다.</p>}
          <ul className={s.list}>
            {report.canon.facts.map((f) => (
              <li key={f.fact_id}>
                {f.statement_ko}
                <div className={`${s.muted} ${s.small}`}>근거: {f.passage_ids.join(", ")}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className={ui.panel}>
          <h3>
            <Badge type="INTERPRETATION" /> 작품 해석
          </h3>
          <p className={`${s.muted} ${s.small}`}>
            정답이 아니라, 원문을 근거로 한 여러 읽기 중 하나입니다.
          </p>
          <ul className={s.list}>
            {report.interpretation.claims.map((c, i) => (
              <li key={`c-${i}`}>
                <strong>{name(c.character_id)}의 관점:</strong> {c.text}
              </li>
            ))}
            {report.interpretation.team.map((f) => (
              <li key={f.fact_id}>
                <strong>함께 생각해 볼 해석:</strong> {f.statement_ko}
              </li>
            ))}
          </ul>
        </section>

        <section className={`${ui.panel} ${s.whatIfCard}`}>
          <h3>
            <Badge type="WHAT_IF" /> 내가 만든 가상 분기
          </h3>
          {report.what_if.length === 0 && <p className={s.muted}>만든 분기가 없습니다.</p>}
          {report.what_if.map((b) => (
            <div key={b.branch_id} className={s.stack} style={{ gap: 6 }}>
              {b.events
                .filter((e) => e.kind === "choice")
                .map((e, i) => (
                  <div key={i} className={s.event}>
                    {String(e.payload.premise_ko)}
                  </div>
                ))}
              {b.turns.map((t, i) => (
                <div key={i} className={s.small}>
                  <strong>{name(t.character_id)}:</strong> {t.reply}
                </div>
              ))}
              <p className={`${s.muted} ${s.small}`}>원작 사실과 별도로 저장되었습니다.</p>
            </div>
          ))}
        </section>
      </div>

      <div className={s.grid2}>
        <section className={ui.panel}>
          <h3>발견한 관계</h3>
          <ul className={s.list}>
            {report.relations.map((r) => (
              <li key={r.id}>
                {name(r.source)} → {name(r.target)}: <strong>{r.label_ko}</strong>{" "}
                <Badge type={r.kind === "interpretation" ? "INTERPRETATION" : "CANON"} />
              </li>
            ))}
          </ul>
          <h3 style={{ marginTop: 16 }}>관련 원문</h3>
          <CitationList items={report.seen_passages.slice(0, 8)} />
        </section>
        <section className={ui.panel}>
          <h3>토론 질문</h3>
          <ol>
            {report.discussion_questions_ko.map((q) => (
              <li key={q} style={{ marginBottom: 8 }}>
                {q}
              </li>
            ))}
          </ol>
          <button className={ui.button} onClick={reset}>
            처음으로
          </button>
        </section>
      </div>
    </div>
  );
}
