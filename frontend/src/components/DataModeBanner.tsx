"use client";

import { utcDateTime } from "@/lib/format";
import { useStatus } from "@/lib/useStatus";

/** Summarizes archive-only or partially refreshed datasets on every page. */
export function DataModeBanner() {
  const { status, error } = useStatus();
  if (error && !status) {
    return (
      <div className="mode-banner" role="status">
        The data service is not reachable. Pages that need orbital data will say so rather than show placeholder
        results.
      </div>
    );
  }
  if (!status || status.data_mode === "live") return null;
  if (status.data_mode === "mixed") {
    return (
      <div className="mode-banner" role="status" data-testid="mode-banner">
        <strong>Partially refreshed data.</strong>
        <span>
          {status.elements_live} live element sets and {status.elements_snapshot} archived sets are available.
          Each satellite shows its source and element epoch; archived records may be too old for current predictions.
          {status.refresh?.running ? " Refresh in progress." : ""}
        </span>
      </div>
    );
  }
  return (
    <div className="mode-banner" role="status" data-testid="mode-banner">
      <strong>Demonstration data.</strong>
      <span>
        Orbital elements are from an archived CelesTrak capture dated {status.snapshot_captured_at ? utcDateTime(status.snapshot_captured_at) : "an earlier date"}.
        {status.refresh?.running ? " Live refresh is in progress." : ""} Predictions are calculated for the selected
        window, but archived elements may be unsuitable for current dates.
      </span>
    </div>
  );
}
