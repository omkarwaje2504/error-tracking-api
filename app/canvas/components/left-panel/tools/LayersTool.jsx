"use client";
// ─────────────────────────────────────────────
//  components/left-panel/tools/LayersTool.jsx
// ─────────────────────────────────────────────
import { PanelHeader, LBtn } from "../../ui-atoms";

export default function LayersTool({
  elements,
  selectedIds,
  setSelectedIds,
  updateElement,
  deleteElements,
  moveUp,
  moveDown,
}) {
  const toggleVisible = (id) => {
    const el = elements.find((e) => e.id === id);
    updateElement(id, { visible: el?.visible === false ? true : false });
  };

  const toggleLock = (id) => {
    const el = elements.find((e) => e.id === id);
    updateElement(id, { locked: !el?.locked });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4">
        <PanelHeader label={`Layers (${elements.length})`} />
      </div>

      {elements.length === 0 && (
        <div className="px-4 text-gray-600 text-sm text-center">
          No elements yet
        </div>
      )}

      {/* Reversed so top layer shows first */}
      {[...elements].reverse().map((el) => {
        const realIdx = elements.findIndex((e) => e.id === el.id);
        const isSel   = selectedIds.includes(el.id);

        return (
          <div
            key={el.id}
            onClick={(e) =>
              e.shiftKey
                ? setSelectedIds((prev) =>
                    prev.includes(el.id) ? prev.filter((id) => id !== el.id) : [...prev, el.id]
                  )
                : setSelectedIds([el.id])
            }
            className={[
              "flex items-center gap-2 px-3 py-2 cursor-pointer border-l-2 transition-colors text-sm",
              isSel
                ? "bg-gray-800 border-white"
                : "border-transparent hover:bg-gray-900",
            ].join(" ")}
            style={{ opacity: el.visible === false ? 0.35 : 1 }}
          >
            {/* Type icon */}
            <span className="text-base text-gray-500 w-5 text-center flex-shrink-0">
              {el.type === "text"  ? "T"
               : el.type === "image" ? "🖼"
               : "⬡"}
            </span>

            {/* Label */}
            <span className="flex-1 text-gray-200 text-xs overflow-hidden text-ellipsis whitespace-nowrap">
              {el.type === "text" ? (el.text?.slice(0, 20) || "Text") : el.type}
              {el.groupId && <span className="ml-1 text-gray-600">[G]</span>}
            </span>

            {/* Action buttons */}
            <LBtn onClick={(e) => { e.stopPropagation(); moveUp(elements[realIdx]?.id); }}>↑</LBtn>
            <LBtn onClick={(e) => { e.stopPropagation(); moveDown(elements[realIdx]?.id); }}>↓</LBtn>
            <LBtn
              color={el.visible === false ? "text-yellow-400" : "text-gray-600"}
              onClick={(e) => { e.stopPropagation(); toggleVisible(el.id); }}
            >
              {el.visible === false ? "🙈" : "👁"}
            </LBtn>
            <LBtn
              color={el.locked ? "text-yellow-400" : "text-gray-600"}
              onClick={(e) => { e.stopPropagation(); toggleLock(el.id); }}
            >
              {el.locked ? "🔒" : "🔓"}
            </LBtn>
            <LBtn
              color="text-red-500"
              onClick={(e) => { e.stopPropagation(); deleteElements([el.id]); }}
            >✕</LBtn>
          </div>
        );
      })}
    </div>
  );
}
