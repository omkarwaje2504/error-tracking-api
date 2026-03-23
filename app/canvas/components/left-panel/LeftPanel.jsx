"use client";
// ─────────────────────────────────────────────
//  components/left-panel/LeftPanel.jsx
//  Icon rail + sliding content panel.
//  Imports one tool component per panel slot.
// ─────────────────────────────────────────────
import { LEFT_TOOLS } from "../../../../lib/constants";
import TextTool    from "./tools/TextTool";
import ShapesTool  from "./tools/ShapesTool";
import PhotosTool  from "./tools/PhotosTool";
import LayersTool  from "./tools/LayersTool";
import SizeTool    from "./tools/SizeTool";
import EffectsTool from "./tools/EffectsTool";

export default function LeftPanel({
  activeTool,
  setActiveTool,
  showEffects,
  setShowEffects,
  // text tool
  addText,
  bgColor,
  setBgColor,
  // shapes
  addShape,
  shapeFill,
  setShapeFill,
  // photos
  addImage,
  // layers
  elements,
  selectedIds,
  setSelectedIds,
  updateElement,
  deleteElements,
  moveUp,
  moveDown,
  // size
  canvasW,
  canvasH,
  unit,
  setUnit,
  setCanvasW,
  setCanvasH,
  // effects
  selectedEl,
  onUpdateSelected,
}) {
  const renderContent = () => {
    if (showEffects) {
      return (
        <EffectsTool
          el={selectedEl}
          onUpdate={onUpdateSelected}
          onClose={() => setShowEffects(false)}
        />
      );
    }
    switch (activeTool) {
      case "text":
        return <TextTool addText={addText} bgColor={bgColor} setBgColor={setBgColor} />;
      case "shapes":
        return <ShapesTool addShape={addShape} fill={shapeFill} setFill={setShapeFill} />;
      case "photos":
        return <PhotosTool addImage={addImage} />;
      case "layers":
        return (
          <LayersTool
            elements={elements}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            updateElement={updateElement}
            deleteElements={deleteElements}
            moveUp={moveUp}
            moveDown={moveDown}
          />
        );
      case "size":
        return (
          <SizeTool
            canvasW={canvasW} canvasH={canvasH}
            unit={unit} setUnit={setUnit}
            setCanvasW={setCanvasW} setCanvasH={setCanvasH}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-shrink-0">
      {/* ── Icon rail ── */}
      <div className="w-16 md:w-20 bg-black border-r border-gray-800 flex flex-col items-center pt-3 gap-1">
        {/* Logo */}
        <div className="text-white font-black text-lg mb-3 tracking-tighter select-none">DS</div>

        {LEFT_TOOLS.map((t) => {
          const isActive = activeTool === t.id && !showEffects;
          return (
            <button
              key={t.id}
              title={t.label}
              onClick={() => { setActiveTool(t.id); setShowEffects(false); }}
              className={[
                "w-12 md:w-14 min-h-[52px] md:min-h-[56px] rounded-xl",
                "flex flex-col items-center justify-center gap-1",
                "transition-all cursor-pointer border-l-2 select-none",
                isActive
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-gray-500 border-transparent hover:bg-gray-900 hover:text-white",
              ].join(" ")}
            >
              <span className={t.id === "text" ? "text-2xl" : "text-xl"}>{t.icon}</span>
              <span className="text-xs font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Content panel ── */}
      <div className="w-56 md:w-64 bg-black border-r border-gray-800 overflow-y-auto hidden sm:block">
        {renderContent()}
      </div>
    </div>
  );
}
