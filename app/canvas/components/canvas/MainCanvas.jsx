"use client";
// ─────────────────────────────────────────────
//  components/canvas/MainCanvas.jsx
//  Konva Stage + Layer.
//  Owns: marquee-select, magnetic guides.
//  Zoom handled by parent viewport (NOT stage).
// ─────────────────────────────────────────────

import { useRef, useState, useEffect } from "react";
import { Stage, Layer, Rect, Line } from "react-konva";
import CanvasElement from "./CanvasElement";
import { elBox, computeGuides, clamp } from "../../../../lib/utils";

// ── Magnetic guide lines ─────────────────────
function MagneticGuides({ guides, canvasW, canvasH }) {
  if (!guides.length) return null;

  return (
    <>
      {guides.map((g, i) =>
        g.type === "v" ? (
          <Line
            key={i}
            points={[g.x, 0, g.x, canvasH]}
            stroke="#ef4444"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        ) : (
          <Line
            key={i}
            points={[0, g.y, canvasW, g.y]}
            stroke="#ef4444"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        ),
      )}
    </>
  );
}

// ── Marquee selection rectangle ──────────────
function MarqueeRect({ marquee }) {
  if (!marquee) return null;

  const { x1, y1, x2, y2 } = marquee;

  return (
    <Rect
      x={Math.min(x1, x2)}
      y={Math.min(y1, y2)}
      width={Math.abs(x2 - x1)}
      height={Math.abs(y2 - y1)}
      fill="rgba(255,255,255,0.06)"
      stroke="#ffffff"
      strokeWidth={1}
      dash={[4, 3]}
      listening={false}
    />
  );
}

// ── MainCanvas ───────────────────────────────
export default function MainCanvas({
  canvasW,
  canvasH,
  bgColor,
  elements,
  selectedIds,
  onSelect,
  onMultiSelect,
  onDeselect,
  onChangeElement,
  onChangeAndSnap,
  zoom,
  onZoomChange,
  stageRef,
}) {
  const innerRef = useRef(null);
  const [guides, setGuides] = useState([]);
  const [marquee, setMarquee] = useState(null);

  const isMarqueeRef = useRef(false);
  const marqueeStartRef = useRef(null);

  // expose stage to parent
  useEffect(() => {
    if (stageRef) stageRef.current = innerRef.current;
  });

  // ── wheel zoom (viewport zoom) ────────────
  const handleWheel = (e) => {
    e.evt.preventDefault();

    const zoomBy = 1.06;

    const newZoom =
      e.evt.deltaY < 0
        ? clamp(zoom * zoomBy, 10, 500)
        : clamp(zoom / zoomBy, 10, 500);

    onZoomChange(Math.round(newZoom));
  };

  // ── marquee start ─────────────────────────
  const handleMouseDown = (e) => {
    const stage = innerRef.current;

    if (e.target === stage || e.target.name() === "canvas-bg") {
      const stagePos = stage.getPointerPosition();

      isMarqueeRef.current = true;
      marqueeStartRef.current = stagePos;

      setMarquee({
        x1: stagePos.x,
        y1: stagePos.y,
        x2: stagePos.x,
        y2: stagePos.y,
      });

      onDeselect();
    }
  };

  // ── marquee drag ──────────────────────────
  const handleMouseMove = () => {
    if (!isMarqueeRef.current || !marqueeStartRef.current) return;

    const stage = innerRef.current;
    const pos = stage.getPointerPosition();

    setMarquee((m) => (m ? { ...m, x2: pos.x, y2: pos.y } : null));
  };

  // ── marquee end → multi-select ────────────
  const handleMouseUp = () => {
    if (!isMarqueeRef.current) return;

    isMarqueeRef.current = false;

    if (marquee) {
      const rx1 = Math.min(marquee.x1, marquee.x2);
      const ry1 = Math.min(marquee.y1, marquee.y2);
      const rx2 = Math.max(marquee.x1, marquee.x2);
      const ry2 = Math.max(marquee.y1, marquee.y2);

      if (rx2 - rx1 > 5 || ry2 - ry1 > 5) {
        const inside = elements.filter((el) => {
          const b = elBox(el);
          return b.x < rx2 && b.r > rx1 && b.y < ry2 && b.b > ry1;
        });

        if (inside.length) {
          onMultiSelect(inside.map((e) => e.id));
        }
      }
    }

    setMarquee(null);
  };

  // ── drag-move → magnetic guides ───────────
  const handleDragMove = (id, nx, ny) => {
    const moving = elements.find((e) => e.id === id);
    if (!moving) return;

    const others = elements.filter((e) => e.id !== id && e.visible !== false);

    const { lines } = computeGuides({ ...moving, x: nx, y: ny }, others);

    setGuides(lines);
  };

  // ── drag-end → clear guides ───────────────
  const handleDragEnd = (id, patch) => {
    setGuides([]);
    onChangeAndSnap(id, patch);
  };

  return (
    <Stage
      ref={innerRef}
      width={canvasW}
      height={canvasH}
      style={{
        display: "block",
        border: "1px solid #ccc",
        backgroundColor: bgColor,
        cursor: "default",
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
    >
      <Layer>
        {/* Canvas background */}
        <Rect
          name="canvas-bg"
          x={0}
          y={0}
          width={canvasW}
          height={canvasH}
          fill={bgColor}
        />

        {/* All elements */}
        {elements.map((el) => (
          <CanvasElement
            key={el.id}
            el={el}
            isSelected={selectedIds.includes(el.id)}
            onSelect={(id, additive) =>
              additive ? onMultiSelect([...selectedIds, id]) : onSelect(id)
            }
            onChange={(id, patch, snap) =>
              snap ? handleDragEnd(id, patch) : onChangeElement(id, patch)
            }
            onDragMove={handleDragMove}
            stageRef={innerRef}
          />
        ))}

        {/* Guides + marquee */}
        <MagneticGuides guides={guides} canvasW={canvasW} canvasH={canvasH} />

        <MarqueeRect marquee={marquee} />
      </Layer>
    </Stage>
  );
}
