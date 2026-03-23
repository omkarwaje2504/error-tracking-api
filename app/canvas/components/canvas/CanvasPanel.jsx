"use client";
// ─────────────────────────────────────────────
//  components/canvas/CanvasPanel.jsx
//  Viewport wrapper: dotted background, zoom HUD,
//  canvas info label, selected-element tooltip.
// ─────────────────────────────────────────────
import { useRef, useCallback, useEffect } from "react";
import MainCanvas from "./MainCanvas";
import { clamp, px2unit } from "../../../../lib/utils";

export default function CanvasPanel({
  canvasW,
  canvasH,
  bgColor,
  unit,
  elements,
  selectedIds,
  selectedEl,
  onSelect,
  onMultiSelect,
  onDeselect,
  onChangeElement,
  onChangeAndSnap,
  zoom,
  onZoomChange,
}) {
  const viewportRef = useRef(null);
  const stageRef = useRef(null);

  useEffect(() => {
    fitToViewport();
  }, [canvasW, canvasH]);

  // ── fit canvas inside viewport ───────────
  const fitToViewport = useCallback(() => {
    const vp = viewportRef.current;
    const stage = stageRef.current;
    if (!vp || !stage) return;

    const vw = vp.offsetWidth;
    const vh = vp.offsetHeight;

    const padding = 80;

    const scaleX = (vw - padding) / canvasW;
    const scaleY = (vh - padding) / canvasH;

    const safeScale = Math.max(0.05, Math.min(scaleX, scaleY));

    stage.scale({ x: safeScale, y: safeScale });

    stage.position({
      x: (vw - canvasW * safeScale) / 2,
      y: (vh - canvasH * safeScale) / 2,
    });

    stage.batchDraw();
    onZoomChange(Math.round(safeScale * 100));
  }, [canvasW, canvasH, onZoomChange]);

  return (
    <div
      ref={viewportRef}
      className="flex-1 relative overflow-hidden bg-neutral-900 border-4 border-neutral-700 rounded-lg"
      style={{
        backgroundImage:
          "radial-gradient(circle, #2a2a2a 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* Centred canvas */}
      <div className="absolute inset-0 overflow-hidden bg-[#e7e7e7] flex items-center justify-center">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "center center",
          }}
        >
          <MainCanvas
            canvasW={canvasW}
            canvasH={canvasH}
            bgColor={bgColor}
            elements={elements}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onMultiSelect={onMultiSelect}
            onDeselect={onDeselect}
            onChangeElement={onChangeElement}
            onChangeAndSnap={onChangeAndSnap}
            zoom={zoom}
            onZoomChange={onZoomChange}
            stageRef={stageRef}
          />
        </div>
      </div>

      {/* ── Zoom HUD (bottom-right) ── */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-black border border-gray-700 rounded-xl px-3 py-2 shadow-xl z-10">
        <button
          onClick={() => onZoomChange(clamp(zoom - 10, 10, 500))}
          className="text-white text-lg leading-none w-7 h-7 flex items-center justify-center hover:bg-gray-800 rounded cursor-pointer"
        >
          −
        </button>

        <button
          onClick={fitToViewport}
          className="text-sm text-gray-400 min-w-[52px] text-center hover:text-white cursor-pointer font-mono"
          title="Click to fit canvas"
        >
          {zoom}%
        </button>

        <button
          onClick={() => onZoomChange(clamp(zoom + 10, 10, 500))}
          className="text-white text-lg leading-none w-7 h-7 flex items-center justify-center hover:bg-gray-800 rounded cursor-pointer"
        >
          +
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        <button
          onClick={fitToViewport}
          title="Fit to screen"
          className="text-xs text-gray-500 hover:text-white cursor-pointer px-1"
        >
          ⊞
        </button>
      </div>

      {/* ── Canvas size info (bottom-left) ── */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-700 font-mono pointer-events-none">
        {canvasW}×{canvasH}px
        {unit !== "px" &&
          ` · ${px2unit(canvasW, unit)}×${px2unit(canvasH, unit)} ${unit}`}
      </div>

      {/* ── Selected element tooltip (top-centre) ── */}
      {selectedEl && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 pointer-events-none z-10">
          {selectedEl.type} · x:{Math.round(selectedEl.x ?? 0)} y:
          {Math.round(selectedEl.y ?? 0)}
          {selectedIds.length > 1 && (
            <span className="ml-2 text-gray-500">
              +{selectedIds.length - 1} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
