"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

const UNDO_WINDOW_MS = 5000;

/**
 * Defers a delete-style server action behind a grace period instead of a
 * window.confirm() dialog: the item disappears immediately and a toast
 * offers "Undo" for a few seconds. Undo restores it and the server call
 * never happens; letting the toast expire commits the real delete.
 */
export function useUndoableDelete() {
  const pending = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; commit: () => void | Promise<void> }>());

  useEffect(() => {
    // A tab close, hard refresh, or full-page navigation (e.g. the Discord
    // OAuth redirect) within the undo window kills this component before
    // its setTimeout ever fires -- the user already saw a "Deleted" toast,
    // so the real delete needs to happen now rather than never. pagehide
    // fires reliably in all of those cases, unlike beforeunload.
    function flushPending() {
      for (const [key, entry] of pending.current) {
        clearTimeout(entry.timer);
        pending.current.delete(key);
        void entry.commit();
      }
    }
    window.addEventListener("pagehide", flushPending);
    return () => window.removeEventListener("pagehide", flushPending);
  }, []);

  function run({
    key,
    message,
    commit,
    onUndo,
  }: {
    /** Unique per pending deletion -- lets overlapping undoable deletes not clobber each other's timers. */
    key: string;
    message: string;
    commit: () => void | Promise<void>;
    onUndo: () => void;
  }) {
    const timer = setTimeout(() => {
      pending.current.delete(key);
      void commit();
    }, UNDO_WINDOW_MS);
    pending.current.set(key, { timer, commit });

    toast(message, {
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          const entry = pending.current.get(key);
          if (!entry) return;
          clearTimeout(entry.timer);
          pending.current.delete(key);
          onUndo();
        },
      },
    });
  }

  return run;
}
