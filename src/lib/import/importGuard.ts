/**
 * Notices when the page reloaded in the middle of an import. Mobile browsers
 * reload a tab that runs out of memory, which used to look like the video
 * simply vanishing. A note is left in this tab's sessionStorage when an import
 * starts and removed when it ends; if it is still there on the next load, the
 * import never finished. Storage may be unavailable (private mode, blocked),
 * in which case every function quietly does nothing.
 */

const KEY = "panelly:import";

export interface InterruptedImport {
  sizeMb: number;
}

type NoteStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function session(): NoteStore | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function markImportStart(file: { size: number }, store = session()): void {
  try {
    store?.setItem(KEY, JSON.stringify({ sizeMb: Math.round(file.size / (1024 * 1024)) }));
  } catch {
    // Storage full or blocked: nothing to remember.
  }
}

export function markImportEnd(store = session()): void {
  try {
    store?.removeItem(KEY);
  } catch {
    // Storage blocked: nothing to clear.
  }
}

/** The import the last page load didn't finish, if any. Doesn't clear it; `markImportEnd` does. */
export function interruptedImport(store = session()): InterruptedImport | null {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return null;
    const note: unknown = JSON.parse(raw);
    const sizeMb = (note as { sizeMb?: unknown } | null)?.sizeMb;
    return typeof sizeMb === "number" ? { sizeMb } : null;
  } catch {
    return null;
  }
}

export function interruptedImportMessage({ sizeMb }: InterruptedImport): string {
  return `The page reloaded while opening your last video (${sizeMb} MB), most likely because the browser ran out of memory. Try a shorter clip, or save it at a lower resolution such as 1080p, then pick it again.`;
}
