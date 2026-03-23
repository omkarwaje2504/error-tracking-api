"use client";
// ─────────────────────────────────────────────
//  components/StatusBar.jsx
// ─────────────────────────────────────────────

export default function StatusBar({ elements, selectedIds, onGroup }) {
  return (
    <div className="h-8 bg-black border-t border-gray-800 flex items-center px-4 gap-4 flex-shrink-0 select-none">
      <span className="text-xs text-gray-700">Design Studio · react-konva</span>

      <div className="flex-1" />

      {selectedIds.length > 1 && (
        <button
          onClick={onGroup}
          className="text-xs text-gray-500 hover:text-white cursor-pointer transition-colors"
        >
          Group ({selectedIds.length}) — Ctrl+G
        </button>
      )}

      <span className="text-xs text-gray-700">
        {elements.length} element{elements.length !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
