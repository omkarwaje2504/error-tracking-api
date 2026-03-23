"use client";
// ─────────────────────────────────────────────
//  components/left-panel/tools/EffectsTool.jsx
//  Blur · Curved Text · Text Stroke · Background
//  Shadow · Global Opacity · Letter Spacing · Line Height
// ─────────────────────────────────────────────
import { useState } from "react";
import { Toggle } from "../../ui-atoms";

// ── primitive atoms ──────────────────────────

function FxSlider({ label, min, max, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-28 flex-shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-white h-1"
      />
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-14 bg-gray-900 border border-gray-700 text-white text-xs rounded px-2 py-1 text-center"
      />
    </div>
  );
}

function FxColorRow({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-28 flex-shrink-0">{label}</span>
      <input
        type="color" value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded border border-gray-700 cursor-pointer bg-transparent"
      />
      <span className="text-xs text-gray-500 font-mono">{value}</span>
    </div>
  );
}

function FxSection({ label, enabled, onToggle, children, alwaysOpen = false }) {
  const [open, setOpen] = useState(true);
  const isOn = alwaysOpen ? true : (enabled ?? false);

  return (
    <div className="border border-gray-800 rounded-lg mb-2 overflow-hidden">
      {/* Section header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 bg-gray-900 cursor-pointer select-none"
        onClick={() => !alwaysOpen && setOpen((o) => !o)}
      >
        <span className="text-sm font-semibold text-white">{label}</span>
        <div className="flex items-center gap-2">
          {!alwaysOpen && (
            <Toggle enabled={!!enabled} onToggle={onToggle} />
          )}
          <span className="text-gray-600 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Section body — only shown when open AND (alwaysOpen OR toggled on) */}
      {open && isOn && (
        <div className="px-3 py-3 flex flex-col gap-3 bg-black">
          {children}
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────

export default function EffectsTool({ el, onUpdate, onClose }) {
  if (!el) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-600 text-sm px-6 text-center gap-2">
        <span className="text-3xl">✦</span>
        <p>Select an element on the canvas to edit its effects.</p>
      </div>
    );
  }

  const fx    = el.effects ?? {};
  const upFx  = (section, patch) =>
    onUpdate({ effects: { ...fx, [section]: { ...(fx[section] ?? {}), ...patch } } });

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Sticky header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 sticky top-0 bg-black z-10">
        <span className="text-base font-bold text-white tracking-wide">Effects</span>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-xl leading-none cursor-pointer"
        >✕</button>
      </div>

      <div className="flex flex-col gap-0 px-3 pb-8 pt-3">

        {/* ── Blur ── */}
        <FxSection
          label="Blur"
          enabled={fx.blur?.enabled}
          onToggle={(v) => upFx("blur", { enabled: v })}
        >
          <FxSlider
            label="Amount" min={0} max={40}
            value={fx.blur?.amount ?? 0}
            onChange={(v) => upFx("blur", { amount: v })}
          />
        </FxSection>

        {/* ── Curved Text (text only) ── */}
        {el.type === "text" && (
          <FxSection
            label="Curved Text"
            enabled={fx.curved?.enabled}
            onToggle={(v) => upFx("curved", { enabled: v })}
          >
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>-100</span>
                <span className="text-white font-medium">Power: {fx.curved?.power ?? 50}</span>
                <span>100</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={-100} max={100}
                  value={fx.curved?.power ?? 50}
                  onChange={(e) => upFx("curved", { power: Number(e.target.value) })}
                  className="flex-1 accent-white"
                />
                <input
                  type="number" min={-100} max={100}
                  value={fx.curved?.power ?? 50}
                  onChange={(e) => upFx("curved", { power: Number(e.target.value) })}
                  className="w-14 bg-gray-900 border border-gray-700 text-white text-xs rounded px-2 py-1 text-center"
                />
              </div>
            </div>
          </FxSection>
        )}

        {/* ── Text Stroke (text only) ── */}
        {el.type === "text" && (
          <FxSection
            label="Text Stroke"
            enabled={fx.stroke?.enabled}
            onToggle={(v) => upFx("stroke", { enabled: v })}
          >
            <FxColorRow
              label="Color"
              value={fx.stroke?.color ?? "#000000"}
              onChange={(v) => upFx("stroke", { color: v })}
            />
            <FxSlider
              label="Width" min={0} max={20}
              value={fx.stroke?.width ?? 2}
              onChange={(v) => upFx("stroke", { width: v })}
            />
          </FxSection>
        )}

        {/* ── Background highlight (text only) ── */}
        {el.type === "text" && (
          <FxSection
            label="Background"
            enabled={fx.bg?.enabled}
            onToggle={(v) => upFx("bg", { enabled: v })}
          >
            <FxSlider
              label="Corner radius" min={0} max={100}
              value={fx.bg?.cornerRadius ?? 0}
              onChange={(v) => upFx("bg", { cornerRadius: v })}
            />
            <FxSlider
              label="Padding" min={0} max={100}
              value={fx.bg?.padding ?? 8}
              onChange={(v) => upFx("bg", { padding: v })}
            />
            <FxSlider
              label="Opacity" min={0} max={100}
              value={fx.bg?.opacity ?? 100}
              onChange={(v) => upFx("bg", { opacity: v })}
            />
            <FxColorRow
              label="Color"
              value={fx.bg?.color ?? "#3b82f6"}
              onChange={(v) => upFx("bg", { color: v })}
            />
          </FxSection>
        )}

        {/* ── Shadow ── */}
        <FxSection
          label="Shadow"
          enabled={fx.shadow?.enabled}
          onToggle={(v) => upFx("shadow", { enabled: v })}
        >
          <FxSlider
            label="Blur" min={0} max={60}
            value={fx.shadow?.blur ?? 16}
            onChange={(v) => upFx("shadow", { blur: v })}
          />
          <FxSlider
            label="Offset X" min={-60} max={60}
            value={fx.shadow?.offsetX ?? 0}
            onChange={(v) => upFx("shadow", { offsetX: v })}
          />
          <FxSlider
            label="Offset Y" min={-60} max={60}
            value={fx.shadow?.offsetY ?? 0}
            onChange={(v) => upFx("shadow", { offsetY: v })}
          />
          <FxSlider
            label="Opacity" min={0} max={100}
            value={fx.shadow?.opacity ?? 50}
            onChange={(v) => upFx("shadow", { opacity: v })}
          />
          <FxColorRow
            label="Color"
            value={fx.shadow?.color ?? "#000000"}
            onChange={(v) => upFx("shadow", { color: v })}
          />
        </FxSection>

        {/* ── Global Opacity ── */}
        <FxSection label="Opacity" alwaysOpen>
          <FxSlider
            label="Opacity" min={0} max={100}
            value={el.opacity ?? 100}
            onChange={(v) => onUpdate({ opacity: v })}
          />
        </FxSection>

        {/* ── Typography (text only) ── */}
        {el.type === "text" && (
          <FxSection label="Typography" alwaysOpen>
            <FxSlider
              label="Letter Spacing" min={-20} max={200}
              value={el.letterSpacing ?? 0}
              onChange={(v) => onUpdate({ letterSpacing: v })}
            />
            <FxSlider
              label="Line Height" min={50} max={300}
              value={el.lineHeight ?? 120}
              onChange={(v) => onUpdate({ lineHeight: v })}
            />
          </FxSection>
        )}

      </div>
    </div>
  );
}
