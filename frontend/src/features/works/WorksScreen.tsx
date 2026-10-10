import { useEffect, useState } from "react";

import ui from "../../components/ui.module.css";
import { api } from "../../services/api";
import { useSession } from "../../store/session";
import type { WorkDetail } from "../../types/api";
import s from "../screens.module.css";

/** 화면 1: 작품 선택 — 작품 소개, 저자, 배경, 저작권·출처, 탐험 시작 */
export function WorksScreen() {
  const [works, setWorks] = useState<WorkDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { start, busy } = useSession();

  useEffect(() => {
    api
      .works()
      .then((list) => Promise.all(list.map((w) => api.work(w.work_id))))
      .then(setWorks)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className={s.error}>작품 목록을 불러오지 못했습니다: {error}</p>;
  if (!works) return <p className={s.muted}>작품을 불러오는 중…</p>;

  return (
    <div className={s.stack}>
      <div>
        <div className={s.eyebrow}>작품 선택</div>
        <h1 className={s.title}>어느 이야기 속으로 들어갈까요?</h1>
        <p className={s.muted}>
          등장인물은 원문에 근거해서만 답합니다. 모든 답변에는 원작 사실, 해석, AI 가상 분기 중
          무엇인지 표시됩니다.
        </p>
      </div>
      {works.map((w) => (
        <article key={w.work_id} className={ui.panel}>
          <div className={s.grid2}>
            <div>
              <h2 className="serif">
                {w.title} <span className={s.muted}>· {w.title_ko}</span>
              </h2>
              <p className={s.muted}>
                {w.author} · {w.published}
              </p>
              <p>{w.summary_ko}</p>
              <ul className={s.list}>
                {w.scenes.map((sc) => (
                  <li key={sc.scene_id}>
                    <strong>{sc.title_ko}</strong>{" "}
                    <span className={s.muted}>— {sc.chapter}장 · 예상 체험 10~15분</span>
                  </li>
                ))}
              </ul>
              <div className={s.row} style={{ marginTop: 16 }}>
                <button
                  className={`${ui.button} ${ui.primary}`}
                  disabled={busy}
                  onClick={() => start(w)}
                >
                  {busy ? "준비 중…" : "탐험 시작"}
                </button>
              </div>
            </div>
            <aside className={ui.panel} style={{ background: "var(--surface-2)" }}>
              <h3>저작권 · 출처</h3>
              <dl className={s.kv}>
                <dt>원문</dt>
                <dd>
                  영어 원문 ({w.language}), {w.published}년
                </dd>
                <dt>출처</dt>
                <dd>
                  <a href={w.source.url} target="_blank" rel="noreferrer">
                    {w.source.name}
                  </a>{" "}
                  <span className={s.small}>({w.source.edition})</span>
                </dd>
                {Object.entries(w.license.jurisdictions).map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <dt>{k}</dt>
                    <dd>{v === "verified" ? "퍼블릭 도메인 확인" : v}</dd>
                  </div>
                ))}
                <dt>번역·이미지</dt>
                <dd>기존 번역문·영화 이미지 사용 안 함. 한국어 요약과 그림은 팀 자체 제작</dd>
              </dl>
            </aside>
          </div>
        </article>
      ))}
    </div>
  );
}
