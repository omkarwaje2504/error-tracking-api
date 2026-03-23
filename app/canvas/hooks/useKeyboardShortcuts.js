"use client";
// ─────────────────────────────────────────────
//  hooks/useKeyboardShortcuts.js
// ─────────────────────────────────────────────
import { useEffect } from "react";

export default function useKeyboardShortcuts({
  selectedIds,
  elements,
  onDelete,
  onDuplicate,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
  onDeselect,
  onSelectAll,
  onGroup,
  onUngroup,
  onMoveUp,
  onMoveDown,
  onNudge,
}) {
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName;
      // Don't intercept when user is typing in an input/textarea
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key   = e.key;
      const ctrl  = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (ctrl && key === "z") { e.preventDefault(); onUndo();      return; }
      if (ctrl && key === "y") { e.preventDefault(); onRedo();      return; }
      if (ctrl && key === "c") { e.preventDefault(); onCopy();      return; }
      if (ctrl && key === "v") { e.preventDefault(); onPaste();     return; }
      if (ctrl && key === "d") { e.preventDefault(); onDuplicate(); return; }
      if (ctrl && key === "a") { e.preventDefault(); onSelectAll(); return; }

      if (ctrl && !shift && key === "g") { e.preventDefault(); onGroup();   return; }
      if (ctrl &&  shift && key === "g") { e.preventDefault(); onUngroup(); return; }

      if (ctrl && key === "]") { e.preventDefault(); onMoveUp();   return; }
      if (ctrl && key === "[") { e.preventDefault(); onMoveDown(); return; }

      if ((key === "Delete" || key === "Backspace") && selectedIds.length) {
        e.preventDefault(); onDelete(); return;
      }
      if (key === "Escape") { onDeselect(); return; }

      const NUDGE = shift ? 10 : 1;
      if (key === "ArrowUp")    { e.preventDefault(); onNudge(0,     -NUDGE); return; }
      if (key === "ArrowDown")  { e.preventDefault(); onNudge(0,      NUDGE); return; }
      if (key === "ArrowLeft")  { e.preventDefault(); onNudge(-NUDGE, 0);     return; }
      if (key === "ArrowRight") { e.preventDefault(); onNudge( NUDGE, 0);     return; }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    selectedIds, elements,
    onDelete, onDuplicate, onCopy, onPaste,
    onUndo, onRedo, onDeselect, onSelectAll,
    onGroup, onUngroup, onMoveUp, onMoveDown, onNudge,
  ]);
}
