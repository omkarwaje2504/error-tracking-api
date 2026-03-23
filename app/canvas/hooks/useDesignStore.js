"use client";
// ─────────────────────────────────────────────
//  hooks/useDesignStore.js
//  Single source of truth for all element state,
//  canvas dimensions, undo/redo history, clipboard.
// ─────────────────────────────────────────────
import { useState, useRef, useCallback, useMemo } from "react";
import { genId } from "../../../lib/utils";

export default function useDesignStore(initialW = 800, initialH = 600) {
  const [elements,    setElements]    = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [canvasW,     setCanvasW]     = useState(initialW);
  const [canvasH,     setCanvasH]     = useState(initialH);
  const [bgColor,     setBgColor]     = useState("#ffffff");
  const [unit,        setUnit]        = useState("px");
  const [clipboard,   setClipboard]   = useState(null);

  const historyRef = useRef([]);
  const histIdxRef = useRef(-1);

  // ── history ──────────────────────────────
  const snapshot = useCallback((els) => {
    historyRef.current = historyRef.current.slice(0, histIdxRef.current + 1);
    historyRef.current.push(JSON.stringify(els));
    histIdxRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current--;
    setElements(JSON.parse(historyRef.current[histIdxRef.current]));
  }, []);

  const redo = useCallback(() => {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current++;
    setElements(JSON.parse(historyRef.current[histIdxRef.current]));
  }, []);

  // ── CRUD ─────────────────────────────────
  const addElement = useCallback((el) => {
    setElements((prev) => {
      const next = [...prev, { visible: true, locked: false, ...el }];
      snapshot(next);
      return next;
    });
    setSelectedIds([el.id]);
  }, [snapshot]);

  const updateElement = useCallback((id, patch) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  /** updateElement + push history snapshot */
  const updateElementAndSnap = useCallback((id, patch) => {
    setElements((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...patch } : e));
      snapshot(next);
      return next;
    });
  }, [snapshot]);

  const deleteElements = useCallback((ids) => {
    setElements((prev) => {
      const next = prev.filter((e) => !ids.includes(e.id));
      snapshot(next);
      return next;
    });
    setSelectedIds([]);
  }, [snapshot]);

  const duplicateElements = useCallback((ids) => {
    setElements((prev) => {
      const toDupe  = prev.filter((e) => ids.includes(e.id));
      const clones  = toDupe.map((e) => ({
        ...e, id: genId(), x: (e.x ?? 0) + 20, y: (e.y ?? 0) + 20,
      }));
      const next = [...prev, ...clones];
      snapshot(next);
      setSelectedIds(clones.map((c) => c.id));
      return next;
    });
  }, [snapshot]);

  // ── groups ───────────────────────────────
  const groupElements = useCallback((ids) => {
    if (ids.length < 2) return;
    const gid = genId();
    setElements((prev) => {
      const next = prev.map((e) => ids.includes(e.id) ? { ...e, groupId: gid } : e);
      snapshot(next);
      return next;
    });
    setSelectedIds(ids);
  }, [snapshot]);

  const ungroupElements = useCallback((ids) => {
    setElements((prev) => {
      const next = prev.map((e) => ids.includes(e.id) ? { ...e, groupId: undefined } : e);
      snapshot(next);
      return next;
    });
  }, [snapshot]);

  // ── z-order ──────────────────────────────
  const moveUp = useCallback((id) => {
    setElements((prev) => {
      const i = prev.findIndex((e) => e.id === id);
      if (i >= prev.length - 1) return prev;
      const a = [...prev];
      [a[i], a[i + 1]] = [a[i + 1], a[i]];
      return a;
    });
  }, []);

  const moveDown = useCallback((id) => {
    setElements((prev) => {
      const i = prev.findIndex((e) => e.id === id);
      if (i <= 0) return prev;
      const a = [...prev];
      [a[i], a[i - 1]] = [a[i - 1], a[i]];
      return a;
    });
  }, []);

  // ── clipboard ────────────────────────────
  const copySelected = useCallback((ids) => {
    setElements((prev) => {
      setClipboard(prev.filter((e) => ids.includes(e.id)));
      return prev;
    });
  }, []);

  const pasteClipboard = useCallback(() => {
    if (!clipboard) return;
    setElements((prev) => {
      const clones = clipboard.map((e) => ({
        ...e, id: genId(), x: (e.x ?? 0) + 20, y: (e.y ?? 0) + 20,
      }));
      const next = [...prev, ...clones];
      snapshot(next);
      setSelectedIds(clones.map((c) => c.id));
      return next;
    });
  }, [clipboard, snapshot]);

  // ── derived ──────────────────────────────
  const selectedEl  = useMemo(
    () => elements.find((e) => e.id === selectedIds[0]) ?? null,
    [elements, selectedIds]
  );
  const selectedEls = useMemo(
    () => elements.filter((e) => selectedIds.includes(e.id)),
    [elements, selectedIds]
  );

  return {
    // state
    elements, selectedIds, selectedEl, selectedEls,
    canvasW, canvasH, bgColor, unit,
    // setters
    setSelectedIds, setCanvasW, setCanvasH, setBgColor, setUnit,
    // actions
    addElement, updateElement, updateElementAndSnap,
    deleteElements, duplicateElements,
    groupElements, ungroupElements,
    moveUp, moveDown,
    copySelected, pasteClipboard,
    undo, redo,
  };
}
