"""관계 그래프. 시점 t에 공개된 간선(revealed_at <= t)만 내보낸다."""

from typing import Any

import networkx as nx

from app.canon.models import RelationChange
from app.canon.store import Work


def build_graph(work: Work) -> nx.MultiDiGraph:
    g = nx.MultiDiGraph()
    for c in work.characters.values():
        g.add_node(c.character_id, label_ko=c.display_name_ko, agent=c.agent)
    for r in work.relationships.values():
        g.add_edge(
            r.source,
            r.target,
            key=r.relation_id,
            type=r.type,
            label_ko=r.label_ko,
            kind=r.kind,
            passage_ids=list(r.passage_ids),
            revealed_at=r.revealed_at,
        )
    return g


def visible_subgraph(work: Work, at: str) -> nx.MultiDiGraph:
    g = build_graph(work)
    now = work.ordinal(at)
    hidden_edges = [
        (u, v, k) for u, v, k, d in g.edges(keys=True, data=True)
        if work.ordinal(d["revealed_at"]) > now
    ]  # fmt: skip
    g.remove_edges_from(hidden_edges)
    g.remove_nodes_from([n for n in list(g.nodes) if g.degree(n) == 0])
    return g


def graph_json(
    work: Work,
    at: str,
    scene_characters: tuple[str, ...] = (),
    what_if: tuple[RelationChange, ...] = (),
    excerpt_chars: int = 160,
) -> dict[str, Any]:
    g = visible_subgraph(work, at)
    for c in scene_characters:
        if c not in g:
            ch = work.characters[c]
            g.add_node(c, label_ko=ch.display_name_ko, agent=ch.agent)

    edges = [
        {
            "id": k,
            "source": u,
            "target": v,
            "label_ko": d["label_ko"],
            "kind": d["kind"],
            "evidence": [
                {
                    "passage_id": pid,
                    "chapter": work.passages[pid].chapter,
                    "excerpt": work.passages[pid].text[:excerpt_chars],
                }
                for pid in d["passage_ids"]
            ],  # fmt: skip
        }
        for u, v, k, d in g.edges(keys=True, data=True)
    ]
    for i, rc in enumerate(what_if):
        for n in (rc.source, rc.target):
            if n not in g:
                g.add_node(n, label_ko=work.characters[n].display_name_ko, agent=True)
        edges.append({"id": f"what-if-{i}", "source": rc.source, "target": rc.target,
                      "label_ko": rc.label_ko, "kind": "what_if", "evidence": []})  # fmt: skip

    nodes = [
        {"id": n, "label_ko": d["label_ko"], "agent": d["agent"]}
        for n, d in sorted(g.nodes(data=True))
    ]
    return {"at": at, "nodes": nodes, "edges": edges}
