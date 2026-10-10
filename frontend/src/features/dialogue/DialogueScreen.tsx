import { useEffect, useRef, useState } from "react";

import { Badge } from "../../components/Badge";
import { CitationList } from "../../components/CitationList";
import { Portrait } from "../../components/Portrait";
import ui from "../../components/ui.module.css";
import { DialogueSocket } from "../../services/dialogueSocket";
import { type Turn, useSession } from "../../store/session";
import type { SocketEvent } from "../../types/api";
import s from "../screens.module.css";

const SUGGESTIONS: Record<string, string[]> = {
  nick: [
    "개츠비가 사람을 죽였다는 소문이 있어?",
    "서재의 책은 진짜였어?",
    "개츠비가 계단에 혼자 서 있던 건 무슨 의미일까?",
  ],
  gatsby: ["전쟁 때 어느 사단에 있었어요?", "내일 수상비행기를 탈 건가요?", "데이지를 아세요?"],
  jordan: [
    "개츠비는 옥스퍼드 출신이야?",
    "개츠비가 서재에서 무슨 이야기를 했어?",
    "개츠비가 독일 스파이라는 소문은 뭐야?",
  ],
};

const EMOTION_KO: Record<string, string> = {
  curious: "호기심",
  composed: "침착함",
  amused: "재미있어함",
  calm: "차분함",
  thoughtful: "생각에 잠김",
  hesitant: "머뭇거림",
  friendly: "반가움",
  surprised: "놀람",
  neutral: "보통",
};

/** 화면 3: 인물 대화 — 초상화, 자유 질문, 대화 기록, 현재 감정, 원문 근거 */
export function DialogueScreen() {
  const { scene, session, turns, activeCharacter, setCharacter, addQuestion, resolveTurn, failTurn } =
    useSession();
  const [text, setText] = useState("");
  const socket = useRef<DialogueSocket | null>(null);
  const pending = useRef<number[]>([]);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    const ws = new DialogueSocket(session.session_id, (e: SocketEvent) => {
      if (e.type === "reply") {
        const id = pending.current.shift();
        if (id !== undefined) resolveTurn(id, e);
      } else if (e.type === "error") {
        const id = pending.current.shift();
        if (id !== undefined) failTurn(id, e.detail);
      }
    });
    socket.current = ws;
    return () => ws.close();
  }, [session, resolveTurn, failTurn]);

  const mode = session?.mode ?? "canon";
  const visible = turns.filter((t) => t.characterId === activeCharacter && t.mode === mode);

  useEffect(() => {
    chatEnd.current?.scrollIntoView?.({ block: "end" });
  }, [visible.length, turns]);

  if (!scene || !session) return null;
  const character = scene.characters.find((c) => c.character_id === activeCharacter) ?? scene.characters[0];
  const last = [...visible].reverse().find((t) => t.reply);
  const waiting = visible.some((t) => !t.reply && !t.error);

  const send = (question: string) => {
    const q = question.trim();
    if (!q || waiting) return;
    const id = addQuestion(character.character_id, q);
    pending.current.push(id);
    socket.current?.ask(character.character_id, q);
    setText("");
  };

  return (
    <div className={s.grid2} style={{ gridTemplateColumns: "minmax(220px, 0.7fr) minmax(0, 2fr)" }}>
      <aside className={s.characters}>
        {scene.characters.map((c) => {
          const lastReply = [...turns].reverse().find((t) => t.characterId === c.character_id && t.reply);
          const emotion = lastReply?.reply?.emotion ?? c.default_emotion;
          return (
            <button
              key={c.character_id}
              className={s.characterButton}
              aria-pressed={c.character_id === character.character_id}
              onClick={() => setCharacter(c.character_id)}
            >
              <Portrait id={c.character_id} size={44} label={c.display_name_ko} />
              <span>
                <strong>{c.display_name_ko}</strong>
                <br />
                <span className={`${s.muted} ${s.small}`}>
                  {c.role_ko} · {EMOTION_KO[emotion] ?? emotion}
                </span>
              </span>
            </button>
          );
        })}
      </aside>

      <section className={ui.panel}>
        <div className={s.row} style={{ marginBottom: 12 }}>
          <Portrait id={character.character_id} size={56} label={character.display_name_ko} />
          <div>
            <h2 style={{ margin: 0 }}>{character.display_name_ko}</h2>
            <div className={`${s.muted} ${s.small}`}>
              {character.display_name} · 지금 감정:{" "}
              {EMOTION_KO[last?.reply?.emotion ?? character.default_emotion] ?? "보통"}
              {mode === "what_if" && " · AI WHAT-IF 세계"}
            </div>
          </div>
        </div>

        <div className={s.chat} aria-live="polite">
          {visible.length === 0 && (
            <p className={s.muted}>
              무엇이든 물어보세요. {character.display_name_ko}는 자신이 이 시점까지 보고 들은 것만
              압니다.
            </p>
          )}
          {visible.map((t) => (
            <TurnView key={t.id} turn={t} name={character.display_name_ko} />
          ))}
          <div ref={chatEnd} />
        </div>

        <div className={s.chips} style={{ marginTop: 12 }}>
          {(SUGGESTIONS[character.character_id] ?? []).map((q) => (
            <button key={q} className={s.chip} onClick={() => send(q)} disabled={waiting}>
              {q}
            </button>
          ))}
        </div>
        <form
          className={s.composer}
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input
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
    </div>
  );
}

export function TurnView({ turn, name }: { turn: Turn; name: string }) {
  const [open, setOpen] = useState(false);
  const r = turn.reply;
  return (
    <>
      <div className={s.question}>{turn.question}</div>
      <div className={s.answer}>
        <Portrait id={turn.characterId} size={32} label={name} />
        <div className={s.bubble}>
          {turn.error && <span className={s.error}>{turn.error}</span>}
          {!r && !turn.error && <span className={s.thinking}>{name}가 기억을 더듬는 중… (근거 확인 중)</span>}
          {r && (
            <>
              <div>{r.reply}</div>
              {r.claims.length > 0 && (
                <ul className={s.claims}>
                  {r.claims.map((c, i) => (
                    <li key={i}>
                      <Badge type={c.type} />
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              {r.citations.length > 0 && (
                <button className={s.linkButton} onClick={() => setOpen(!open)} aria-expanded={open}>
                  {open ? "근거 접기" : `원문 근거 보기 (${new Set(r.citations.map((c) => c.passage_id)).size})`}
                </button>
              )}
              {open && <CitationList items={r.citations} />}
              {r.claims.length === 0 && !r.fallback && (
                <div className={s.notice}>원문 근거가 있는 주장이 없는 답변입니다.</div>
              )}
              {r.fallback && (
                <div className={s.notice}>
                  검증을 통과한 답을 만들지 못해 안전한 답변으로 바꿨습니다 ({r.attempts}회 시도).
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
