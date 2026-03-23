// ─────────────────────────────────────────────
//  lib/utils.js  — pure helper functions
// ─────────────────────────────────────────────
import { PX_PER, SNAP_THRESHOLD } from "./constants";

export const genId   = () => `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
export const px2unit = (px, u) => (px / PX_PER[u]).toFixed(2);
export const unit2px = (v,  u) => Math.round(parseFloat(v) * PX_PER[u]);
export const clamp   = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Returns the axis-aligned bounding box of a design element descriptor.
 */
export function elBox(el) {
  const x = el.x ?? 0;
  const y = el.y ?? 0;
  let w = el.width  ?? 160;
  let h = el.height ?? 80;

  if (el.type === "circle")   { w = (el.radius ?? 80) * 2; h = w; }
  if (el.type === "triangle") { w = (el.radius ?? 80) * 2; h = w; }
  if (el.type === "star")     { w = (el.outerRadius ?? 80) * 2; h = w; }

  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, r: x + w, b: y + h };
}

/**
 * Computes magnetic snap guide lines when dragging `moving` near `others`.
 * Returns `{ lines, snapped }` where `snapped` is the adjusted position.
 */
export function computeGuides(moving, others) {
  const m      = elBox(moving);
  const lines  = [];
  const snapped = { x: moving.x, y: moving.y };

  for (const o of others) {
    if (o.id === moving.id) continue;
    const b = elBox(o);

    // Vertical guide candidates (X axis alignment)
    const xPairs = [
      [m.x,  b.x,  b.x],
      [m.x,  b.r,  b.r],
      [m.cx, b.cx, b.cx],
      [m.r,  b.x,  b.x],
      [m.r,  b.r,  b.r],
    ];
    for (const [mv, bv, pos] of xPairs) {
      if (Math.abs(mv - bv) < SNAP_THRESHOLD) {
        lines.push({ type: "v", x: pos });
        snapped.x = moving.x + (bv - mv);
      }
    }

    // Horizontal guide candidates (Y axis alignment)
    const yPairs = [
      [m.y,  b.y,  b.y],
      [m.y,  b.b,  b.b],
      [m.cy, b.cy, b.cy],
      [m.b,  b.y,  b.y],
      [m.b,  b.b,  b.b],
    ];
    for (const [mv, bv, pos] of yPairs) {
      if (Math.abs(mv - bv) < SNAP_THRESHOLD) {
        lines.push({ type: "h", y: pos });
        snapped.y = moving.y + (bv - mv);
      }
    }
  }

  return { lines, snapped };
}
