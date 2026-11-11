import type { SourceLink } from "@/lib/api/types";

export function Sources({ sources }: { sources: SourceLink[] }) {
  return (
    <ul className="sources">
      {sources.map((s) => (
        <li key={s.url}>
          <a href={s.url} rel="noreferrer">
            {s.title}
          </a>
          <small>
            {s.publisher}
            {s.note ? ` — ${s.note}` : ""}
          </small>
        </li>
      ))}
    </ul>
  );
}

export function Limitations({ items }: { items: string[] }) {
  return (
    <ul className="limits">
      {items.map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  );
}
