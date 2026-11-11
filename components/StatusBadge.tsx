import type { ObjectStatus } from "@/lib/types";

export default function StatusBadge({ status }: { status: ObjectStatus }) {
  const color = status === "Active" ? "border-accent/40 text-accent" : "border-line text-muted";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
