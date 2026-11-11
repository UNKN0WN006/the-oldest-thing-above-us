import type { PassModel } from "@/lib/api/types";
import { duration, utcTime, zonedTime } from "@/lib/format";

export function describePath(p: PassModel): string {
  const whole = p.starts_before_window && p.ends_after_window;
  if (whole) {
    return `Above the threshold for the whole window, around ${p.culmination.elevation_deg.toFixed(0)}° high toward the ${p.culmination.compass}.`;
  }
  const start = p.starts_before_window ? `Already up in the ${p.start.compass}` : `Rises through the threshold in the ${p.start.compass}`;
  const end = p.ends_after_window ? `still up in the ${p.end.compass} when the window ends` : `drops below it in the ${p.end.compass}`;
  return `${start}, peaks ${p.culmination.elevation_deg.toFixed(0)}° high toward the ${p.culmination.compass}, ${end}.`;
}

export function PassTable({ passes, timezone }: { passes: PassModel[]; timezone?: string }) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="visually-hidden">Predicted passes inside the window</caption>
        <thead>
          <tr>
            <th scope="col">Start{timezone ? " (local)" : ""}</th>
            <th scope="col">UTC</th>
            <th scope="col">Peak</th>
            <th scope="col">Direction</th>
            <th scope="col">Lasts</th>
            <th scope="col">Range at peak</th>
            <th scope="col">Sky and sunlight</th>
          </tr>
        </thead>
        <tbody>
          {passes.map((p) => (
            <tr key={p.start.time}>
              <td>{zonedTime(p.start.time, timezone, true)}</td>
              <td>
                {utcTime(p.start.time)}–{utcTime(p.end.time)}
              </td>
              <td>{p.culmination.elevation_deg.toFixed(0)}°</td>
              <td>
                {p.start.compass} → {p.culmination.compass} → {p.end.compass}
              </td>
              <td>
                {duration(p.duration_s)}
                {p.starts_before_window || p.ends_after_window ? " (cut by window)" : ""}
              </td>
              <td>{Math.round(p.range_km).toLocaleString("en-GB")} km</td>
              <td className="wrap">{p.illumination_label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
