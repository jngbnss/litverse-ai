import { create } from "zustand";

import { api } from "../services/api";
import type {
  BranchResult,
  DialogueReply,
  InspectResult,
  Mode,
  Scene,
  SessionState,
  WorkDetail,
} from "../types/api";

export type Screen = "works" | "world" | "dialogue" | "graph" | "what-if" | "report";

export interface Turn {
  id: number;
  characterId: string;
  question: string;
  mode: Mode;
  reply?: DialogueReply;
  error?: string;
}

interface State {
  screen: Screen;
  work: WorkDetail | null;
  scene: Scene | null;
  session: SessionState | null;
  discoveries: Record<string, InspectResult>;
  turns: Turn[];
  activeCharacter: string;
  branch: BranchResult | null;
  busy: boolean;
  error: string | null;

  go: (screen: Screen) => void;
  setCharacter: (id: string) => void;
  start: (work: WorkDetail) => Promise<void>;
  inspect: (objectId: string) => Promise<InspectResult | null>;
  addQuestion: (characterId: string, question: string) => number;
  resolveTurn: (id: number, reply: DialogueReply) => void;
  failTurn: (id: number, error: string) => void;
  startBranch: (optionId: string) => Promise<void>;
  exitBranch: () => Promise<void>;
  reset: () => void;
}

const initial = {
  screen: "works" as Screen,
  work: null,
  scene: null,
  session: null,
  discoveries: {},
  turns: [],
  activeCharacter: "nick",
  branch: null,
  busy: false,
  error: null,
};

let nextTurnId = 1;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useSession = create<State>((set, get) => ({
  ...initial,

  go: (screen) => set({ screen }),
  setCharacter: (activeCharacter) => set({ activeCharacter }),

  start: async (work) => {
    set({ busy: true, error: null });
    try {
      const [scene, session] = await Promise.all([
        api.scene(work.work_id, work.default_scene),
        api.createSession(work.work_id, work.default_scene),
      ]);
      set({
        ...initial,
        work,
        scene,
        session,
        activeCharacter: scene.characters[0]?.character_id ?? "nick",
        screen: "world",
      });
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: false });
    }
  },

  inspect: async (objectId) => {
    const session = get().session;
    if (!session) return null;
    try {
      const result = await api.inspect(session.session_id, objectId);
      set((s) => ({ discoveries: { ...s.discoveries, [objectId]: result } }));
      return result;
    } catch (e) {
      set({ error: message(e) });
      return null;
    }
  },

  addQuestion: (characterId, question) => {
    const id = nextTurnId++;
    const mode = get().session?.mode ?? "canon";
    set((s) => ({ turns: [...s.turns, { id, characterId, question, mode }] }));
    return id;
  },

  resolveTurn: (id, reply) =>
    set((s) => ({ turns: s.turns.map((t) => (t.id === id ? { ...t, reply } : t)) })),

  failTurn: (id, error) =>
    set((s) => ({ turns: s.turns.map((t) => (t.id === id ? { ...t, error } : t)) })),

  startBranch: async (optionId) => {
    const session = get().session;
    if (!session) return;
    set({ busy: true, error: null });
    try {
      const branch = await api.branch(session.session_id, optionId);
      const updated = await api.session(session.session_id);
      set({ branch, session: updated });
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: false });
    }
  },

  exitBranch: async () => {
    const session = get().session;
    if (!session) return;
    const updated = await api.exitBranch(session.session_id);
    set({ session: updated, branch: null, screen: "world" });
  },

  reset: () => set({ ...initial }),
}));
