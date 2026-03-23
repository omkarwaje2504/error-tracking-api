"use client";
// ─────────────────────────────────────────────
//  components/ShortcutsOverlay.jsx
// ─────────────────────────────────────────────
import { SHORTCUTS } from "../../../lib/constants";

export default function ShortcutsOverlay({ onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white text-lg font-bold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl cursor-pointer">✕</button>
        </div>

        <div className="flex flex-col gap-0.5">
          {Object.entries(SHORTCUTS).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between py-2 border-b border-gray-800"
            >
              <span className="text-gray-300 text-sm">{label}</span>
              <kbd className="bg-black border border-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded font-mono">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
