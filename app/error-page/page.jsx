"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const API = "https://my-server-jade-beta.vercel.app/api/error";

// ─── Icons ─────────────────────────────────────────────────────────────────────
const Ic = ({ d, size = 14, children, ...p }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    {children}
  </svg>
);
const RefreshIcon = () => (
  <Ic>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </Ic>
);
const TrashIcon = ({ size = 14 }) => (
  <Ic size={size}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4h6v2" />
  </Ic>
);
const SearchIcon = () => (
  <Ic>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Ic>
);
const XIcon = ({ size = 12 }) => (
  <Ic size={size}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Ic>
);
const AlertTriIcon = ({ size = 13 }) => (
  <Ic size={size}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Ic>
);
const CheckIcon = ({ size = 11 }) => (
  <Ic size={size}>
    <polyline points="20 6 9 17 4 12" />
  </Ic>
);
const CopyIcon = () => (
  <Ic size={13}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Ic>
);
const SunIcon = () => (
  <Ic size={15}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </Ic>
);
const MoonIcon = () => (
  <Ic size={15}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Ic>
);
const ChevronIcon = ({ open }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: open ? "rotate(90deg)" : "rotate(0deg)",
      transition: "transform 0.2s ease",
    }}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const LayersIcon = () => (
  <Ic size={13}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </Ic>
);
const GlobeIcon = () => (
  <Ic size={12}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </Ic>
);
const MonitorIcon = () => (
  <Ic size={12}>
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </Ic>
);
const KeyboardIcon = () => (
  <Ic size={13}>
    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
  </Ic>
);
const ClockIcon = () => (
  <Ic size={12}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Ic>
);

// ─── Helpers ───────────────────────────────────────────────────────────────────
const timeAgo = (ts) => {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
};
const fmtDateGroup = (ts) => {
  const d = new Date(ts);
  const t = new Date(),
    y = new Date(t);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};
const fmtDay = (ts) =>
  new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const isToday = (ts) =>
  new Date(ts).toDateString() === new Date().toDateString();

const errorStyle = (name = "") => {
  if (name.includes("TypeError"))
    return {
      badge: "bg-orange-500/15 text-orange-400 border-orange-500/25",
      dot: "bg-orange-400",
      bar: "#f97316",
    };
  if (name.includes("ReferenceError"))
    return {
      badge: "bg-red-500/15 text-red-400 border-red-500/25",
      dot: "bg-red-400",
      bar: "#ef4444",
    };
  if (name.includes("SyntaxError"))
    return {
      badge: "bg-purple-500/15 text-purple-400 border-purple-500/25",
      dot: "bg-purple-400",
      bar: "#a855f7",
    };
  if (name.includes("NetworkError") || name.includes("FetchError"))
    return {
      badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
      dot: "bg-yellow-400",
      bar: "#eab308",
    };
  return {
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    dot: "bg-blue-400",
    bar: "#3b82f6",
  };
};

// Deduplicate: group by error name + message fingerprint
const dedupeErrors = (errors) => {
  const map = new Map();
  errors.forEach((e) => {
    const key = `${e.error?.name}||${e.error?.message}`;
    if (!map.has(key)) {
      map.set(key, { ...e, _count: 1, _ids: [e._id], _latest: e.timestamp });
    } else {
      const ex = map.get(key);
      ex._count++;
      ex._ids.push(e._id);
      if (new Date(e.timestamp) > new Date(ex._latest)) {
        ex._latest = e.timestamp;
        ex.timestamp = e.timestamp;
      }
    }
  });
  return [...map.values()].sort(
    (a, b) => new Date(b._latest) - new Date(a._latest),
  );
};

// ─── Frequency Sparkline Chart ──────────────────────────────────────────────────
function FrequencyChart({ errors, dark }) {
  const days = 14;
  const data = useMemo(() => {
    const buckets = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      buckets[d.toDateString()] = { label: fmtDay(d), count: 0, date: d };
    }
    errors.forEach((e) => {
      const d = new Date(e.timestamp);
      d.setHours(0, 0, 0, 0);
      if (buckets[d.toDateString()]) buckets[d.toDateString()].count++;
    });
    return Object.values(buckets);
  }, [errors]);

  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 280,
    H = 48,
    barW = Math.floor(W / days) - 2;

  return (
    <div className="flex flex-col gap-1">
      <span
        className={`text-xs font-medium ${dark ? "text-white/40" : "text-black/40"}`}
      >
        Last 14 days
      </span>
      <svg width={W} height={H} className="overflow-visible">
        {data.map((d, i) => {
          const barH = Math.max(3, (d.count / max) * (H - 8));
          const x = i * (barW + 2);
          const isNow = isToday(d.date);
          return (
            <g key={i}>
              <div>
                {d.label}: {d.count} error{d.count !== 1 ? "s" : ""}
              </div>
              <rect
                x={x}
                y={H - barH}
                width={barW}
                height={barH}
                rx="2"
                fill={
                  isNow
                    ? "#3b82f6"
                    : dark
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(0,0,0,0.12)"
                }
                className="transition-all duration-300 hover:opacity-80"
              />
              {d.count > 0 && (
                <text
                  x={x + barW / 2}
                  y={H - barH - 3}
                  textAnchor="middle"
                  fontSize="8"
                  fill={dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
                >
                  {d.count}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between" style={{ width: W }}>
        <span
          className={`text-[10px] ${dark ? "text-white/25" : "text-black/25"}`}
        >
          {data[0]?.label}
        </span>
        <span
          className={`text-[10px] ${dark ? "text-white/25" : "text-black/25"}`}
        >
          {data[data.length - 1]?.label}
        </span>
      </div>
    </div>
  );
}

// ─── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar({ errors, dark }) {
  const todayCount = errors.filter((e) => isToday(e.timestamp)).length;
  const byType = useMemo(() => {
    const m = {};
    errors.forEach((e) => {
      const n = e.error?.name || "Error";
      m[n] = (m[n] || 0) + 1;
    });
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [errors]);

  const card = `rounded-lg border px-3 py-2 flex flex-col gap-0.5 ${
    dark ? "border-white/8 bg-white/3" : "border-black/8 bg-black/3"
  }`;
  const label = `text-[10px] font-medium uppercase tracking-wider ${dark ? "text-white/35" : "text-black/35"}`;
  const value = `text-xl font-bold tabular-nums ${dark ? "text-white" : "text-black"}`;

  return (
    <div
      className={`border-b px-5 py-3 shrink-0 ${dark ? "border-white/8 bg-[#0a0a0a]" : "border-black/8 bg-white"}`}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className={card}>
          <span className={label}>Total</span>
          <span className={value}>{errors.length}</span>
        </div>
        <div className={card}>
          <span className={label}>Today</span>
          <span className={`${value} text-blue-400`}>{todayCount}</span>
        </div>
        {byType.map(([name, count]) => {
          const s = errorStyle(name);
          return (
            <div key={name} className={card}>
              <span className={label}>{name.replace("Error", "")}</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className={value} style={{ fontSize: 18 }}>
                  {count}
                </span>
              </div>
            </div>
          );
        })}
        <div className="ml-auto self-center">
          <FrequencyChart errors={errors} dark={dark} />
        </div>
      </div>
    </div>
  );
}

// ─── Keyboard Shortcut Badge ───────────────────────────────────────────────────
const Kbd = ({ dark, children }) => (
  <span
    className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono border
    ${dark ? "border-white/15 bg-white/8 text-white/50" : "border-black/15 bg-black/5 text-black/50"}`}
  >
    {children}
  </span>
);

function ShortcutsHint({ dark, visible }) {
  if (!visible) return null;
  const row = `flex items-center justify-between gap-4 py-1.5 border-b ${dark ? "border-white/5" : "border-black/5"}`;
  const desc = `text-xs ${dark ? "text-white/50" : "text-black/50"}`;
  return (
    <div
      className={`absolute bottom-12 right-4 z-40 w-64 rounded-xl border shadow-2xl p-4 text-xs
      ${dark ? "bg-[#111] border-white/12" : "bg-white border-black/12 shadow-black/10"}`}
    >
      <p
        className={`text-xs font-semibold mb-3 ${dark ? "text-white/60" : "text-black/60"}`}
      >
        Keyboard Shortcuts
      </p>
      {[
        ["j / ↓", "Next error"],
        ["k / ↑", "Previous error"],
        ["d", "Delete selected"],
        ["Esc", "Close panel / clear"],
        ["/", "Focus search"],
        ["a", "Select / deselect all"],
      ].map(([k, v]) => (
        <div key={k} className={row}>
          <span className={desc}>{v}</span>
          <Kbd dark={dark}>{k}</Kbd>
        </div>
      ))}
    </div>
  );
}

// ─── Stack Viewer ──────────────────────────────────────────────────────────────
function StackViewer({ mappedStack, rawStack, dark }) {
  const [tab, setTab] = useState(mappedStack?.length ? "mapped" : "raw");
  const [copied, setCopied] = useState(false);

  const copyStack = () => {
    const txt =
      tab === "raw"
        ? rawStack || ""
        : (mappedStack || [])
            .filter((f) => !f.separator)
            .map(
              (f) =>
                `${f.source}:${f.line}:${f.column} — ${f.function || "?"}\n${f.snippet}`,
            )
            .join("\n\n");
    navigator.clipboard.writeText(txt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tabCls = (t) =>
    `px-3 py-1 text-xs rounded-md font-medium transition-colors ${
      tab === t
        ? dark
          ? "bg-white/10 text-white"
          : "bg-black/8 text-black"
        : dark
          ? "text-white/40 hover:text-white/70"
          : "text-black/40 hover:text-black/70"
    }`;

  const renderMapped = () => (
    <div className="space-y-2">
      {(mappedStack || []).map((frame, i) => {
        if (frame.separator)
          return (
            <div
              key={i}
              className={`border-t my-2 ${dark ? "border-white/5" : "border-black/8"}`}
            />
          );
        const lines = (frame.snippet || "").split("\n");
        return (
          <div
            key={i}
            className={`rounded-lg border overflow-hidden ${dark ? "border-white/8" : "border-black/10"}`}
          >
            <div
              className={`flex items-center gap-2 px-3 py-2 border-b flex-wrap ${dark ? "bg-white/3 border-white/8" : "bg-black/3 border-black/8"}`}
            >
              <LayersIcon />
              <span
                className={`text-xs font-mono truncate max-w-[260px] ${dark ? "text-white/50" : "text-black/50"}`}
              >
                {frame.source}
              </span>
              <span
                className={`text-xs ml-auto ${dark ? "text-white/30" : "text-black/30"}`}
              >
                :{frame.line}:{frame.column}
              </span>
              {frame.function && (
                <span className="text-xs text-blue-400 font-mono">
                  {frame.function}()
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <pre className="text-xs font-mono leading-5 p-0 m-0">
                {lines.map((line, li) => {
                  const isErr = line.trimStart().startsWith(">>");
                  const lineNum = line.match(/^\s*(?:>>)?\s*(\d+)/)?.[1] || "";
                  const code = line.replace(/^\s*(?:>>)?\s*\d+\s*\|\s?/, "");
                  return (
                    <div
                      key={li}
                      className={`flex px-3 py-0.5 ${
                        isErr
                          ? "bg-red-500/15 border-l-2 border-red-400"
                          : dark
                            ? "hover:bg-white/2"
                            : "hover:bg-black/2"
                      }`}
                    >
                      <span
                        className={`mr-4 select-none min-w-[2.5rem] text-right text-xs ${isErr ? "text-red-400" : dark ? "text-white/20" : "text-black/20"}`}
                      >
                        {lineNum}
                      </span>
                      <span
                        className={
                          isErr
                            ? "text-red-200"
                            : dark
                              ? "text-white/60"
                              : "text-black/60"
                        }
                      >
                        {code}
                      </span>
                    </div>
                  );
                })}
              </pre>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderRaw = () => (
    <pre
      className={`text-xs font-mono leading-5 overflow-x-auto p-3 rounded-lg border ${dark ? "border-white/8 bg-white/2 text-white/50" : "border-black/8 bg-black/2 text-black/50"}`}
    >
      {(rawStack || "No stack trace").split("\n").map((line, i) => (
        <div
          key={i}
          className={`py-0.5 ${i === 0 ? "text-red-400 font-semibold" : ""}`}
        >
          {line}
        </div>
      ))}
    </pre>
  );

  return (
    <div>
      <div className="flex items-center gap-1 mb-3">
        {mappedStack?.length > 0 && (
          <button onClick={() => setTab("mapped")} className={tabCls("mapped")}>
            Source Mapped (
            {(mappedStack || []).filter((f) => !f.separator).length})
          </button>
        )}
        <button onClick={() => setTab("raw")} className={tabCls("raw")}>
          Raw Stack
        </button>
        <button
          onClick={copyStack}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1 text-xs rounded-md border transition-colors
            ${
              copied
                ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                : dark
                  ? "text-white/40 border-white/10 hover:text-white/70 hover:bg-white/5"
                  : "text-black/40 border-black/10 hover:text-black/70 hover:bg-black/5"
            }`}
        >
          {copied ? (
            <>
              <CheckIcon size={11} /> Copied
            </>
          ) : (
            <>
              <CopyIcon /> Copy
            </>
          )}
        </button>
      </div>
      {tab === "mapped" ? renderMapped() : renderRaw()}
    </div>
  );
}

// ─── Detail Panel ──────────────────────────────────────────────────────────────
function ErrorDetail({ error, onClose, onDelete, dark }) {
  const s = errorStyle(error.error?.name);
  const [tab, setTab] = useState("stack");
  const sections = ["stack", "device", "location"];
  const tabCls = (t) =>
    `px-3 py-1 text-xs rounded-md font-medium capitalize transition-colors ${
      tab === t
        ? dark
          ? "bg-white/10 text-white"
          : "bg-black/8 text-black"
        : dark
          ? "text-white/40 hover:text-white/70"
          : "text-black/40 hover:text-black/70"
    }`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={`flex items-start justify-between p-4 border-b shrink-0 ${dark ? "border-white/8" : "border-black/8"}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border ${s.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {error.error?.name || "Error"}
            </span>
            {error._count > 1 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold
                ${dark ? "bg-white/8 text-white/60" : "bg-black/6 text-black/60"}`}
              >
                ×{error._count}
              </span>
            )}
            <span
              className={`text-xs ${dark ? "text-white/30" : "text-black/30"}`}
            >
              {timeAgo(error.timestamp)}
            </span>
          </div>
          <p
            className={`text-sm font-medium leading-snug ${dark ? "text-white/85" : "text-black/85"}`}
          >
            {error.error?.message}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-3 shrink-0">
          <button
            onClick={() => onDelete(error._ids || [error._id])}
            className="p-1.5 rounded-md text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <TrashIcon />
          </button>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-md transition-colors ${dark ? "text-white/30 hover:text-white hover:bg-white/8" : "text-black/30 hover:text-black hover:bg-black/6"}`}
          >
            <XIcon />
          </button>
        </div>
      </div>

      {/* Meta strip */}
      <div
        className={`flex items-center gap-4 px-4 py-2 border-b shrink-0 overflow-x-auto ${dark ? "border-white/8 bg-white/2" : "border-black/8 bg-black/2"}`}
      >
        {error.projectId && (
          <div
            className={`flex items-center gap-1.5 text-xs whitespace-nowrap ${dark ? "text-white/40" : "text-black/40"}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className={dark ? "text-white/60" : "text-black/60"}>
              {error.projectId}
            </span>
          </div>
        )}
        {error.city && (
          <div
            className={`flex items-center gap-1 text-xs whitespace-nowrap ${dark ? "text-white/40" : "text-black/40"}`}
          >
            <GlobeIcon />
            {[error.city, error.country].filter(Boolean).join(", ")}
          </div>
        )}
        {error.deviceInfo?.browser && (
          <div
            className={`flex items-center gap-1 text-xs whitespace-nowrap ${dark ? "text-white/40" : "text-black/40"}`}
          >
            <MonitorIcon />
            {error.deviceInfo.browser}
          </div>
        )}
        {error.locationInfo?.url && (
          <div
            className={`flex items-center gap-1 text-xs whitespace-nowrap ${dark ? "text-white/40" : "text-black/40"}`}
          >
            <GlobeIcon />
            <span className="truncate max-w-[180px]">
              {error.locationInfo.url}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 shrink-0">
        {sections.map((s) => (
          <button key={s} onClick={() => setTab(s)} className={tabCls(s)}>
            {s}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {tab === "stack" && (
          <StackViewer
            mappedStack={error.mappedStack}
            rawStack={error.error?.stack}
            dark={dark}
          />
        )}
        {tab === "device" && (
          <div className="space-y-0.5">
            {error.deviceInfo ? (
              Object.entries(error.deviceInfo)
                .filter(([k]) => k !== "employeeDetails")
                .map(([k, v]) => (
                  <div
                    key={k}
                    className={`flex items-start gap-3 py-2 border-b ${dark ? "border-white/5" : "border-black/5"}`}
                  >
                    <span
                      className={`text-xs w-28 shrink-0 capitalize ${dark ? "text-white/30" : "text-black/35"}`}
                    >
                      {k.replace(/([A-Z])/g, " $1")}
                    </span>
                    <span
                      className={`text-xs font-mono break-all ${dark ? "text-white/70" : "text-black/70"}`}
                    >
                      {String(v)}
                    </span>
                  </div>
                ))
            ) : (
              <p
                className={`text-xs ${dark ? "text-white/30" : "text-black/30"}`}
              >
                No device info
              </p>
            )}
            {error.deviceInfo?.employeeDetails && (
              <div
                className={`mt-3 p-3 rounded-lg border ${dark ? "bg-white/3 border-white/8" : "bg-black/3 border-black/8"}`}
              >
                <p
                  className={`text-xs mb-2 ${dark ? "text-white/40" : "text-black/40"}`}
                >
                  Employee Details
                </p>
                <pre
                  className={`text-xs font-mono overflow-x-auto ${dark ? "text-white/60" : "text-black/60"}`}
                >
                  {JSON.stringify(error.deviceInfo.employeeDetails, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
        {tab === "location" && (
          <div className="space-y-0.5">
            {[
              ["URL", error.locationInfo?.url],
              ["Referrer", error.locationInfo?.referrer],
              ["City", error.city],
              ["State", error.state],
              ["Country", error.country],
              ["Latitude", error.geo?.lat],
              ["Longitude", error.geo?.lon],
              [
                "Accuracy",
                error.geo?.accuracy
                  ? `${Math.round(error.geo.accuracy)}m`
                  : null,
              ],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div
                  key={k}
                  className={`flex items-start gap-3 py-2 border-b ${dark ? "border-white/5" : "border-black/5"}`}
                >
                  <span
                    className={`text-xs w-24 shrink-0 ${dark ? "text-white/30" : "text-black/35"}`}
                  >
                    {k}
                  </span>
                  <span
                    className={`text-xs font-mono break-all ${dark ? "text-white/70" : "text-black/70"}`}
                  >
                    {String(v)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Error Row ─────────────────────────────────────────────────────────────────
function ErrorRow({ error, selected, checked, onSelect, onCheck, dark }) {
  const s = errorStyle(error.error?.name);
  return (
    <div
      onClick={() => onSelect(error)}
      className={`group flex items-start gap-3 px-4 py-3 border-b cursor-pointer transition-colors
        ${dark ? "border-white/5" : "border-black/6"}
        ${selected ? (dark ? "bg-white/6" : "bg-black/5") : dark ? "hover:bg-white/3" : "hover:bg-black/3"}`}
    >
      <div
        className="flex items-center pt-0.5 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onCheck(error._id);
        }}
      >
        <div
          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
          ${
            checked
              ? dark
                ? "bg-white border-white"
                : "bg-black border-black"
              : dark
                ? "border-white/20 hover:border-white/40"
                : "border-black/20 hover:border-black/40"
          }`}
        >
          {checked && (
            <span className={dark ? "text-black" : "text-white"}>
              <CheckIcon />
            </span>
          )}
        </div>
      </div>
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${s.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={`text-xs font-semibold ${s.badge.split(" ")[1]}`}>
            {error.error?.name || "Error"}
          </span>
          {error._count > 1 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-mono font-bold
              ${dark ? "bg-white/8 text-white/50" : "bg-black/6 text-black/50"}`}
            >
              ×{error._count}
            </span>
          )}
          {error.projectId && (
            <span
              className={`text-xs font-mono ${dark ? "text-white/20" : "text-black/25"}`}
            >
              {error.projectId}
            </span>
          )}
          <span
            className={`ml-auto text-xs shrink-0 flex items-center gap-1 ${dark ? "text-white/25" : "text-black/30"}`}
          >
            <ClockIcon />
            {timeAgo(error.timestamp)}
          </span>
        </div>
        <p
          className={`text-xs truncate leading-relaxed ${dark ? "text-white/55" : "text-black/55"}`}
        >
          {error.error?.message}
        </p>
        {error.locationInfo?.url && (
          <p
            className={`text-xs truncate mt-0.5 ${dark ? "text-white/20" : "text-black/25"}`}
          >
            {error.locationInfo.url}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────────
const Page=()=> {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState("date");
  const [dedupe, setDedupe] = useState(true);
  const [filterProject, setFilterProject] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshSecs, setRefreshSecs] = useState(30);
  const [countdown, setCountdown] = useState(30);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [collapsed, setCollapsed] = useState(new Set());
  const [delConfirm, setDelConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [dark, setDark] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const timerRef = useRef(null);
  const countRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const selectedIdx = useRef(-1);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchErrors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(API);
      const json = await res.json();
      if (json.success) {
        setErrors(json.data || []);
        setLastRefresh(new Date());
      }
    } catch {
      showToast("Failed to fetch errors", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  // Auto-refresh
  useEffect(() => {
    clearInterval(timerRef.current);
    clearInterval(countRef.current);
    if (!autoRefresh) return;
    setCountdown(refreshSecs);
    timerRef.current = setInterval(() => {
      fetchErrors();
      setCountdown(refreshSecs);
    }, refreshSecs * 1000);
    countRef.current = setInterval(
      () => setCountdown((c) => (c > 1 ? c - 1 : refreshSecs)),
      1000,
    );
    return () => {
      clearInterval(timerRef.current);
      clearInterval(countRef.current);
    };
  }, [autoRefresh, refreshSecs, fetchErrors]);

  // Derived lists
  const projects = useMemo(
    () => [...new Set(errors.map((e) => e.projectId).filter(Boolean))],
    [errors],
  );
  const types = useMemo(
    () => [...new Set(errors.map((e) => e.error?.name).filter(Boolean))],
    [errors],
  );

  const filtered = useMemo(() => {
    let list = errors.filter((e) => {
      if (filterProject !== "all" && e.projectId !== filterProject)
        return false;
      if (filterType !== "all" && e.error?.name !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (e.error?.message || "").toLowerCase().includes(q) ||
          (e.error?.name || "").toLowerCase().includes(q) ||
          (e.projectId || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
    return dedupe ? dedupeErrors(list) : list;
  }, [errors, filterProject, filterType, search, dedupe]);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach((e) => {
      const key =
        groupBy === "date"
          ? fmtDateGroup(e.timestamp)
          : groupBy === "project"
            ? e.projectId || "Unknown"
            : e.error?.name || "Unknown";
      (g[key] = g[key] || []).push(e);
    });
    return g;
  }, [filtered, groupBy]);

  const flatList = useMemo(() => filtered, [filtered]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
        if (e.key === "Escape") {
          document.activeElement.blur();
          setSearch("");
        }
        return;
      }
      if (e.key === "/" || e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        setSelected(null);
        setChecked(new Set());
        return;
      }
      if (e.key === "a") {
        setChecked((prev) =>
          prev.size === flatList.length
            ? new Set()
            : new Set(flatList.map((x) => x._id)),
        );
        return;
      }
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        setShowShortcuts((v) => !v);
        return;
      }
      if ((e.key === "j" || e.key === "ArrowDown") && flatList.length) {
        e.preventDefault();
        const next = Math.min(
          (selectedIdx.current ?? -1) + 1,
          flatList.length - 1,
        );
        selectedIdx.current = next;
        setSelected(flatList[next]);
        return;
      }
      if ((e.key === "k" || e.key === "ArrowUp") && flatList.length) {
        e.preventDefault();
        const prev = Math.max((selectedIdx.current ?? 0) - 1, 0);
        selectedIdx.current = prev;
        setSelected(flatList[prev]);
        return;
      }
      if (e.key === "d" && selected) {
        setDelConfirm(`single:${selected._id}`);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flatList, selected]);

  // Sync selectedIdx on select
  useEffect(() => {
    if (selected) {
      const i = flatList.findIndex((x) => x._id === selected._id);
      if (i !== -1) selectedIdx.current = i;
    }
  }, [selected, flatList]);

  const toggleCheck = (id) =>
    setChecked((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () =>
    setChecked(
      checked.size === filtered.length
        ? new Set()
        : new Set(filtered.map((e) => e._id)),
    );
  const toggleGroup = (g) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      n.has(g) ? n.delete(g) : n.add(g);
      return n;
    });

  const doDelete = async (payload) => {
    try {
      const res = await fetch(API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        setSelected(null);
        setChecked(new Set());
        fetchErrors();
      } else showToast(json.message, "error");
    } catch {
      showToast("Delete failed", "error");
    }
    setDelConfirm(null);
  };

  const confirmDelete = (type) => {
    if (type === "bulk") doDelete({ ids: [...checked] });
    else if (type === "all") doDelete({ deleteAll: true });
    else if (type?.startsWith("single:")) {
      const ids = selected?._ids || [type.split(":")[1]];
      ids.length === 1 ? doDelete({ id: ids[0] }) : doDelete({ ids });
    }
  };

  // Theme tokens
  const bg = dark ? "bg-[#0a0a0a]" : "bg-[#fafafa]";
  const border = dark ? "border-white/8" : "border-black/8";
  const textBase = dark ? "text-white" : "text-black";
  const textMid = dark ? "text-white/50" : "text-black/50";
  const textDim = dark ? "text-white/30" : "text-black/30";
  const surfaceA = dark ? "bg-white/5" : "bg-black/4";
  const surfaceB = dark ? "bg-white/3" : "bg-black/3";
  const hoverA = dark ? "hover:bg-white/8" : "hover:bg-black/5";
  const btnBorder = dark ? "border-white/10" : "border-black/10";

  return (
    <div
      className={`flex flex-col h-screen ${bg} ${textBase} overflow-hidden`}
      style={{
        fontFamily: "'Geist Mono','Fira Code','Cascadia Code',monospace",
      }}
    >
      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <header
        className={`flex items-center justify-between px-5 h-12 border-b ${border} ${bg} shrink-0 z-20`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-5 h-5 rounded flex items-center justify-center ${dark ? "bg-white text-black" : "bg-black text-white"}`}
            >
              <AlertTriIcon size={12} />
            </div>
            <span className="text-sm font-bold tracking-tight">
              Error Monitor
            </span>
          </div>
          <span className={`${dark ? "text-white/15" : "text-black/15"}`}>
            |
          </span>
          <span className={`text-xs ${textDim}`}>
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-refresh */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${btnBorder} ${surfaceB}`}
          >
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`relative w-7 h-4 rounded-full transition-colors duration-200 ${autoRefresh ? "bg-emerald-500" : dark ? "bg-white/15" : "bg-black/15"}`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-200 ${autoRefresh ? "left-3.5" : "left-0.5"}`}
              />
            </button>
            <span className={`text-xs flex items-center gap-1 ${textMid}`}>
              {autoRefresh ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {countdown}s
                </>
              ) : (
                "Auto"
              )}
            </span>
            {autoRefresh && (
              <select
                value={refreshSecs}
                onChange={(e) => setRefreshSecs(Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className={`bg-transparent text-xs outline-none cursor-pointer ${textDim}`}
              >
                {[10, 30, 60, 120].map((v) => (
                  <option
                    key={v}
                    value={v}
                    className={dark ? "bg-[#111]" : "bg-white"}
                  >
                    {v}s
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={fetchErrors}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${btnBorder} ${surfaceB} ${textMid} ${hoverA}`}
          >
            <RefreshIcon />
            Refresh
          </button>

          {/* Dedup toggle */}
          <button
            onClick={() => setDedupe((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${btnBorder}
              ${dedupe ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : `${surfaceB} ${textMid} ${hoverA}`}`}
          >
            Dedup
          </button>

          {/* Light/Dark */}
          <button
            onClick={() => setDark((v) => !v)}
            className={`p-1.5 rounded-lg border transition-colors ${btnBorder} ${surfaceB} ${textMid} ${hoverA}`}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* Shortcuts */}
          <button
            onClick={() => setShowShortcuts((v) => !v)}
            className={`p-1.5 rounded-lg border transition-colors ${btnBorder} ${surfaceB} ${textMid} ${hoverA}`}
          >
            <KeyboardIcon />
          </button>

          {lastRefresh && (
            <span className={`text-xs hidden md:block ${textDim}`}>
              {lastRefresh.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
        </div>
      </header>

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <StatsBar errors={errors} dark={dark} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* ── List Panel ────────────────────────────────────────────────── */}
        <div
          className={`flex flex-col border-r ${border} shrink-0 transition-all duration-300 ${selected ? "w-[420px]" : "flex-1"}`}
        >
          {/* Toolbar */}
          <div
            className={`px-4 py-2.5 border-b ${border} ${bg} space-y-2 shrink-0`}
          >
            {/* Search */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${btnBorder} ${surfaceA} focus-within:border-blue-500/40 transition-colors`}
            >
              <SearchIcon />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search errors…  ( / to focus )"
                className={`flex-1 bg-transparent text-xs outline-none placeholder-current ${textMid}`}
              />
              {search && (
                <button onClick={() => setSearch("")} className={textDim}>
                  <XIcon />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={textDim}>
               Filter
              </span>

              <div
                className={`flex rounded-md border overflow-hidden ${btnBorder}`}
              >
                {["date", "project", "type"].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={`px-2.5 py-1 text-xs capitalize transition-colors
                      ${groupBy === g ? (dark ? "bg-white/12 text-white" : "bg-black/10 text-black") : `${textDim} ${hoverA}`}`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              {projects.length > 0 && (
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className={`px-2 py-1 rounded-md border text-xs outline-none cursor-pointer ${btnBorder} ${surfaceA} ${textMid}`}
                >
                  <option
                    value="all"
                    className={dark ? "bg-[#111]" : "bg-white"}
                  >
                    All projects
                  </option>
                  {projects.map((p) => (
                    <option
                      key={p}
                      value={p}
                      className={dark ? "bg-[#111]" : "bg-white"}
                    >
                      {p}
                    </option>
                  ))}
                </select>
              )}

              {types.length > 0 && (
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className={`px-2 py-1 rounded-md border text-xs outline-none cursor-pointer ${btnBorder} ${surfaceA} ${textMid}`}
                >
                  <option
                    value="all"
                    className={dark ? "bg-[#111]" : "bg-white"}
                  >
                    All types
                  </option>
                  {types.map((t) => (
                    <option
                      key={t}
                      value={t}
                      className={dark ? "bg-[#111]" : "bg-white"}
                    >
                      {t}
                    </option>
                  ))}
                </select>
              )}

              <div className="ml-auto flex items-center gap-1">
                {checked.size > 0 && (
                  <button
                    onClick={() => setDelConfirm("bulk")}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                  >
                    <TrashIcon />
                    {checked.size} selected
                  </button>
                )}
                <button
                  onClick={() => setDelConfirm("all")}
                  className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${btnBorder} ${textDim} hover:text-red-400 hover:border-red-500/20`}
                >
                  Clear all
                </button>
              </div>
            </div>

            {filtered.length > 0 && (
              <button
                onClick={toggleAll}
                className={`flex items-center gap-2 text-xs transition-colors ${textDim} ${hoverA}`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors
                  ${
                    checked.size === filtered.length && filtered.length > 0
                      ? dark
                        ? "bg-white border-white"
                        : "bg-black border-black"
                      : dark
                        ? "border-white/20"
                        : "border-black/20"
                  }`}
                >
                  {checked.size === filtered.length && filtered.length > 0 && (
                    <span className={dark ? "text-black" : "text-white"}>
                      <CheckIcon />
                    </span>
                  )}
                </div>
                {checked.size === filtered.length && filtered.length > 0
                  ? "Deselect all"
                  : "Select all"}
                <span
                  className={`ml-1 text-[10px] ${dark ? "text-white/20" : "text-black/20"}`}
                >
                  ( a )
                </span>
              </button>
            )}
          </div>

          {/* Error List */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div
                  className={`w-5 h-5 border-2 rounded-full animate-spin ${dark ? "border-white/10 border-t-white/60" : "border-black/10 border-t-black/60"}`}
                />
              </div>
            ) : filtered.length === 0 ? (
              <div
                className={`flex flex-col items-center justify-center h-32 gap-2 ${textDim}`}
              >
                <AlertTriIcon size={20} />
                <p className="text-xs">No errors found</p>
              </div>
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <button
                    onClick={() => toggleGroup(group)}
                    className={`w-full flex items-center gap-2 px-4 py-2 border-b sticky top-0 z-10 transition-colors
                      ${dark ? "bg-white/2 border-white/5 hover:bg-white/4" : "bg-black/2 border-black/5 hover:bg-black/3"}`}
                  >
                    <ChevronIcon open={!collapsed.has(group)} />
                    <span className={`text-xs font-semibold ${textMid}`}>
                      {group}
                    </span>
                    <span
                      className={`ml-auto text-xs px-2 py-0.5 rounded-full ${dark ? "text-white/25 bg-white/5" : "text-black/30 bg-black/5"}`}
                    >
                      {items.length}
                    </span>
                  </button>
                  {!collapsed.has(group) &&
                    items.map((e) => (
                      <ErrorRow
                        key={e._id}
                        error={e}
                        dark={dark}
                        selected={selected?._id === e._id}
                        checked={checked.has(e._id)}
                        onSelect={setSelected}
                        onCheck={toggleCheck}
                      />
                    ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Detail Panel ──────────────────────────────────────────────── */}
        {selected ? (
          <div className={`flex-1 overflow-hidden flex flex-col ${bg}`}>
            <ErrorDetail
              error={selected}
              dark={dark}
              onClose={() => setSelected(null)}
              onDelete={(ids) => setDelConfirm(`single:${ids[0]}`)}
            />
          </div>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center">
            <div className="text-center space-y-3">
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center mx-auto ${surfaceA} ${border} ${textDim}`}
              >
                <AlertTriIcon size={20} />
              </div>
              <p className={`text-xs ${textDim}`}>Select an error to inspect</p>
              <div
                className={`flex items-center gap-2 justify-center text-xs ${dark ? "text-white/20" : "text-black/20"}`}
              >
                <Kbd dark={dark}>j</Kbd>
                <span>/</span>
                <Kbd dark={dark}>k</Kbd>
                <span className="ml-1">to navigate</span>
              </div>
            </div>
          </div>
        )}

        {/* Shortcuts overlay */}
        <ShortcutsHint dark={dark} visible={showShortcuts} />
      </div>

      {/* ── Delete Confirm Modal ──────────────────────────────────────────── */}
      {delConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setDelConfirm(null)}
        >
          <div
            className={`rounded-xl border p-6 w-80 shadow-2xl ${dark ? "bg-[#111] border-white/12" : "bg-white border-black/10 shadow-black/10"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <TrashIcon size={15} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${textBase}`}>
                  Confirm Delete
                </p>
                <p className={`text-xs ${textDim}`}>This cannot be undone</p>
              </div>
            </div>
            <p className={`text-xs mb-4 ${textMid}`}>
              {delConfirm === "bulk"
                ? `Delete ${checked.size} selected error${checked.size > 1 ? "s" : ""}?`
                : delConfirm === "all"
                  ? "Delete ALL errors in the database?"
                  : selected?._count > 1
                    ? `Delete all ${selected._count} occurrences of this error?`
                    : "Delete this error?"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDelConfirm(null)}
                className={`flex-1 py-2 rounded-lg border text-xs transition-colors ${btnBorder} ${textMid} ${hoverA}`}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(delConfirm)}
                className="flex-1 py-2 rounded-lg bg-red-500 text-xs text-white font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-medium shadow-xl z-50
          ${
            toast.type === "error"
              ? "bg-red-500/10 border-red-500/20 text-red-300"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
          }`}
        >
          {toast.type === "error" ? <AlertTriIcon /> : <CheckIcon />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default Page;