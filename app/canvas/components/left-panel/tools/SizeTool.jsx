"use client";
// ─────────────────────────────────────────────
//  components/left-panel/tools/SizeTool.jsx
// ─────────────────────────────────────────────
import { useState, useEffect } from "react";
import { PanelHeader } from "../../ui-atoms";
import { UNITS, PRESET_SIZES } from "../../../../../lib/constants";
import { px2unit, unit2px } from "../../../../../lib/utils";

export default function SizeTool({
  canvasW, canvasH, unit, setUnit, setCanvasW, setCanvasH,
}) {
  const [wVal,   setWVal]   = useState(px2unit(canvasW, unit));
  const [hVal,   setHVal]   = useState(px2unit(canvasH, unit));
  const [active, setActive] = useState("");

  useEffect(() => {
    setWVal(px2unit(canvasW, unit));
    setHVal(px2unit(canvasH, unit));
  }, [canvasW, canvasH, unit]);

  const apply = () => {
    setCanvasW(unit2px(wVal, unit));
    setCanvasH(unit2px(hVal, unit));
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <PanelHeader label="Canvas Size" />

      {/* Unit tabs */}
      <div className="flex gap-1">
        {UNITS.map((u) => (
          <button
            key={u}
            onClick={() => setUnit(u)}
            className={`flex-1 py-1.5 rounded text-sm font-bold transition-colors ${
              unit === u
                ? "bg-white text-black"
                : "bg-gray-900 text-gray-400 hover:bg-gray-800"
            }`}
          >
            {u}
          </button>
        ))}
      </div>

      {/* W / H inputs */}
      <div className="flex gap-3">
        {[["W", wVal, setWVal], ["H", hVal, setHVal]].map(([lbl, val, set]) => (
          <div key={lbl} className="flex-1">
            <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">
              {lbl} ({unit})
            </div>
            <input
              type="number"
              value={val}
              onChange={(e) => set(e.target.value)}
              onBlur={apply}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded px-2 py-2"
            />
          </div>
        ))}
      </div>

      <PanelHeader label="Presets" small />

      <div className="flex flex-col gap-1">
        {PRESET_SIZES.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setActive(p.label);
              setWVal(px2unit(p.w, unit));
              setHVal(px2unit(p.h, unit));
              setCanvasW(p.w);
              setCanvasH(p.h);
            }}
            className={`px-3 py-2 rounded text-left text-xs transition-colors border-l-2 ${
              active === p.label
                ? "bg-gray-800 border-white"
                : "bg-gray-900 border-transparent hover:bg-gray-800 text-gray-400"
            }`}
          >
            <span className="font-semibold text-white">{p.label}</span>
            <span className="ml-2 text-gray-500">{p.w}×{p.h}px</span>
          </button>
        ))}
      </div>
    </div>
  );
}
