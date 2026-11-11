import type { Provenance as ProvenanceModel } from "@/lib/api/types";
import { elementAge, utcDateTime } from "@/lib/format";

const FRESHNESS: Record<ProvenanceModel["freshness"], string> = {
  fresh: "Fresh elements",
  aging: "Ageing elements",
  stale: "Stale elements",
};

export function ProvenanceLine({ provenance }: { provenance: ProvenanceModel }) {
  const modeClass = provenance.source === "live" ? "pill--live" : "pill--archived";
  return (
    <div className="provenance" data-testid="provenance">
      <span className={`pill ${modeClass}`}>{provenance.source === "live" ? "Live fetch" : "Archived capture"}</span>
      <span className={`pill pill--${provenance.freshness}`}>{FRESHNESS[provenance.freshness]}</span>
      <span>
        Element epoch {utcDateTime(provenance.element_epoch)} ({elementAge(provenance.element_age_days)})
      </span>
      <span>Retrieved {utcDateTime(provenance.retrieved_at)}</span>
      <a href={provenance.source_url} rel="noreferrer">
        CelesTrak GP source
      </a>
    </div>
  );
}
