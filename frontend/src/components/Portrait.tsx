import styles from "./ui.module.css";

/**
 * 자체 제작 SVG 초상. 실존 배우·영화 이미지와 무관한 추상 도형이다 (copyright-review G-8, G-9).
 */
const LOOKS: Record<string, { hair: string; outfit: string; accent: string }> = {
  nick: { hair: "#7a5a3a", outfit: "#e9e4d8", accent: "#8a8f99" },
  gatsby: { hair: "#c9a24a", outfit: "#f4efe2", accent: "#d9b45a" },
  jordan: { hair: "#3b2a20", outfit: "#2f6b5a", accent: "#e0c9a6" },
};

export function Portrait({ id, size = 56, label }: { id: string; size?: number; label: string }) {
  const look = LOOKS[id] ?? { hair: "#777", outfit: "#ccc", accent: "#999" };
  return (
    <svg
      className={styles.portrait}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={label}
    >
      <circle cx="32" cy="32" r="32" fill="var(--surface-2)" />
      <path d="M10 64 C12 46 52 46 54 64 Z" fill={look.outfit} />
      <path d="M26 46 L32 54 L38 46 Z" fill={look.accent} />
      <circle cx="32" cy="28" r="12" fill="#e8c9a8" />
      {id === "jordan" ? (
        <path d="M19 30 C18 14 46 14 45 30 L45 22 C40 16 24 16 19 22 Z" fill={look.hair} />
      ) : (
        <path d="M20 26 C20 13 44 13 44 26 C40 20 26 19 20 26 Z" fill={look.hair} />
      )}
    </svg>
  );
}
