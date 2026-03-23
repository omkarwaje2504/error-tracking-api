"use client";
// ─────────────────────────────────────────────
//  components/TopToolbar.jsx
//  Context-sensitive formatting bar at the top.
// ─────────────────────────────────────────────
import { useState } from "react";
import { TB, Divider } from "./ui-atoms";
import { FONTS, PALETTE } from "../../../lib/constants";

export default function TopToolbar({
  selectedEl,
  selectedIds,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onOpenEffects,
  onShowShortcuts,
  onUndo,
  onRedo,
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const isText = selectedEl?.type === "text";
  const fSize  = selectedEl?.fontSize ?? 24;

  return (
    <div className="h-14 bg-black border-b border-gray-800 flex items-center px-3 gap-2 flex-shrink-0 overflow-x-auto">
      {/* Undo / Redo */}
      <TB onClick={onUndo} title="Undo (Ctrl+Z)">↩</TB>
      <TB onClick={onRedo} title="Redo (Ctrl+Y)">↪</TB>
      <Divider />

      {/* ── Text-specific controls ── */}
      {isText && (
        <>
          {/* Font family */}
          <select
            value={selectedEl.fontFamily ?? "Montserrat"}
            onChange={(e) => onUpdate({ fontFamily: e.target.value })}
            className="bg-gray-900 border border-gray-700 text-white text-sm rounded px-2 py-1.5 max-w-[145px]"
          >
            {FONTS.map((f) => <option key={f}>{f}</option>)}
          </select>

          {/* Font size  − / input / + */}
          <div className="flex items-center border border-gray-700 rounded overflow-hidden flex-shrink-0">
            <button
              onClick={() => onUpdate({ fontSize: Math.max(4, fSize - 1) })}
              className="bg-gray-900 text-white px-2.5 py-1.5 hover:bg-gray-800 text-sm font-bold cursor-pointer"
            >−</button>
            <input
              type="number"
              value={fSize}
              onChange={(e) => onUpdate({ fontSize: Math.max(1, Number(e.target.value)) })}
              className="w-12 bg-gray-900 text-white text-sm text-center border-x border-gray-700 py-1.5"
            />
            <button
              onClick={() => onUpdate({ fontSize: fSize + 1 })}
              className="bg-gray-900 text-white px-2.5 py-1.5 hover:bg-gray-800 text-sm font-bold cursor-pointer"
            >+</button>
          </div>

          <Divider />

          {/* Horizontal alignment */}
          {[
            { v: "left",   icon: "⫤", title: "Align Left"   },
            { v: "center", icon: "≡", title: "Align Centre" },
            { v: "right",  icon: "⫥", title: "Align Right"  },
          ].map((a) => (
            <TB key={a.v} active={selectedEl.align === a.v}
              onClick={() => onUpdate({ align: a.v })} title={a.title}>{a.icon}</TB>
          ))}
          <Divider />

          {/* Vertical alignment */}
          {[
            { v: "top",    icon: "↟", title: "Align Top"    },
            { v: "middle", icon: "↕", title: "Align Middle" },
            { v: "bottom", icon: "↡", title: "Align Bottom" },
          ].map((a) => (
            <TB key={a.v} active={selectedEl.verticalAlign === a.v}
              onClick={() => onUpdate({ verticalAlign: a.v })} title={a.title}>{a.icon}</TB>
          ))}
          <Divider />

          {/* B I U S */}
          <TB active={selectedEl.bold}
            onClick={() => onUpdate({ bold: !selectedEl.bold })}
            title="Bold" style={{ fontWeight: 700 }}>B</TB>
          <TB active={selectedEl.italic}
            onClick={() => onUpdate({ italic: !selectedEl.italic })}
            title="Italic" style={{ fontStyle: "italic" }}>I</TB>
          <TB active={selectedEl.underline}
            onClick={() => onUpdate({ underline: !selectedEl.underline })}
            title="Underline" className="underline">U</TB>
          <TB active={selectedEl.strikethrough}
            onClick={() => onUpdate({ strikethrough: !selectedEl.strikethrough })}
            title="Strikethrough">S̶</TB>
          <Divider />

          {/* Text colour swatch */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker((p) => !p)}
              className="flex flex-col items-center justify-center w-9 h-9 rounded border border-gray-700 bg-gray-900 hover:bg-gray-800 cursor-pointer"
            >
              <span className="text-white text-sm font-bold leading-none">A</span>
              <span className="block w-5 h-1 rounded mt-0.5"
                style={{ background: selectedEl.fill ?? "#171717" }} />
            </button>
            {showColorPicker && (
              <div className="absolute top-10 left-0 bg-gray-900 border border-gray-700 rounded-xl p-2 z-50 grid grid-cols-6 gap-1 w-44">
                {PALETTE.map((c) => (
                  <div key={c}
                    onClick={() => { onUpdate({ fill: c }); setShowColorPicker(false); }}
                    className="w-6 h-6 rounded cursor-pointer border"
                    style={{ background: c, borderColor: selectedEl.fill === c ? "#fff" : "#374151" }}
                  />
                ))}
              </div>
            )}
          </div>
          <Divider />
        </>
      )}

      {/* ── Generic element actions ── */}
      {selectedIds.length > 0 && (
        <>
          <TB onClick={onMoveUp}    title="Bring Forward (Ctrl+])">⬆</TB>
          <TB onClick={onMoveDown}  title="Send Backward (Ctrl+[)">⬇</TB>
          <TB onClick={onDuplicate} title="Duplicate (Ctrl+D)">⧉</TB>
          <TB onClick={onDelete}    title="Delete (Del)"
            className="text-red-400 hover:text-red-300">✕</TB>
          <Divider />
        </>
      )}

      {/* Effects button */}
      <button
        onClick={onOpenEffects}
        className="px-3 py-1.5 rounded bg-gray-900 border border-gray-700 text-white text-sm font-semibold hover:bg-gray-800 transition-colors whitespace-nowrap"
      >
        ✦ Effects
      </button>

      <div className="flex-1" />

      {/* Shortcuts / Export */}
      <button
        onClick={onShowShortcuts}
        className="px-3 py-1.5 rounded bg-gray-900 border border-gray-700 text-white text-sm hover:bg-gray-800 whitespace-nowrap"
      >⌨ Keys</button>
      <button className="px-3 py-1.5 rounded bg-gray-900 border border-gray-700 text-white text-sm hover:bg-gray-800 whitespace-nowrap">
        ⬇ Export
      </button>
    </div>
  );
}
