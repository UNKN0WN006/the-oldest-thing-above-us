/** datetime-local fields are entered in UTC for this application. */
export function utcWindowStart(value: string): string | null {
  if (!value) return null;
  // Reject malformed deep links before Date.toISOString() can throw.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Enter a valid UTC start date and time.");
  }
  const date = new Date(`${value}:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 16) !== value) {
    throw new Error("Enter a valid UTC start date and time.");
  }
  return date.toISOString();
}

export function validOptions(hours: number, minEl: number): boolean {
  return Number.isFinite(hours) && hours > 0 && hours <= 72 &&
    Number.isFinite(minEl) && minEl >= 0 && minEl <= 89;
}

