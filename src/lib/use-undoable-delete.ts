"use client";

import { useRef } from "react";
import { toast } from "sonner";

const UNDO_WINDOW_MS = 5000;

/**
 * Defers a delete-style server action behind a grace period instead of a
 * window.confirm() dialog: the item disappears immediately and a toast
 * offers "Undo" for a few seconds. Undo restores it and the server call
 * never happens; letting the toast expire commits the real delete.
 */
export function useUndoableDelete() {
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());

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
    pending.current.set(key, timer);

    toast(message, {
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          const t = pending.current.get(key);
          if (!t) return;
          clearTimeout(t);
          pending.current.delete(key);
          onUndo();
        },
      },
    });
  }

  return run;
}
