"use client";
// ─────────────────────────────────────────────
//  components/canvas/CanvasElement.jsx
//  Renders one design element on the Konva stage.
//  Handles selection, transform, drag and double-click text edit.
// ─────────────────────────────────────────────
import { useRef, useEffect } from "react";
import {
  Text, Rect, Circle, RegularPolygon, Star,
  Line, Arrow, Image as KImage, Transformer,
} from "react-konva";

export default function CanvasElement({
  el,
  isSelected,
  onSelect,
  onChange,
  onDragMove,
  stageRef,
}) {
  const shapeRef = useRef(null);
  const trRef    = useRef(null);

  // Attach transformer whenever this node becomes selected
  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // ── event handlers ───────────────────────
  const handleDragEnd = (e) =>
    onChange(el.id, { x: e.target.x(), y: e.target.y() }, true);

  const handleDragMove = (e) =>
    onDragMove?.(el.id, e.target.x(), e.target.y());

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChange(el.id, {
      x:        node.x(),
      y:        node.y(),
      rotation: node.rotation(),
      width:    Math.max(5, (el.width  || 100) * sx),
      height:   Math.max(5, (el.height || 100) * sy),
    }, true);
  };

  // Floating textarea for inline text editing (dbl-click)
  const handleDblClick = () => {
    if (el.type !== "text") return;
    const stage = stageRef.current;
    if (!stage) return;

    const node   = shapeRef.current;
    const box    = stage.container().getBoundingClientRect();
    const absPos = node.getAbsolutePosition();
    const scale  = stage.scaleX();

    const ta = document.createElement("textarea");
    ta.value = el.text ?? "";
    Object.assign(ta.style, {
      position:      "fixed",
      zIndex:        "9999",
      resize:        "none",
      outline:       "none",
      left:          `${box.left + absPos.x}px`,
      top:           `${box.top  + absPos.y}px`,
      width:         `${Math.max(node.width() * scale + 20, 160)}px`,
      minHeight:     "40px",
      fontSize:      `${(el.fontSize ?? 24) * scale}px`,
      fontFamily:    el.fontFamily,
      fontWeight:    el.bold   ? "bold"   : "normal",
      fontStyle:     el.italic ? "italic" : "normal",
      color:         el.fill   ?? "#171717",
      background:    "rgba(0,0,0,0.9)",
      border:        "2px solid #ffffff",
      borderRadius:  "4px",
      padding:       "4px",
      lineHeight:    ((el.lineHeight ?? 120) / 100).toFixed(2),
      letterSpacing: `${el.letterSpacing ?? 0}px`,
    });

    document.body.appendChild(ta);
    ta.focus();
    ta.select();

    const done = () => {
      onChange(el.id, { text: ta.value }, true);
      if (document.body.contains(ta)) document.body.removeChild(ta);
    };
    ta.addEventListener("blur", done);
    ta.addEventListener("keydown", (ev) => { if (ev.key === "Escape") done(); });
  };

  if (!el.visible) return null;

  // ── build Konva props ────────────────────
  const shadowProps = el.effects?.shadow?.enabled
    ? {
        shadowColor:   el.effects.shadow.color    ?? "#000000",
        shadowBlur:    el.effects.shadow.blur      ?? 16,
        shadowOffsetX: el.effects.shadow.offsetX   ?? 0,
        shadowOffsetY: el.effects.shadow.offsetY   ?? 0,
        shadowOpacity: (el.effects.shadow.opacity  ?? 50) / 100,
      }
    : {};

  const strokeProps = el.effects?.stroke?.enabled
    ? { stroke: el.effects.stroke.color ?? "#000000", strokeWidth: el.effects.stroke.width ?? 2 }
    : { stroke: "transparent", strokeWidth: 0 };

  const common = {
    id:        el.id,
    x:         el.x        ?? 0,
    y:         el.y        ?? 0,
    rotation:  el.rotation ?? 0,
    opacity:   (el.opacity ?? 100) / 100,
    draggable: !el.locked,
    onClick:   (e) => { e.cancelBubble = true; onSelect(el.id, e.evt.shiftKey || e.evt.metaKey); },
    onTap:     (e) => { e.cancelBubble = true; onSelect(el.id, false); },
    onDragEnd: handleDragEnd,
    onDragMove: handleDragMove,
    onTransformEnd: handleTransformEnd,
    ...shadowProps,
    filters:    el.effects?.blur?.enabled ? ["Blur"] : [],
    blurRadius: el.effects?.blur?.amount  ?? 0,
  };

  // ── node switch ──────────────────────────
  let node = null;

  switch (el.type) {
    case "text":
      node = (
        <Text
          ref={shapeRef} {...common}
          text={el.text ?? "Text"}
          fontSize={el.fontSize ?? 24}
          fontFamily={el.fontFamily ?? "Montserrat"}
          fontStyle={[el.bold ? "bold" : "", el.italic ? "italic" : ""].filter(Boolean).join(" ") || "normal"}
          textDecoration={[el.underline ? "underline" : "", el.strikethrough ? "line-through" : ""].filter(Boolean).join(" ") || ""}
          fill={el.fill ?? "#171717"}
          align={el.align ?? "left"}
          verticalAlign={el.verticalAlign ?? "top"}
          width={el.width ?? 320}
          wrap="word"
          lineHeight={(el.lineHeight ?? 120) / 100}
          letterSpacing={el.letterSpacing ?? 0}
          onDblClick={handleDblClick}
          onDblTap={handleDblClick}
        />
      );
      break;

    case "rect":
      node = (
        <Rect
          ref={shapeRef} {...common} {...strokeProps}
          width={el.width ?? 200} height={el.height ?? 120}
          fill={el.fill ?? "#3b82f6"}
          cornerRadius={el.cornerRadius ?? 0}
        />
      );
      break;

    case "circle":
      node = (
        <Circle ref={shapeRef} {...common} {...strokeProps}
          radius={el.radius ?? 80} fill={el.fill ?? "#3b82f6"} />
      );
      break;

    case "triangle":
      node = (
        <RegularPolygon ref={shapeRef} {...common} {...strokeProps}
          sides={3} radius={el.radius ?? 80} fill={el.fill ?? "#3b82f6"} />
      );
      break;

    case "star":
      node = (
        <Star ref={shapeRef} {...common} {...strokeProps}
          numPoints={5}
          innerRadius={el.innerRadius ?? 40}
          outerRadius={el.outerRadius ?? 80}
          fill={el.fill ?? "#f59e0b"} />
      );
      break;

    case "line":
      node = (
        <Line ref={shapeRef} {...common}
          points={el.points ?? [0, 0, 160, 0]}
          stroke={el.fill ?? "#3b82f6"}
          strokeWidth={el.strokeWidth ?? 3}
          lineCap="round" />
      );
      break;

    case "arrow":
      node = (
        <Arrow ref={shapeRef} {...common}
          points={el.points ?? [0, 0, 160, 0]}
          fill={el.fill ?? "#3b82f6"}
          stroke={el.fill ?? "#3b82f6"}
          strokeWidth={el.strokeWidth ?? 3}
          pointerLength={16} pointerWidth={16} />
      );
      break;

    case "image":
      if (!el.imgObj) return null;
      node = (
        <KImage ref={shapeRef} {...common}
          image={el.imgObj}
          width={el.width ?? 200}
          height={el.height ?? 200} />
      );
      break;

    default:
      return null;
  }

  return (
    <>
      {node}
      {isSelected && (
        <Transformer
          ref={trRef}
          borderStroke="#ffffff"
          borderStrokeWidth={2}
          borderDash={[4, 4]}
          anchorStroke="#ffffff"
          anchorFill="#000000"
          anchorSize={10}
          anchorCornerRadius={3}
          rotateEnabled={true}
          keepRatio={["circle", "star", "triangle"].includes(el.type)}
          enabledAnchors={["line", "arrow"].includes(el.type) ? [] : undefined}
        />
      )}
    </>
  );
}
