"""Project Gutenberg 원문 + passage-tags.yaml → passages.jsonl

사용법:
    uv run --project backend python tools/extract_passages.py <pg64317.txt> works/gatsby

PG 헤더·푸터와 상표 문구는 버리고, 태그에 적힌 문단의 본문만 저장한다.
"""

import re
import sys
from pathlib import Path

import yaml

from app.canon.models import Passage

ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9}
START = "*** START OF THE PROJECT GUTENBERG EBOOK"
END = "*** END OF THE PROJECT GUTENBERG EBOOK"


def split_chapters(raw: str) -> dict[int, list[str]]:
    body = raw.split(START, 1)[1].split(END, 1)[0]
    lines = body.replace("\r", "").split("\n")
    # 목차의 로마 숫자는 들여쓰기가 없고, 본문 장 제목은 깊게 들여쓰기돼 있다.
    heading = re.compile(r"^\s{10,}([IVX]+)\s*$")
    chapters: dict[int, list[str]] = {}
    current: int | None = None
    for line in lines:
        m = heading.match(line)
        if m and m.group(1) in ROMAN:
            current = ROMAN[m.group(1)]
            chapters[current] = []
        elif current is not None:
            chapters[current].append(line)

    result: dict[int, list[str]] = {}
    for number, chapter_lines in chapters.items():
        blocks = re.split(r"\n\s*\n", "\n".join(chapter_lines).strip())
        result[number] = [re.sub(r"\s+", " ", b).strip() for b in blocks if b.strip()]
    return result


def main(pg_path: str, work_dir: str) -> None:
    work = Path(work_dir)
    tags = yaml.safe_load((work / "passage-tags.yaml").read_text(encoding="utf-8"))
    defaults = tags["defaults"]
    chapters = split_chapters(Path(pg_path).read_text(encoding="utf-8"))

    out = []
    for chapter, entries in tags["chapters"].items():
        paragraphs = chapters[int(chapter)]
        for entry in entries:
            para = entry["para"]
            point = entry["timeline_point"]
            passage = Passage(
                passage_id=f"{defaults['work_id']}-ch{int(chapter):02d}-p{para:03d}",
                work_id=defaults["work_id"],
                chapter=int(chapter),
                order=para,
                text=paragraphs[para - 1],
                characters=tuple(entry["characters"]),
                mentions=tuple(entry.get("mentions", ())),
                speakers=tuple(entry.get("speakers", ())),
                location=entry.get("location", defaults["location"]),
                time_context=point.split("-", 1)[1],
                timeline_point=point,
                narrative_layer=entry["narrative_layer"],
                topics=tuple(entry["topics"]),
                license_status="verified",
                source_reference=(
                    f"The Great Gatsby (1925), ch.{chapter}, para {para}; "
                    "transcription: Project Gutenberg eBook #64317"
                ),
            )
            out.append(passage.model_dump_json())

    (work / "passages.jsonl").write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {len(out)} passages")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
