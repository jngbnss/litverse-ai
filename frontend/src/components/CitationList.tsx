import type { ClaimType, Excerpt } from "../types/api";
import { Badge } from "./Badge";
import styles from "./ui.module.css";

interface Item extends Excerpt {
  type?: ClaimType;
}

/** 원문 근거 카드. 발췌만 보여 주고 원문 전체는 노출하지 않는다. */
export function CitationList({ items }: { items: Item[] }) {
  if (items.length === 0) return null;
  const unique = items.filter(
    (c, i) => items.findIndex((o) => o.passage_id === c.passage_id && o.type === c.type) === i,
  );
  return (
    <ul className={styles.citations}>
      {unique.map((c) => (
        <li key={`${c.passage_id}-${c.type ?? ""}`} className={styles.citation} data-type={c.type}>
          <div className={styles.citationMeta}>
            {c.type && <Badge type={c.type} />}
            <span>
              {c.chapter}장 · {c.passage_id}
            </span>
          </div>
          <div className={styles.quote}>“{c.excerpt}”</div>
        </li>
      ))}
    </ul>
  );
}
