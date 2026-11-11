export default function SatelliteArt() {
  const tips = [[38, 38], [204, 30], [34, 206], [198, 200]];

  return (
    <svg viewBox="0 0 240 240" role="img" aria-label="A small round satellite with four antennas" className="h-full w-full text-ink">
      <defs>
        <radialGradient id="metal" cx="32%" cy="28%" r="80%">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="0.25" stopColor="#b9c0c9" />
          <stop offset="0.6" stopColor="#5a626d" />
          <stop offset="1" stopColor="#1c2026" />
        </radialGradient>
        <radialGradient id="earthshine" cx="75%" cy="82%" r="50%">
          <stop offset="0" stopColor="#78aaff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#78aaff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="120" rx="112" ry="44" transform="rotate(-24 120 120)" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeDasharray="3 6" />
      <g stroke="#aab1bb" strokeWidth="1.6" strokeLinecap="round">
        <line x1="96" y1="96" x2="38" y2="38" />
        <line x1="144" y1="96" x2="204" y2="30" />
        <line x1="96" y1="144" x2="34" y2="206" />
        <line x1="144" y1="144" x2="198" y2="200" />
      </g>
      {tips.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="2.6" fill="#c9cfd8" />
      ))}
      <circle cx="120" cy="120" r="34" fill="url(#metal)" />
      <circle cx="120" cy="120" r="34" fill="url(#earthshine)" />
      <ellipse cx="120" cy="120" rx="34" ry="8" fill="none" stroke="#000" strokeOpacity="0.25" />
    </svg>
  );
}
