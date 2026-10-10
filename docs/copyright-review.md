# Copyright Review

규칙: 항목이 하나라도 `unknown`이면 해당 자료를 저장소에 넣지 않는다.
상태 값: `verified` / `pending` / `rejected` / `not_used`

## 작품: The Great Gatsby (F. Scott Fitzgerald)

| ID | 항목 | 내용 | 상태 | 근거·메모 |
|---|---|---|---|---|
| G-1 | 원문 (US) | 1925년 Scribner 출판 | verified | 1925년 출판물은 95년 보호가 끝나 2021-01-01부터 미국 퍼블릭 도메인 (17 U.S.C. §304) |
| G-2 | 원문 (KR) | 저자 1940-12-21 사망 | verified (팀 검토) | 사망 후 보호기간(구법 30년, 회복저작물 기준 50년)이 이미 만료됨. **배포 전에 법률 자문으로 재확인할 것** |
| G-3 | 원문 (EU) | 사망 후 70년 → 2011년 만료 | pending | MVP 배포 대상이 아니므로 참고만 |
| G-4 | 텍스트 출처 | Project Gutenberg eBook #64317 | verified | PG 헤더·푸터·상표 문구를 빼고 원문 문단만 저장 (tools/extract_passages.py). PG 전문 파일은 커밋하지 않음 |
| G-5 | 판본 | PG #64317 = Standard Ebooks 기반 전사 (영국식 철자 사용) | verified | 문단마다 source_reference에 장·문단 번호와 전사본 기록. 초판 대조는 미실시 |
| G-6 | 번역문 | — | not_used | 국내 출판 번역 사용 금지 (D-012) |
| G-7 | 표지·삽화 | 1925년 Cugat 표지 포함 | not_used | 상태와 무관하게 사용 안 함 |
| G-8 | 영화 자료 | 1974·2013년 영화 스틸, OST, 배우 초상 | not_used | 금지 |
| G-9 | 인물 초상화 | 팀 자체 제작 | pending | 배우와 닮지 않았는지 검수, 제작자·라이선스 기록 |
| G-10 | 해석 문장 | 팀 작성 | pending | 외부 해설 복사 금지, 작성자 기록 |
| G-11 | 제목·상표 | "The Great Gatsby" | pending | 비상업 교육 시연 범위에서 사용 가능한지 확인 |

- 검토자: (미정)
- 마지막 검토일: 2026-10-11
- 다음 재검토: 공개 배포 전 / 배포 국가가 바뀔 때
- 사용 중인 원문: 3장 44문단, 4장 4문단 (works/gatsby/passages.jsonl)
