import { useEffect, useState } from "react";

import { CitationList } from "../../components/CitationList";
import { shortName } from "../../components/names";
import ui from "../../components/ui.module.css";
import { api } from "../../services/api";
import { useSession } from "../../store/session";
import type { Graph, GraphEdge } from "../../types/api";
import s from "../screens.module.css";

const W = 760;
const H = 540;
const COLOR = { canon: "var(--canon)", interpretation: "var(--interp)", what_if: "var(--whatif)" };
const KIND_KO = { canon: "원작 관계", interpretation: "해석", what_if: "AI WHAT-IF" };

/** 노드를 원 위에 고정 배치한다. 결정적이라 테스트하기 쉽다. */
export function layout(ids: string[]): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  const r = Math.min(W, H) * 0.38;
  ids.forEach((id, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(ids.length, 1);
    out[id] = { x: W / 2 + r * Math.cos(a), y: H / 2 + r * Math.sin(a) };
  });
  return out;
}

/** 같은 두 노드 사이의 간선이 겹치지 않게 휘어지는 정도를 정한다. */
export function curveOffsets(edges: GraphEdge[]): Record<string, number> {
  const groups: Record<string, string[]> = {};
  for (const e of edges) {
    const key = [e.source, e.target].sort().join("|");
    (groups[key] ??= []).push(e.id);
  }
  const out: Record<string, number> = {};
  for (const ids of Object.values(groups)) {
    ids.forEach((id, i) => {
      out[id] = (i - (ids.length - 1) / 2) * 90;
    });
  }
  return out;
}

/** 화면 4: 관계도 — 인물 노드, 관계선, 근거, 현재 장면에서 공개된 정보만 */
export function GraphScreen() {
  const { session } = useSession();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [selected, setSelected] = useState<GraphEdge | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    setSelected(null);
    api.graph(session.session_id).then(setGraph).catch((e: Error) => setError(e.message));
  }, [session]);

  if (error) return <p className={s.error}>{error}</p>;
  if (!graph) return <p className={s.muted}>관계도를 불러오는 중…</p>;

  const pos = layout(graph.nodes.map((n) => n.id));
  const bend = curveOffsets(graph.edges);

  return (
    <div className={s.grid2}>
      <section className={ui.panel}>
        <div className={s.legend}>
          {(["canon", "interpretation", "what_if"] as const).map((k) => (
            <span key={k}>
              <span
                className={s.swatch}
                style={{ borderTopColor: COLOR[k], borderTopStyle: k === "canon" ? "solid" : "dashed" }}
              />
              {KIND_KO[k]}
            </span>
          ))}
        </div>
        <svg className={s.graph} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="인물 관계도">
          <defs>
            {Object.entries(COLOR).map(([k, c]) => (
              <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="40" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0 L10 5 L0 10 Z" fill={c} />
              </marker>
            ))}
          </defs>
          {graph.edges.map((e) => {
            const a = pos[e.source];
            const b = pos[e.target];
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const k = bend[e.id] ?? 0;
            // 방향과 무관하게 같은 쪽으로 휘도록 정렬된 법선 사용
            const [p, q] = e.source < e.target ? [a, b] : [b, a];
            const nx = -(q.y - p.y) / len;
            const ny = (q.x - p.x) / len;
            const cx = mx + nx * k;
            const cy = my + ny * k;
            const isSel = selected?.id === e.id;
            return (
              <g
                key={e.id}
                onClick={() => setSelected(e)}
                style={{ cursor: "pointer" }}
                data-testid={`edge-${e.id}`}
              >
                <path
                  d={`M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`}
                  stroke={COLOR[e.kind]}
                  strokeWidth={isSel ? 4 : 2.5}
                  strokeDasharray={e.kind === "canon" ? undefined : "7 5"}
                  fill="none"
                  markerEnd={`url(#arrow-${e.kind})`}
                />
                <path d={`M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`} stroke="transparent" strokeWidth="16" fill="none" />
                <text className={s.edgeLabel} x={(mx + cx) / 2} y={(my + cy) / 2} textAnchor="middle">
                  {e.label_ko}
                </text>
              </g>
            );
          })}
          {graph.nodes.map((n) => (
            <g key={n.id} transform={`translate(${pos[n.id].x} ${pos[n.id].y})`}>
              <circle r="30" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
              <text className={s.nodeLabel} textAnchor="middle" dy="5">
                {shortName(n.id, n.label_ko)}
              </text>
            </g>
          ))}
        </svg>
        <p className={`${s.muted} ${s.small}`}>
          지금 시점까지 공개된 관계만 보입니다. 장면 이후에 드러나는 인물과 관계는 아직 나타나지
          않습니다.
        </p>
      </section>
      <aside className={ui.panel}>
        {selected ? (
          <>
            <div className={s.eyebrow}>{KIND_KO[selected.kind]}</div>
            <h3>
              {graph.nodes.find((n) => n.id === selected.source)?.label_ko} →{" "}
              {graph.nodes.find((n) => n.id === selected.target)?.label_ko}: {selected.label_ko}
            </h3>
            {selected.evidence.length > 0 ? (
              <CitationList
                items={selected.evidence.map((ev) => ({
                  ...ev,
                  type: selected.kind === "interpretation" ? ("INTERPRETATION" as const) : ("CANON" as const),
                }))}
              />
            ) : (
              <p className={s.muted}>가상 분기에서 생긴 관계라 원문 근거가 없습니다.</p>
            )}
          </>
        ) : (
          <p className={s.muted}>관계선을 누르면 근거 원문이 나옵니다.</p>
        )}
      </aside>
    </div>
  );
}
