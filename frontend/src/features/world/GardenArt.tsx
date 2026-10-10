/** 개츠비 저택 정원의 밤. 자체 제작 SVG 도형 (외부 이미지 없음). */
export function GardenArt() {
  const windows = Array.from({ length: 14 }, (_, i) => i);
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--night-1)" />
          <stop offset="1" stopColor="var(--night-2)" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe6a0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe6a0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)" />
      {[120, 340, 560, 900, 1180, 1420, 260, 760, 1320].map((x, i) => (
        <circle key={x} cx={x} cy={60 + ((i * 53) % 160)} r={i % 3 === 0 ? 2.2 : 1.4} fill="#fff" opacity="0.7" />
      ))}
      <circle cx="1380" cy="120" r="46" fill="#f7f0d6" opacity="0.92" />
      {/* 만(Sound)의 물결 */}
      <rect x="0" y="470" width="1600" height="70" fill="#22365c" opacity="0.8" />
      <path d="M0 500 Q200 490 400 500 T800 500 T1200 500 T1600 500" stroke="#9fb3d9" strokeOpacity="0.35" fill="none" />
      {/* 저택 */}
      <g>
        <rect x="260" y="200" width="760" height="290" fill="#2a2a3a" />
        <polygon points="240,200 640,110 1040,200" fill="#22222f" />
        <rect x="560" y="140" width="160" height="80" fill="#2a2a3a" />
        <rect x="610" y="90" width="60" height="60" fill="#22222f" />
        {windows.map((i) => (
          <rect
            key={i}
            x={300 + (i % 7) * 100}
            y={i < 7 ? 240 : 340}
            width="44"
            height="62"
            fill="#ffd77a"
            opacity={0.55 + ((i * 37) % 40) / 100}
          />
        ))}
        <rect x="590" y="400" width="100" height="90" fill="#ffcf66" opacity="0.9" />
      </g>
      {/* 대리석 계단 */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={560 - i * 30} y={490 + i * 14} width={160 + i * 60} height="14" fill="#cfc6b4" opacity={0.95 - i * 0.08} />
      ))}
      {/* 잔디밭 */}
      <path d="M0 540 L1600 540 L1600 900 L0 900 Z" fill="var(--lawn)" />
      <path d="M0 620 Q800 560 1600 620 L1600 900 L0 900 Z" fill="#000" opacity="0.12" />
      {/* 전구 줄 */}
      <path d="M80 560 Q400 620 800 570 T1520 560" stroke="#3b3b2a" fill="none" />
      {Array.from({ length: 22 }, (_, i) => (
        <circle key={i} cx={100 + i * 66} cy={575 + Math.sin(i / 2) * 18} r="6" fill={["#ffd36b", "#ff9f7a", "#9fe0ff", "#c6ff9f"][i % 4]} />
      ))}
      {/* 오케스트라 무대 */}
      <rect x="840" y="400" width="200" height="40" fill="#5a3b2a" />
      <circle cx="940" cy="420" r="120" fill="url(#glow)" opacity="0.5" />
      {/* 서재 창 */}
      <rect x="430" y="300" width="64" height="70" fill="#f1c56b" />
      {/* 진입로와 차 */}
      <path d="M1220 900 Q1300 700 1600 640" stroke="#7a7262" strokeWidth="60" fill="none" opacity="0.7" />
      <g transform="translate(1390 760) rotate(-12)">
        <rect x="0" y="0" width="140" height="44" rx="12" fill="#c8c0b0" />
        <circle cx="30" cy="46" r="13" fill="#222" />
      </g>
      {/* 과일 상자 */}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1250 + i * 34} y={600 - (i % 2) * 22} width="32" height="22" fill="#b9853a" stroke="#6b4a1f" />
      ))}
    </svg>
  );
}
