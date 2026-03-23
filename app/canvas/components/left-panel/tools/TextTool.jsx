"use client";
// ─────────────────────────────────────────────
//  components/left-panel/tools/TextTool.jsx
// ─────────────────────────────────────────────
import { PanelHeader, ColorGrid } from "../../ui-atoms";
import { PALETTE } from "../../../../../lib/constants";

const TEXT_PRESETS = [
  { label: "Add Heading",     size: 48, font: "Playfair Display" },
  { label: "Add Sub Heading", size: 28, font: "Montserrat"       },
  { label: "Add Body Text",   size: 16, font: "Lato"             },
  { label: "Add Caption",     size: 11, font: "Georgia"          },
];

export default function TextTool({ addText, bgColor, setBgColor }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <PanelHeader label="Text" />
      <p className="text-xs text-gray-500">Click a style to add to canvas</p>

      {TEXT_PRESETS.map((p) => (
        <button
          key={p.label}
          onClick={() => addText(p.label, p.size, p.font)}
          className="w-full px-3 py-3 rounded-lg border border-gray-800 bg-gray-900 hover:bg-gray-800 transition-colors text-left text-white cursor-pointer"
          style={{
            fontFamily:  p.font,
            fontSize:    `${Math.min(p.size * 0.4, 18)}px`,
            fontWeight:  p.size > 24 ? 700 : 400,
          }}
        >
          {p.label}
        </button>
      ))}

      {/* Background colour section */}
      <div className="mt-2">
        <PanelHeader label="Background Color" small />
        <div className="mt-2">
          <ColorGrid
            colors={PALETTE.slice(0, 16)}
            selected={bgColor}
            onSelect={setBgColor}
          />
          <input
            type="color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            className="mt-2 w-full h-9 rounded border border-gray-700 cursor-pointer bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}
