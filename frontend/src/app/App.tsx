import { DialogueScreen } from "../features/dialogue/DialogueScreen";
import { GraphScreen } from "../features/relationships/GraphScreen";
import { ReportScreen } from "../features/report/ReportScreen";
import { WhatIfScreen } from "../features/what-if/WhatIfScreen";
import { WorksScreen } from "../features/works/WorksScreen";
import { WorldScreen } from "../features/world/WorldScreen";
import { type Screen, useSession } from "../store/session";
import styles from "./App.module.css";

const TABS: { id: Screen; label: string }[] = [
  { id: "world", label: "탐험" },
  { id: "dialogue", label: "대화" },
  { id: "graph", label: "관계도" },
  { id: "what-if", label: "가상 분기" },
  { id: "report", label: "탐험 기록" },
];

export function App() {
  const { screen, go, scene, session, work, error, reset } = useSession();
  const mode = session?.mode ?? "canon";

  return (
    <div className={styles.shell} data-mode={mode}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button className={styles.brand} onClick={reset}>
            Lit<span>Verse</span> AI
          </button>
          {work && scene && (
            <span className={styles.meta}>
              {work.title} · {scene.title_ko} · {scene.now_label_ko}
            </span>
          )}
          <span className={styles.spacer} />
          {session && (
            <span className={styles.mode} data-mode={mode} data-testid="mode-badge">
              {mode === "what_if" ? "AI WHAT-IF 모드" : "원작 모드"}
            </span>
          )}
        </div>
        {session && (
          <nav className={styles.nav}>
            {TABS.map((t) => (
              <button
                key={t.id}
                className={styles.tab}
                aria-current={screen === t.id ? "page" : undefined}
                onClick={() => go(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
        {mode === "what_if" && (
          <div className={styles.banner}>
            AI WHAT-IF · 원작과 다른 가정의 세계입니다. 여기서 생긴 일은 원작 사실이 아닙니다.
          </div>
        )}
      </header>
      <main className={styles.main}>
        {screen === "works" && <WorksScreen />}
        {screen === "world" && <WorldScreen />}
        {screen === "dialogue" && <DialogueScreen />}
        {screen === "graph" && <GraphScreen />}
        {screen === "what-if" && <WhatIfScreen />}
        {screen === "report" && <ReportScreen />}
      </main>
      {error && <div className={styles.toast}>{error}</div>}
    </div>
  );
}
