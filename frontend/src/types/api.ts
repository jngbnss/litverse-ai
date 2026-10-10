// 백엔드 응답과 같은 형태 (backend/app/api/routes.py, services/*.py)

export type Mode = "canon" | "what_if";
export type ClaimType = "CANON" | "INTERPRETATION" | "WHAT_IF";

export interface WorkSummary {
  work_id: string;
  title: string;
  title_ko: string;
  author: string;
  published: number;
}

export interface WorkDetail extends WorkSummary {
  language: string;
  summary_ko: string;
  source: { name: string; url: string; edition: string; retrieved: string };
  license: { status: string; jurisdictions: Record<string, string>; note: string };
  default_scene: string;
  scenes: { scene_id: string; title_ko: string; chapter: number }[];
}

export interface SceneCharacter {
  character_id: string;
  display_name: string;
  display_name_ko: string;
  role_ko: string;
  default_emotion: string;
}

export interface SceneObject {
  object_id: string;
  name_ko: string;
  description_ko: string;
  hotspot: { x: number; y: number };
}

export interface BranchOption {
  branch_id: string;
  title_ko: string;
  premise_ko: string;
  diverges_at: string;
  affected_characters: string[];
}

export interface Scene {
  scene_id: string;
  title_ko: string;
  chapter: number;
  location: string;
  now: string;
  now_label_ko: string;
  characters: SceneCharacter[];
  objects: SceneObject[];
  dialogue_goals: { character_id: string; goal_ko: string }[];
  branches: BranchOption[];
}

export interface SessionState {
  session_id: string;
  work_id: string;
  scene_id: string;
  now: string;
  mode: Mode;
  branch_id: string | null;
}

export interface Excerpt {
  passage_id: string;
  chapter: number;
  excerpt: string;
}

export interface InspectResult {
  object_id: string;
  name_ko: string;
  description_ko: string;
  passages: Excerpt[];
  facts: { fact_id: string; kind: "canon" | "interpretation"; statement_ko: string }[];
}

export interface Claim {
  text: string;
  type: ClaimType;
  passage_ids: string[];
  perspective: string | null;
}

export interface Citation extends Excerpt {
  claim_index: number;
  type: ClaimType;
}

export interface DialogueReply {
  character_id: string;
  mode: Mode;
  reply: string;
  emotion: string;
  claims: Claim[];
  citations: Citation[];
  fallback: boolean;
  attempts: number;
  consistent: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label_ko: string;
  kind: "canon" | "interpretation" | "what_if";
  evidence: Excerpt[];
}

export interface Graph {
  at: string;
  mode: Mode;
  nodes: { id: string; label_ko: string; agent: boolean }[];
  edges: GraphEdge[];
}

export interface BranchEvent {
  kind: "choice" | "relation_change" | "reaction";
  character_id: string | null;
  payload: Record<string, unknown>;
  consistent?: boolean;
}

export interface BranchResult {
  branch_id: string;
  option_id: string;
  title_ko: string;
  label: "AI WHAT-IF";
  diverges_at: string;
  snapshot: { canon_now: string; diverges_at: string; canon_fingerprint: string };
  events: BranchEvent[];
}

export interface Report {
  session_id: string;
  work: { work_id: string; title: string };
  scene: { scene_id: string; title_ko: string; now: string };
  characters_met: { character_id: string; display_name_ko: string; turns: number }[];
  discoveries: string[];
  canon: {
    facts: { fact_id: string; statement_ko: string; passage_ids: string[] }[];
    claims: { character_id: string; text: string; passage_ids: string[] }[];
  };
  interpretation: {
    team: { fact_id: string; statement_ko: string; passage_ids: string[] }[];
    claims: { character_id: string; text: string; passage_ids: string[]; perspective: string | null }[];
  };
  what_if: {
    branch_id: string;
    option_id: string;
    label: string;
    events: BranchEvent[];
    turns: { character_id: string; question: string; reply: string }[];
  }[];
  relations: GraphEdge[];
  seen_passages: Excerpt[];
  discussion_questions_ko: string[];
}

export type SocketEvent =
  | { type: "thinking"; character_id: string }
  | ({ type: "reply" } & DialogueReply)
  | { type: "done" }
  | { type: "error"; detail: string };
