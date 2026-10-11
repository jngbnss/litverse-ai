import { useEffect, useRef } from "react";

import { DialogueSocket } from "../../services/dialogueSocket";
import { useSession } from "../../store/session";
import type { SocketEvent } from "../../types/api";

/** 한 인물과의 대화. WebSocket 연결, 대기 중인 질문, 현재 모드의 대화 기록을 묶는다. */
export function useDialogue(characterId: string) {
  const { session, turns, addQuestion, resolveTurn, failTurn } = useSession();
  const socket = useRef<DialogueSocket | null>(null);
  const pending = useRef<number[]>([]);

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
  const visible = turns.filter((t) => t.characterId === characterId && t.mode === mode);
  const waiting = visible.some((t) => !t.reply && !t.error);

  const send = (question: string): boolean => {
    const q = question.trim();
    if (!q || waiting) return false;
    const id = addQuestion(characterId, q);
    pending.current.push(id);
    socket.current?.ask(characterId, q);
    return true;
  };

  return { mode, visible, waiting, send };
}
