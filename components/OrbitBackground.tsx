export default function OrbitBackground() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 800 800"
      className="pointer-events-none absolute -right-64 top-1/2 z-0 w-[44rem] max-w-none -translate-y-1/2 text-ink sm:-right-28 sm:w-[50rem]"
    >
      <defs>
        <linearGradient id="satellite-panel" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#d7e5f7" />
          <stop offset="0.45" stopColor="#6681a5" />
          <stop offset="1" stopColor="#202d40" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="currentColor" strokeOpacity="0.12">
        <ellipse cx="400" cy="400" rx="135" ry="72" transform="rotate(-22 400 400)" />
        <ellipse cx="400" cy="400" rx="245" ry="138" transform="rotate(28 400 400)" />
        <ellipse cx="400" cy="400" rx="365" ry="205" transform="rotate(-12 400 400)" strokeDasharray="2 8" />
      </g>

      <g className="orbit-satellite orbit-satellite-slow" style={{ transformOrigin: "400px 400px" }}>
        <g transform="translate(765 400) rotate(18)">
          <rect x="-13" y="-7" width="26" height="14" rx="2" fill="#aeb8c5" stroke="#e1e7ef" strokeWidth="1" />
          <rect x="-31" y="-5" width="14" height="10" fill="url(#satellite-panel)" stroke="#7389a5" />
          <rect x="17" y="-5" width="14" height="10" fill="url(#satellite-panel)" stroke="#7389a5" />
          <circle cx="0" cy="0" r="3" fill="#263445" />
          <path d="M0 7v9M-4 16h8" stroke="#c9d3df" strokeWidth="1.5" />
        </g>
      </g>

      <g className="orbit-satellite orbit-satellite-medium" style={{ transformOrigin: "400px 400px" }}>
        <g transform="translate(645 400) rotate(-28)">
          <rect x="-14" y="-9" width="28" height="18" rx="3" fill="#798694" stroke="#d3dae4" strokeWidth="1" />
          <rect x="-33" y="-6" width="15" height="12" fill="url(#satellite-panel)" stroke="#7389a5" />
          <rect x="18" y="-6" width="15" height="12" fill="url(#satellite-panel)" stroke="#7389a5" />
          <path d="M-7-9v-8M7-9v-8M-7 9v8M7 9v8" stroke="#d3dae4" strokeWidth="1" />
          <circle cx="0" cy="0" r="4" fill="#b8c3d0" />
        </g>
      </g>

      <g className="orbit-satellite orbit-satellite-fast" style={{ transformOrigin: "400px 400px" }}>
        <g transform="translate(535 400) rotate(12)">
          <path d="M-12-6h24l-5 12h-14z" fill="#a9b5c3" stroke="#e1e7ef" strokeWidth="1" />
          <path d="M-6-6l-5-12h22l-5 12M-6 6l-5 12h22L5 6" fill="url(#satellite-panel)" stroke="#7389a5" strokeWidth="1" />
          <circle cx="0" cy="0" r="3" fill="#33475e" />
          <path d="M12 0h14" stroke="#d3dae4" strokeWidth="1.5" />
        </g>
      </g>
    </svg>
  );
}
