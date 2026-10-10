import type { ClaimType } from "../types/api";
import styles from "./ui.module.css";

export const CLAIM_LABEL: Record<ClaimType, string> = {
  CANON: "원작",
  INTERPRETATION: "해석",
  WHAT_IF: "AI WHAT-IF",
};

export function Badge({ type }: { type: ClaimType }) {
  return (
    <span className={`${styles.badge} ${styles[type]}`} data-testid={`badge-${type}`}>
      {CLAIM_LABEL[type]}
    </span>
  );
}
