"use client";
// ─────────────────────────────────────────────
//  components/left-panel/tools/ShapesTool.jsx
// ─────────────────────────────────────────────
import { PanelHeader, ColorGrid } from "../../ui-atoms";
import { SHAPE_TYPES, PALETTE } from "../../../../../lib/constants";

export default function ShapesTool({ addShape, fill, setFill }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <PanelHeader label="Shapes" />

      <div className="grid grid-cols-3 gap-2">
        {SHAPE_TYPES.map((s) => (
          <button
            key={s.id}
            onClick={() => addShape(s.id)}
            className="flex flex-col items-center gap-1 py-3 rounded-lg border border-gray-800 bg-gray-900 hover:bg-gray-800 transition-colors text-white text-2xl cursor-pointer"
          >
            {s.icon}
            <span className="text-xs text-gray-500">{s.label}</span>
          </button>
        ))}
      </div>

      <PanelHeader label="Fill Color" small />
      <ColorGrid colors={PALETTE} selected={fill} onSelect={setFill} />
      <input
        type="color"
        value={fill}
        onChange={(e) => setFill(e.target.value)}
        className="w-full h-9 rounded border border-gray-700 cursor-pointer bg-transparent"
      />
    </div>
  );
}
