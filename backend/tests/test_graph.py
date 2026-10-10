from app.canon.models import RelationChange
from app.relationships.graph import graph_json, visible_subgraph


def edge_ids(g) -> set[str]:
    return {k for _, _, k in g.edges(keys=True)}


def test_edges_revealed_over_time(work):
    evening = edge_ids(visible_subgraph(work, "t03-party-evening"))
    assert "r-nick-neighbor-gatsby" in evening
    assert "r-war-comrades" not in evening
    assert "r-war-comrades" in edge_ids(visible_subgraph(work, "t03-party-midnight"))


def test_daisy_appears_only_from_chapter4(work):
    assert "daisy" not in visible_subgraph(work, "t03-party-end")
    assert "daisy" in visible_subgraph(work, "t04-plaza-tea")


def test_graph_json_evidence_and_what_if(work):
    g = graph_json(work, "t03-party-end", ("nick", "gatsby", "jordan"),
                   (RelationChange(source="gatsby", target="nick", label_ko="경계심"),))  # fmt: skip
    canon = [e for e in g["edges"] if e["kind"] != "what_if"]
    assert all(e["evidence"] for e in canon)
    what_if = [e for e in g["edges"] if e["kind"] == "what_if"]
    assert what_if == [{"id": "what-if-0", "source": "gatsby", "target": "nick",
                        "label_ko": "경계심", "kind": "what_if", "evidence": []}]  # fmt: skip
