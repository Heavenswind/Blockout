// Snapshot-based undo. Levels are immutable, so a snapshot is just a reference.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const LIMIT = 200;

export const historyOf = <T>(present: T): History<T> => ({ past: [], present, future: [] });

/** Records `next` as a new undo step. No-op if nothing changed. */
export function commit<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: [] };
}

/** Replaces the present without adding an undo step (used while a drag is in progress). */
export const replace = <T>(h: History<T>, next: T): History<T> => (next === h.present ? h : { ...h, present: next });

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
