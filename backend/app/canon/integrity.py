"""작품 데이터 무결성 검사. CI와 `python -m app.canon.integrity <work_dir>`에서 쓴다.

검사 항목:
- 모든 passage/character/timeline 참조가 존재하는가
- 원작 디렉터리에 분기·세션 데이터가 섞이지 않았는가
- 라이선스 미확인 문단이 없는가
- 인물 지식 부여(grant)와 장면 정의가 유효한가
"""

import sys
from pathlib import Path

from app.canon.store import ALLOWED_WORK_FILES, Work, load_work


def check_work(work: Work) -> list[str]:
    errors: list[str] = []
    chars = set(work.characters)
    points = set(work.timeline)
    passages = set(work.passages)

    def need(kind: str, ref: str, pool: set[str], where: str) -> None:
        if ref not in pool:
            errors.append(f"{where}: unknown {kind} '{ref}'")

    for name in (p.name for p in work.path.iterdir() if p.is_file()):
        if name not in ALLOWED_WORK_FILES:
            errors.append(f"unexpected file in work dir: {name}")

    if work.metadata.license.status != "verified":
        errors.append("metadata: work license not verified")

    for p in work.passages.values():
        where = f"passage {p.passage_id}"
        if p.work_id != work.work_id:
            errors.append(f"{where}: work_id '{p.work_id}' != '{work.work_id}'")
        if not p.passage_id.startswith(f"{work.work_id}-ch{p.chapter:02d}-p{p.order:03d}"):
            errors.append(f"{where}: id does not match chapter/order")
        if p.license_status != "verified":
            errors.append(f"{where}: license_status '{p.license_status}'")
        need("timeline point", p.timeline_point, points, where)
        for c in (*p.characters, *p.mentions, *p.speakers):
            need("character", c, chars, where)
        for s in p.speakers:
            if s not in p.characters:
                errors.append(f"{where}: speaker '{s}' not in characters")

    for c in work.characters.values():
        for g in c.knowledge_grants:
            where = f"character {c.character_id} grant {g.passage_id}"
            need("passage", g.passage_id, passages, where)
            need("timeline point", g.known_from, points, where)

    for f in work.facts.values():
        for pid in f.passage_ids:
            need("passage", pid, passages, f"fact {f.fact_id}")
        for c in f.perspectives:
            need("character", c, chars, f"fact {f.fact_id}")
        prefix = "f-" if f.kind == "canon" else "i-"
        if not f.fact_id.startswith(prefix):
            errors.append(f"fact {f.fact_id}: {f.kind} fact id must start with '{prefix}'")

    for s in work.spoilers.values():
        need("timeline point", s.from_point, points, f"spoiler {s.spoiler_id}")

    for r in work.relationships.values():
        where = f"relationship {r.relation_id}"
        need("character", r.source, chars, where)
        need("character", r.target, chars, where)
        need("timeline point", r.revealed_at, points, where)
        for pid in r.passage_ids:
            need("passage", pid, passages, where)
            if pid in passages and work.passage_point(pid) > work.ordinal(r.revealed_at):
                errors.append(f"{where}: evidence {pid} is later than revealed_at")

    for sc in work.scenes.values():
        where = f"scene {sc.scene_id}"
        if sc.work_id != work.work_id:
            errors.append(f"{where}: work_id mismatch")
        need("timeline point", sc.now, points, where)
        for c in sc.characters:
            need("character", c, chars, where)
            if c in work.characters and not work.characters[c].agent:
                errors.append(f"{where}: '{c}' is not a dialogue agent")
        for o in sc.objects:
            for pid in o.passage_ids:
                need("passage", pid, passages, f"{where} object {o.object_id}")
        for g in sc.dialogue_goals:
            need("character", g.character_id, set(sc.characters), f"{where} goal")
        for b in sc.branches:
            need("timeline point", b.diverges_at, points, f"{where} branch {b.branch_id}")
            if b.diverges_at in points and work.ordinal(b.diverges_at) > work.ordinal(sc.now):
                errors.append(f"{where} branch {b.branch_id}: diverges after scene 'now'")
            for c in b.affected_characters:
                need("character", c, chars, f"{where} branch {b.branch_id}")
            for rc in b.relation_changes:
                need("character", rc.source, chars, f"{where} branch {b.branch_id}")
                need("character", rc.target, chars, f"{where} branch {b.branch_id}")

    if work.metadata.default_scene not in work.scenes:
        errors.append(f"metadata: unknown default_scene '{work.metadata.default_scene}'")

    return errors


def main(argv: list[str]) -> int:
    failed = False
    for arg in argv:
        errors = check_work(load_work(Path(arg)))
        for e in errors:
            print(f"[{arg}] {e}")
        failed |= bool(errors)
        if not errors:
            print(f"[{arg}] ok")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
