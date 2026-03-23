"use client";
// ─────────────────────────────────────────────
//  components/ui-atoms.jsx
//  Tiny reusable building blocks shared by every panel/toolbar.
// ─────────────────────────────────────────────

/** Toolbar icon button */
export function TB({ children, onClick, active, title, style = {}, className = "" }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={style}
      className={[
        "flex items-center justify-center min-w-[36px] h-9 rounded border",
        "text-base font-medium transition-colors cursor-pointer select-none",
        active
          ? "bg-white text-black border-white"
          : "bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-800",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** Thin vertical divider for toolbars */
export function Divider() {
  return <div className="w-px h-6 bg-gray-800 flex-shrink-0" />;
}

/** Small icon button for layer rows */
export function LBtn({ children, onClick, color = "text-gray-600" }) {
  return (
    <button
      onClick={onClick}
      className={`p-0.5 text-sm hover:opacity-100 opacity-70 cursor-pointer ${color}`}
    >
      {children}
    </button>
  );
}

/** Section header inside a side panel */
export function PanelHeader({ label, small }) {
  return (
    <div
      className={[
        "font-bold tracking-widest uppercase",
        small
          ? "text-xs text-gray-600 mb-1"
          : "text-xs text-gray-500 pb-2 border-b border-gray-800 mb-1",
      ].join(" ")}
    >
      {label}
    </div>
  );
}

/** Grid of colour swatches */
export function ColorGrid({ colors, selected, onSelect, cols = 8 }) {
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {colors.map((c) => (
        <div
          key={c}
          onClick={() => onSelect(c)}
          className="rounded cursor-pointer border transition-all hover:scale-110"
          style={{
            paddingBottom: "100%",
            background: c,
            borderColor: selected === c ? "#fff" : "#374151",
          }}
        />
      ))}
    </div>
  );
}

/** Toggle switch */
export function Toggle({ enabled, onToggle }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle?.(!enabled); }}
      className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${
        enabled ? "bg-white" : "bg-gray-600"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-black transition-all ${
          enabled ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}
