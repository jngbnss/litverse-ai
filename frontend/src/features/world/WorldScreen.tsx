import { useEffect, useRef, useState } from "react";

import { Badge } from "../../components/Badge";
import { CitationList } from "../../components/CitationList";
import { shortName } from "../../components/names";
import { Portrait } from "../../components/Portrait";
import ui from "../../components/ui.module.css";
import { useSession } from "../../store/session";
import { EMOTION_KO, SUGGESTIONS, TurnView } from "../dialogue/DialogueScreen";
import { useDialogue } from "../dialogue/useDialogue";
import s from "../screens.module.css";
import { gardenBridge } from "./game/gardenBridge";
import type { Target } from "./game/bridge";
import w from "./world.module.css";

/** 화면 2: 문학 세계 탐험 — 정원을 걸어 다니며 인물에게 말을 걸고 오브젝트를 조사한다 */
export function WorldScreen() {
  const { scene, discoveries, inspect, setCharacter } = useSession();
  const host = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Target | null>(null);
  const [focus, setFocus] = useState<Target | null>(null);
  const [loadError, setLoadError] = useState(false);
  const found = Object.keys(discoveries);

  // 게임은 필요할 때만 불러온다 (Phaser는 무겁고, 테스트 환경에는 캔버스가 없다)
  useEffect(() => {
    if (!scene || !host.current) return;
    let game: { destroy: (removeCanvas: boolean) => void } | null = null;
    let cancelled = false;
    import("./game/createGame")
      .then(({ createGame }) => {
        if (cancelled || !host.current) return;
        game = createGame(host.current, {
          bridge: gardenBridge,
          characters: scene.characters.map((c) => ({
            id: c.character_id,
            label: shortName(c.character_id, c.display_name_ko),
          })),
          objects: scene.objects.map((o) => ({ id: o.object_id, label: o.name_ko, hotspot: o.hotspot })),
          found: Object.keys(useSession.getState().discoveries),
        });
        // 개발 모드에서만: 브라우저 자동 점검에서 게임 상태를 들여다볼 수 있게 둔다
        if (import.meta.env.DEV) (window as unknown as { __litverseGame?: unknown }).__litverseGame = game;
      })
      .catch(() => setLoadError(true));
    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [scene]);

  useEffect(() => {
    const offFocus = gardenBridge.game.on("focus", setFocus);
    const offInteract = gardenBridge.game.on("interact", (t) => {
      setOpen(t);
      if (t.kind === "character") setCharacter(t.id);
      else void inspect(t.id);
    });
    return () => {
      offFocus();
      offInteract();
    };
  }, [inspect, setCharacter]);

  useEffect(() => {
    gardenBridge.ui.emit("paused", open !== null);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    gardenBridge.ui.emit("found", found);
  }, [found.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => gardenBridge.ui.emit("paused", false), []);

  if (!scene) return null;

  return (
    <div className={w.layout}>
      <div className={w.stageWrap}>
        <div ref={host} className={w.stage} aria-label="개츠비 저택 정원" />
        {loadError && <p className={w.loadError}>게임 화면을 불러오지 못했어요. 새로고침해 주세요.</p>}
        {!open && focus && (
          <div className={w.hint} aria-live="polite">
            {focus.kind === "character" ? `${focus.label}에게 말을 걸 수 있어요 (E)` : `${focus.label} 조사하기 (E)`}
          </div>
        )}
        {open?.kind === "character" && <TalkBox characterId={open.id} onClose={() => setOpen(null)} />}
        {open?.kind === "object" && <InspectBox objectId={open.id} label={open.label} onClose={() => setOpen(null)} />}
      </div>

      <aside className={s.stack}>
        <section className={ui.panel}>
          <div className={s.eyebrow}>{scene.now_label_ko}</div>
          <h3>{scene.title_ko}</h3>
          <p className={`${s.muted} ${s.small}`}>
            웨스트에그, 개츠비 저택의 정원. 오늘 밤 처음 초대받은 손님이 되어 파티장을 돌아다녀 보세요.
          </p>
          <ul className={w.keys}>
            <li><kbd>WASD</kbd>·<kbd>방향키</kbd> 이동 (클릭해도 걸어가요)</li>
            <li><kbd>E</kbd>·<kbd>Space</kbd> 말 걸기 · 조사하기</li>
            <li><kbd>Esc</kbd> 창 닫기</li>
          </ul>
        </section>
        <section className={ui.panel}>
          <h3>
            단서 {found.length}/{scene.objects.length}
          </h3>
          <ul className={w.clues}>
            {scene.objects.map((o) =>
              o.object_id in discoveries ? (
                <li key={o.object_id}>
                  <button className={s.linkButton} onClick={() => setOpen({ kind: "object", id: o.object_id, label: o.name_ko })}>
                    ✓ {o.name_ko}
                  </button>
                </li>
              ) : (
                <li key={o.object_id} className={s.muted}>
                  ? 아직 못 찾은 단서
                </li>
              ),
            )}
          </ul>
        </section>
        <section className={ui.panel}>
          <h3>대화 목표</h3>
          <ul className={s.list}>
            {scene.dialogue_goals.map((g) => {
              const c = scene.characters.find((x) => x.character_id === g.character_id);
              return (
                <li key={g.character_id} className={s.row} style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <Portrait id={g.character_id} size={28} label={c?.display_name_ko ?? ""} />
                  <span>
                    <strong>{c?.display_name_ko}</strong> — {g.goal_ko}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
}

/** 게임 화면 아래쪽에 뜨는 대화창 */
function TalkBox({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const { scene } = useSession();
  const { mode, visible, waiting, send } = useDialogue(characterId);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const character = scene?.characters.find((c) => c.character_id === characterId);

  // 중괄호로 감싼다: 최신 브라우저의 scrollIntoView는 Promise를 돌려주는데, React가 이를 정리 함수로 오해한다
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    chatEnd.current?.scrollIntoView?.({ block: "end" });
  }, [visible]);
  if (!character) return null;

  const last = [...visible].reverse().find((t) => t.reply);
  const emotion = last?.reply?.emotion ?? character.default_emotion;
  const ask = (q: string) => {
    if (send(q)) setText("");
  };

  return (
    <section className={w.box} role="dialog" aria-label={`${character.display_name_ko}와의 대화`}>
      <header className={w.boxHead}>
        <Portrait id={characterId} size={40} label={character.display_name_ko} />
        <div>
          <strong>{character.display_name_ko}</strong>
          <div className={`${s.muted} ${s.small}`}>
            {character.role_ko} · {EMOTION_KO[emotion] ?? emotion}
            {mode === "what_if" && " · AI WHAT-IF 세계"}
          </div>
        </div>
        <button className={w.close} onClick={onClose} aria-label="대화 닫기">
          ✕
        </button>
      </header>
      <div className={w.chat} aria-live="polite">
        {visible.length === 0 && (
          <p className={s.muted}>
            {shortName(characterId, character.display_name_ko)}에게 무엇이든 물어보세요. 이 시점까지 보고 들은 것만 알아요.
          </p>
        )}
        {visible.map((t) => (
          <TurnView key={t.id} turn={t} name={character.display_name_ko} />
        ))}
        <div ref={chatEnd} />
      </div>
      <div className={s.chips}>
        {(SUGGESTIONS[characterId] ?? []).map((q) => (
          <button key={q} className={s.chip} onClick={() => ask(q)} disabled={waiting}>
            {q}
          </button>
        ))}
      </div>
      <form
        className={s.composer}
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`${character.display_name_ko}에게 질문하기`}
          maxLength={500}
          aria-label="질문"
        />
        <button className={`${ui.button} ${ui.primary}`} disabled={waiting || !text.trim()}>
          보내기
        </button>
      </form>
    </section>
  );
}

/** 오브젝트 조사 결과 */
function InspectBox({ objectId, label, onClose }: { objectId: string; label: string; onClose: () => void }) {
  const result = useSession((st) => st.discoveries[objectId]);
  return (
    <section className={w.box} role="dialog" aria-label={`${label} 조사`}>
      <header className={w.boxHead}>
        <span className={w.icon}>🔍</span>
        <div>
          <div className={s.eyebrow}>조사</div>
          <strong>{label}</strong>
        </div>
        <button className={w.close} onClick={onClose} aria-label="조사 닫기">
          ✕
        </button>
      </header>
      <div className={w.chat}>
        {!result ? (
          <p className={s.muted}>살펴보는 중…</p>
        ) : (
          <>
            <p>{result.description_ko}</p>
            <ul className={s.claims}>
              {result.facts.map((f) => (
                <li key={f.fact_id}>
                  <Badge type={f.kind === "canon" ? "CANON" : "INTERPRETATION"} />
                  <span>{f.statement_ko}</span>
                </li>
              ))}
            </ul>
            <CitationList items={result.passages.map((p) => ({ ...p, type: "CANON" as const }))} />
          </>
        )}
      </div>
    </section>
  );
}
