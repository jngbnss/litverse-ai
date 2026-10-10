import type {
  BranchResult,
  DialogueReply,
  Graph,
  InspectResult,
  Report,
  Scene,
  SessionState,
  WorkDetail,
  WorkSummary,
} from "../types/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* 본문이 JSON이 아님 */
    }
    throw new ApiError(res.status, String(detail));
  }
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  works: () => request<WorkSummary[]>("/works"),
  work: (workId: string) => request<WorkDetail>(`/works/${workId}`),
  scene: (workId: string, sceneId: string) => request<Scene>(`/works/${workId}/scenes/${sceneId}`),
  createSession: (workId: string, sceneId: string) =>
    post<SessionState>("/sessions", { work_id: workId, scene_id: sceneId }),
  session: (id: string) => request<SessionState>(`/sessions/${id}`),
  inspect: (id: string, objectId: string) => post<InspectResult>(`/sessions/${id}/inspect/${objectId}`),
  ask: (id: string, characterId: string, question: string) =>
    post<DialogueReply>(`/sessions/${id}/dialogue`, { character_id: characterId, question }),
  graph: (id: string) => request<Graph>(`/sessions/${id}/graph`),
  branch: (id: string, optionId: string) =>
    post<BranchResult>(`/sessions/${id}/branches`, { option_id: optionId }),
  exitBranch: (id: string) => post<SessionState>(`/sessions/${id}/branches/exit`),
  report: (id: string) => request<Report>(`/sessions/${id}/report`),
};
