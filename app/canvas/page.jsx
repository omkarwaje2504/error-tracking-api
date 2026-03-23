"use client";

/**
 * ╔══════════════════════════════════════════════════════════╗
 *  Design Studio  —  page.jsx  (root entry point)
 *  npm install react-konva konva
 *
 *  File map
 *  ├── page.jsx                               ← you are here
 *  ├── lib/
 *  │   ├── constants.js                       fonts · palette · presets
 *  │   └── utils.js                           genId · elBox · computeGuides · clamp
 *  ├── hooks/
 *  │   ├── useDesignStore.js                  all element / canvas state + undo
 *  │   └── useKeyboardShortcuts.js            global hotkeys
 *  ├── components/
 *  │   ├── ui-atoms.jsx                       TB · Divider · LBtn · PanelHeader · ColorGrid · Toggle
 *  │   ├── TopToolbar.jsx                     context-sensitive formatting bar
 *  │   ├── StatusBar.jsx                      bottom info bar
 *  │   ├── ShortcutsOverlay.jsx               ⌨ keyboard shortcut modal
 *  │   ├── canvas/
 *  │   │   ├── CanvasPanel.jsx                viewport wrapper + zoom HUD
 *  │   │   ├── MainCanvas.jsx                 Stage · Layer · marquee · guides
 *  │   │   └── CanvasElement.jsx              per-element Konva node + Transformer
 *  │   └── left-panel/
 *  │       ├── LeftPanel.jsx                  icon rail + content switcher
 *  │       └── tools/
 *  │           ├── TextTool.jsx
 *  │           ├── ShapesTool.jsx
 *  │           ├── PhotosTool.jsx
 *  │           ├── LayersTool.jsx
 *  │           ├── SizeTool.jsx
 *  │           └── EffectsTool.jsx
 * ╚══════════════════════════════════════════════════════════╝
 */

import { useState, useEffect, useCallback } from "react";

import useDesignStore        from "./hooks/useDesignStore";
import useKeyboardShortcuts  from "./hooks/useKeyboardShortcuts";

import LeftPanel             from "./components/left-panel/LeftPanel";
import TopToolbar            from "./components/TopToolbar";
import CanvasPanel           from "./components/canvas/CanvasPanel";
import StatusBar             from "./components/StatusBar";
import ShortcutsOverlay      from "./components/ShortcutsOverlay";

import { genId } from "./lib/utils";

export default function DesignStudio() {
  // ── central store ────────────────────────
  const store = useDesignStore(800, 600);
  const {
    elements, selectedIds, selectedEl,
    setSelectedIds,
    canvasW, canvasH, setCanvasW, setCanvasH,
    bgColor, setBgColor,
    unit, setUnit,
    addElement, updateElement, updateElementAndSnap,
    deleteElements, duplicateElements,
    groupElements, ungroupElements,
    moveUp, moveDown,
    copySelected, pasteClipboard,
    undo, redo,
  } = store;

  // ── UI state ─────────────────────────────
  const [activeTool,    setActiveTool]    = useState("text");
  const [showEffects,   setShowEffects]   = useState(false);
  const [shapeFill,     setShapeFill]     = useState("#3b82f6");
  const [zoom,          setZoom]          = useState(85);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── seed demo elements on first mount ────
  useEffect(() => {
    addElement({ id: genId(), type: "text",   x: 80,  y: 170, text: "Design Studio",                   fontSize: 52, fontFamily: "Playfair Display", fill: "#171717", align: "left", width: 640 });
    addElement({ id: genId(), type: "text",   x: 80,  y: 255, text: "Click any tool to start creating", fontSize: 18, fontFamily: "Montserrat",        fill: "#737373", align: "left", width: 500 });
    addElement({ id: genId(), type: "rect",   x: 630, y: 55,  width: 130, height: 90,  fill: "#171717", rotation: -8, cornerRadius: 8 });
    addElement({ id: genId(), type: "circle", x: 710, y: 490, radius: 55, fill: "#e5e5e5" });
    addElement({ id: genId(), type: "star",   x: 80,  y: 485, outerRadius: 50, innerRadius: 25, fill: "#a3a3a3" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── helpers ──────────────────────────────
  const handleUpdateSelected = useCallback((patch) => {
    if (selectedIds.length) updateElement(selectedIds[0], patch);
  }, [selectedIds, updateElement]);

  const addText = useCallback((text, fontSize, fontFamily) => {
    addElement({
      id: genId(), type: "text",
      x: canvasW / 2 - 160, y: canvasH / 2 - fontSize / 2,
      text, fontSize, fontFamily, fill: "#171717", align: "left", width: 320,
    });
  }, [addElement, canvasW, canvasH]);

  const addShape = useCallback((type) => {
    const cx = canvasW / 2, cy = canvasH / 2;
    const base = { id: genId(), type, x: cx, y: cy, fill: shapeFill };
    const configs = {
      rect:     { ...base, x: cx - 100, y: cy - 60, width: 200, height: 120, cornerRadius: 0 },
      circle:   { ...base, radius: 80 },
      triangle: { ...base, radius: 80 },
      star:     { ...base, innerRadius: 40, outerRadius: 80 },
      line:     { ...base, x: cx - 100, y: cy, points: [0, 0, 200, 0], strokeWidth: 3 },
      arrow:    { ...base, x: cx - 100, y: cy, points: [0, 0, 200, 0], strokeWidth: 3 },
    };
    if (configs[type]) addElement(configs[type]);
  }, [addElement, canvasW, canvasH, shapeFill]);

  const addImage = useCallback((imgObj, iw, ih) => {
    const maxW = canvasW * 0.55, maxH = canvasH * 0.55;
    let w = iw, h = ih;
    if (w > maxW) { h = h * maxW / w; w = maxW; }
    if (h > maxH) { w = w * maxH / h; h = maxH; }
    addElement({ id: genId(), type: "image", x: canvasW / 2 - w / 2, y: canvasH / 2 - h / 2, width: w, height: h, imgObj });
  }, [addElement, canvasW, canvasH]);

  // ── keyboard shortcuts ───────────────────
  useKeyboardShortcuts({
    selectedIds,
    elements,
    onDelete:    () => deleteElements(selectedIds),
    onDuplicate: () => duplicateElements(selectedIds),
    onCopy:      () => copySelected(selectedIds),
    onPaste:     () => pasteClipboard(),
    onUndo:      undo,
    onRedo:      redo,
    onDeselect:  () => setSelectedIds([]),
    onSelectAll: () => setSelectedIds(elements.map((e) => e.id)),
    onGroup:     () => groupElements(selectedIds),
    onUngroup:   () => ungroupElements(selectedIds),
    onMoveUp:    () => selectedIds.forEach((id) => moveUp(id)),
    onMoveDown:  () => selectedIds.forEach((id) => moveDown(id)),
    onNudge:     (dx, dy) =>
      selectedIds.forEach((id) => {
        const el = elements.find((e) => e.id === id);
        if (el) updateElement(id, { x: (el.x ?? 0) + dx, y: (el.y ?? 0) + dy });
      }),
  });

  // ── render ───────────────────────────────
  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">

      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Montserrat:wght@400;600;700&family=Oswald&family=Lato&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar          { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track    { background: #000; }
        ::-webkit-scrollbar-thumb    { background: #333; border-radius: 4px; }
        input[type=range]            { accent-color: #ffffff; }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
      `}</style>

      {/* ① Left panel — icon rail + tool panels */}
      <LeftPanel
        activeTool={activeTool}    setActiveTool={setActiveTool}
        showEffects={showEffects}  setShowEffects={setShowEffects}
        /* text */
        addText={addText}          bgColor={bgColor}   setBgColor={setBgColor}
        /* shapes */
        addShape={addShape}        shapeFill={shapeFill} setShapeFill={setShapeFill}
        /* photos */
        addImage={addImage}
        /* layers */
        elements={elements}        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        updateElement={updateElement}
        deleteElements={deleteElements}
        moveUp={moveUp}            moveDown={moveDown}
        /* size */
        canvasW={canvasW}          canvasH={canvasH}
        unit={unit}                setUnit={setUnit}
        setCanvasW={setCanvasW}    setCanvasH={setCanvasH}
        /* effects */
        selectedEl={selectedEl}    onUpdateSelected={handleUpdateSelected}
      />

      {/* ② Right area — toolbar + canvas + status */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top toolbar */}
        <TopToolbar
          selectedEl={selectedEl}
          selectedIds={selectedIds}
          onUpdate={handleUpdateSelected}
          onDelete={() => deleteElements(selectedIds)}
          onDuplicate={() => duplicateElements(selectedIds)}
          onMoveUp={() => selectedIds.forEach((id) => moveUp(id))}
          onMoveDown={() => selectedIds.forEach((id) => moveDown(id))}
          onOpenEffects={() => setShowEffects(true)}
          onShowShortcuts={() => setShowShortcuts(true)}
          onUndo={undo}
          onRedo={redo}
        />

        {/* Canvas viewport */}
        <CanvasPanel
          canvasW={canvasW}        canvasH={canvasH}
          bgColor={bgColor}        unit={unit}
          elements={elements}      selectedIds={selectedIds}
          selectedEl={selectedEl}
          onSelect={(id) => setSelectedIds([id])}
          onMultiSelect={setSelectedIds}
          onDeselect={() => setSelectedIds([])}
          onChangeElement={updateElement}
          onChangeAndSnap={updateElementAndSnap}
          zoom={zoom}              onZoomChange={setZoom}
        />

        {/* Status bar */}
        <StatusBar
          elements={elements}
          selectedIds={selectedIds}
          onGroup={() => groupElements(selectedIds)}
        />
      </div>

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
