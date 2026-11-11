/** The last place the user searched from, kept in this browser only (a convenience, not an account). */
export interface SavedObserver {
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
  timezone?: string;
}

const KEY = "aboveus.observer.v1";

export function loadObserver(): SavedObserver | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as SavedObserver;
    return typeof v.latitudeDeg === "number" && typeof v.longitudeDeg === "number" ? v : null;
  } catch {
    return null;
  }
}

export function saveObserver(observer: SavedObserver): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(observer));
  } catch {
    /* private mode or blocked storage: the page works without it */
  }
}
