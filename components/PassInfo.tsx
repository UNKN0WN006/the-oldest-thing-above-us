type Props = { start: string; peak: string; end: string; maxElevation: number };

export default function PassInfo({ start, peak, end, maxElevation }: Props) {
  const times = [
    { label: "Starts", time: start },
    { label: "Highest point", time: peak },
    { label: "Ends", time: end },
  ];

  return (
    <section className="rounded-xl border border-line bg-panel/60 p-6 sm:p-8">
      <h2 className="label">Sample orbital pass</h2>
      <p className="mt-2 font-serif text-3xl">Peak time: {peak}</p>
      <p className="mt-1 max-w-lg text-muted">
        It climbs {maxElevation}° above the horizon. 0° is the horizon and 90° is straight overhead.
      </p>
      <p className="mt-3 text-sm text-muted">
        Demo values only. This does not confirm a visible pass or naked-eye visibility.
      </p>

      <svg viewBox="0 0 300 110" aria-hidden className="mt-6 h-auto w-full max-w-md">
        <line x1="0" y1="100" x2="300" y2="100" stroke="currentColor" className="text-line" />
        <path d="M10 100 Q150 -20 290 100" fill="none" stroke="var(--color-accent)" strokeOpacity="0.6" strokeDasharray="4 5" />
        <circle cx="150" cy="40" r="5" fill="var(--color-accent)" />
      </svg>

      <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5 text-center">
        {times.map((t) => (
          <div key={t.label}>
            <dt className="label">{t.label}</dt>
            <dd className="mt-1 text-lg">{t.time}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
