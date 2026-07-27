"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  FaBug,
  FaClock,
  FaLaptop,
  FaChevronDown,
  FaUsers,
  FaMapMarkerAlt,
  FaCode,
  FaPlay,
  FaPause,
  FaBuilding,
  FaUserTie,
  FaUser,
  FaCheck,
  FaTimes,
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaLayerGroup,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaImage,
  FaFileExcel,
  FaDownload,
  FaTrashAlt
} from "react-icons/fa";
import { IoRefresh, IoClose } from "react-icons/io5";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const API = "https://my-server-jade-beta.vercel.app/api/error";
const ANALYTICS = `${API}/analytics`;
const EXPORT = `${API}/export`;
const ALLOWED_STATUSES = ["pending", "resolved", "rejected"];
const PAGE_SIZE = 500; // rows per SERVER page

/* =================================================================
   Helpers
================================================================= */
const fmtDateTime = (ts) =>
  new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtFull = (ts) =>
  new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const dayKey = (ts) =>
  new Date(ts).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/* =================================================================
   Global animation keyframes (injected once)
================================================================= */
const Styles = () => (
  <style>{`
    @keyframes etFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @keyframes etSlideIn { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: none; } }
    .et-in { animation: etFadeIn .35s cubic-bezier(.2,.7,.3,1) both; }
    .et-slide { animation: etSlideIn .3s ease both; }
    .et-expand { animation: etFadeIn .25s ease both; }
  `}</style>
);

/* =================================================================
   UI atoms — monochrome, lifted surfaces + white accents
================================================================= */
const Button = ({
  children,
  variant = "default",
  size = "md",
  className = "",
  disabled = false,
  active = false,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-white/40 disabled:opacity-30 disabled:cursor-not-allowed select-none active:scale-[.97]";
  const variants = {
    default:
      "bg-neutral-800 text-neutral-100 border border-white/10 hover:bg-neutral-700 hover:border-white/20",
    solid: "bg-white text-black hover:bg-neutral-200",
    ghost: "text-neutral-400 hover:text-white hover:bg-white/5",
    danger:
      "bg-neutral-800 text-neutral-200 border border-white/10 hover:bg-neutral-700 hover:text-white",
  };
  const sizes = {
    xs: "px-2 py-1 text-[11px] gap-1",
    sm: "px-2.5 py-1.5 text-xs gap-1.5",
    md: "px-3.5 py-2 text-sm gap-2",
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${active ? "!bg-white !text-black" : ""
        } ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

const Pill = ({ children, className = "" }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border border-white/15 text-neutral-300 ${className}`}
  >
    {children}
  </span>
);

const Check = ({ checked, onChange, onClick }) => (
  <button
    role="checkbox"
    aria-checked={checked}
    onClick={(e) => {
      onClick?.(e);
      onChange?.();
    }}
    className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-all ${checked
      ? "bg-white border-white text-black"
      : "border-neutral-500 hover:border-white"
      }`}
  >
    {checked && <FaCheck className="text-[8px]" />}
  </button>
);

/* =================================================================
   Stat card (compact)
================================================================= */
const StatCard = ({ label, value, icon: Icon, delay = 0 }) => (
  <div
    className="et-in bg-neutral-900 border border-white/10 rounded-lg p-2.5 flex items-center justify-between gap-2"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p className="text-xl font-mono font-semibold text-white tabular-nums leading-tight">
        {value}
      </p>
    </div>
    <div className="p-1.5 rounded-md bg-white/5 border border-white/10 text-neutral-300">
      <Icon className="text-xs" />
    </div>
  </div>
);

/* =================================================================
   Charts (monochrome, compact)
================================================================= */
const ChartShell = ({ title, children, delay = 0 }) => (
  <div
    className="et-in bg-neutral-900 border border-white/10 rounded-lg p-2.5"
    style={{ animationDelay: `${delay}ms` }}
  >
    <h3 className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
      {title}
    </h3>
    <div className="h-32 w-full">{children}</div>
  </div>
);

const tooltipStyle = {
  background: "#171717",
  border: "1px solid rgba(255,255,255,.15)",
  borderRadius: 8,
  fontSize: 12,
  color: "#fff",
};

const TimeChart = ({ data, delay }) => (
  <ChartShell title="Errors over time · 14 days" delay={delay}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 4, right: 6, left: -24, bottom: 0 }}
      >
        <defs>
          <linearGradient id="etGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#737373", fontSize: 9 }}
          axisLine={{ stroke: "rgba(255,255,255,.1)" }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#737373", fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#525252" }} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#fff"
          strokeWidth={1.5}
          fill="url(#etGrad)"
          animationDuration={600}
        />
      </AreaChart>
    </ResponsiveContainer>
  </ChartShell>
);

const BarBlock = ({ title, data, delay }) => (
  <ChartShell title={title} delay={delay}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={88}
          tick={{ fill: "#a3a3a3", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(255,255,255,.05)" }}
        />
        <Bar
          dataKey="count"
          fill="#fafafa"
          radius={[0, 3, 3, 0]}
          barSize={12}
          animationDuration={600}
        />
      </BarChart>
    </ResponsiveContainer>
  </ChartShell>
);

/* =================================================================
   Error row (leaf)
================================================================= */
const ErrorRow = ({ error, onView, onDelete, isSelected, onToggle }) => {
  const checked = isSelected?.(error._id) || false;
  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/[.03] transition-colors">
      <div className="pt-0.5">
        <Check
          checked={checked}
          onChange={() => onToggle?.(error._id)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <button
        className="flex-1 min-w-0 text-left"
        onClick={() => onView(error)}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-white truncate">
            {error.error?.name}
          </span>
          {error.status && error.status !== "pending" && (
            <Pill>{error.status}</Pill>
          )}
        </div>
        <p className="text-xs text-neutral-500 line-clamp-1 mb-1.5">
          {error.error?.message}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 font-mono">
          <span className="flex items-center gap-1">
            <FaClock className="text-neutral-600" />
            {fmtDateTime(error.timestamp)}
          </span>
          <span className="flex items-center gap-1">
            <FaLaptop className="text-neutral-600" />
            {error.deviceInfo?.browser || "Unknown"}
          </span>
          {error.deviceInfo?.employeeDetails?.name && (
            <span className="flex items-center gap-1">
              <FaUser className="text-neutral-600" />
              {error.deviceInfo.employeeDetails.name}
            </span>
          )}
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(error._id);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/10"
        aria-label="Delete"
      >
        <IoClose />
      </button>
    </div>
  );
};

/* =================================================================
   Group card
================================================================= */
const GroupCard = ({
  group,
  icon: Icon,
  defaultOpen = false,
  delay = 0,
  onView,
  onDelete,
  isSelected,
  toggleSelect,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const errors = group.errors;
  const allChecked =
    errors.length > 0 && errors.every((e) => isSelected?.(e._id));
  const uniqEmployees = new Set(
    errors.map((e) => e.deviceInfo?.employeeDetails?.code || "?"),
  ).size;
  const uniqTypes = new Set(errors.map((e) => e.error?.name)).size;

  return (
    <div
      className="et-in bg-neutral-900 border border-white/10 rounded-xl overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="flex items-center gap-3 px-3.5 py-3 cursor-pointer hover:bg-white/[.04] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <Check
          checked={allChecked}
          onClick={(e) => e.stopPropagation()}
          onChange={() => {
            if (allChecked) errors.forEach((e) => toggleSelect(e._id));
            else
              errors.forEach((e) => {
                if (!isSelected(e._id)) toggleSelect(e._id);
              });
          }}
        />
        <div className="p-1.5 rounded-md bg-white/5 border border-white/10 text-neutral-200">
          <Icon className="text-xs" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">
              {group.label}
            </h3>
            <Pill className="!text-white !border-white/30">
              {errors.length}
            </Pill>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-neutral-500 font-mono mt-0.5">
            <span className="flex items-center gap-1">
              <FaUsers className="text-neutral-600" />
              {uniqEmployees} emp
            </span>
            <span className="flex items-center gap-1">
              <FaBug className="text-neutral-600" />
              {uniqTypes} types
            </span>
            <span className="hidden sm:inline">
              last {fmtDateTime(errors[0]?.timestamp)}
            </span>
          </div>
        </div>
        <FaChevronDown
          className={`text-neutral-400 text-xs transition-transform duration-200 ${open ? "rotate-180" : ""
            }`}
        />
      </div>

      {open && (
        <div className="et-expand border-t border-white/10 p-2 space-y-1">
          {errors.map((error) => (
            <ErrorRow
              key={error._id}
              error={error}
              onView={onView}
              onDelete={onDelete}
              isSelected={isSelected}
              onToggle={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* =================================================================
   Full-page detail
================================================================= */
const DetailRow = ({ label, value }) =>
  value ? (
    <div className="flex gap-2 text-xs py-0.5">
      <span className="text-neutral-500 w-24 shrink-0">{label}</span>
      <span className="text-neutral-100 break-all">{value}</span>
    </div>
  ) : null;

const Section = ({ title, icon: Icon, children, className = "" }) => (
  <div
    className={`bg-neutral-900 border border-white/10 rounded-xl p-4 ${className}`}
  >
    <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-neutral-400 mb-3">
      <Icon className="text-xs" /> {title}
    </h3>
    <div className="space-y-1">{children}</div>
  </div>
);

const ErrorDetail = ({ error, loading, onBack, onResolve, onReject }) => {
  const emp = error.deviceInfo?.employeeDetails || {};
  const loc = error.locationInfo || {};
  const dev = error.deviceInfo || {};
  const mappedStack = error.mappedStack || [];

  return (
    <div className="min-h-screen bg-black text-neutral-200 antialiased">

      <Styles />
      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button variant="default" size="sm" onClick={onBack}>
            <FaChevronLeft className="text-[10px]" /> Back
          </Button>
          <div className="flex items-center gap-2">
            {loading && (
              <span className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono">
                <IoRefresh className="animate-spin" /> loading details…
              </span>
            )}
            <Button
              variant="solid"
              size="sm"
              onClick={() => onResolve(error._id)}
            >
              <FaCheck /> Resolve
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => onReject(error._id)}
            >
              <FaTimes /> Reject
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4 et-in">
        {/* Title */}
        <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FaExclamationTriangle className="text-neutral-300" />
            <h1 className="text-xl font-bold text-white">
              {error.error?.name}
            </h1>
            {error.status && error.status !== "pending" && (
              <Pill>{error.status}</Pill>
            )}
          </div>
          <div className="bg-black border border-white/10 rounded-lg p-3">
            <p className="text-sm text-neutral-100">{error.error?.message}</p>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Section title="Error" icon={FaClock}>
            <DetailRow label="Time" value={fmtFull(error.timestamp)} />
            <DetailRow label="Status" value={error.status || "pending"} />
            <DetailRow label="User ID" value={error.userId} />
            <DetailRow label="Project ID" value={error.projectId} />
          </Section>

          <Section title="Device" icon={FaLaptop}>
            <DetailRow label="Browser" value={dev.browser} />
            <DetailRow label="OS" value={dev.os} />
            <DetailRow label="Device" value={dev.device} />
            <DetailRow label="Screen" value={dev.screen} />
            <DetailRow label="User Agent" value={dev.userAgent} />
          </Section>

          {emp.code && (
            <Section title="Employee" icon={FaUserTie}>
              <DetailRow label="Name" value={emp.name} />
              <DetailRow label="Code" value={emp.code} />
              <DetailRow label="Role" value={emp.role_name} />
              <DetailRow label="Designation" value={emp.designation} />
              <DetailRow label="Region" value={emp.region} />
              <DetailRow label="Zone" value={emp.zone} />
              <DetailRow label="HQ" value={emp.hq} />
            </Section>
          )}

          <Section title="Location" icon={FaMapMarkerAlt}>
            <DetailRow label="URL" value={loc.url} />
            <DetailRow label="Referrer" value={loc.referrer} />
            <DetailRow
              label="Geo"
              value={[error.city, error.state, error.country]
                .filter(Boolean)
                .join(", ")}
            />
          </Section>
        </div>

        {/* Screenshot (only in the by-id detail payload) */}
        {error.screenshot && (
          <Section title="Screenshot" icon={FaImage}>
            <img
              src={error.screenshot}
              alt="Error screenshot"
              className="w-full rounded-lg border border-white/10"
            />
          </Section>
        )}

        {/* Full stack trace */}
        <Section title="Stack Trace" icon={FaCode}>
          {mappedStack.length > 0 ? (
            <div className="space-y-3">
              {mappedStack.map((frame, i) =>
                frame.separator ? (
                  <div key={i} className="border-t border-white/10 my-2" />
                ) : (
                  <div key={i} className="text-xs font-mono">
                    {frame.function && (
                      <div className="text-neutral-300 mb-1">
                        at {frame.function}
                        {frame.source &&
                          ` (${frame.source}:${frame.line}:${frame.column})`}
                      </div>
                    )}
                    {frame.snippet && (
                      <pre className="text-neutral-100 bg-black border border-white/10 p-3 rounded-md whitespace-pre-wrap break-all">
                        {frame.snippet}
                      </pre>
                    )}
                  </div>
                ),
              )}
            </div>
          ) : (
            <pre className="text-[12px] leading-relaxed text-neutral-200 font-mono whitespace-pre-wrap break-all bg-black border border-white/10 rounded-lg p-3">
              {error.error?.stack || "No stack available"}
            </pre>
          )}
        </Section>
      </main>
    </div>
  );
};

const DeleteAllModal = ({ open, onClose, onConfirm, total, deleting }) => {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (open) setConfirmText("");
  }, [open]);

  if (!open) return null;
  const armed = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm et-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 bg-neutral-900 border border-white/10 rounded-xl p-5 et-slide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-md bg-white/5 border border-white/10 text-neutral-200">
            <FaExclamationTriangle className="text-xs" />
          </div>
          <h3 className="text-sm font-semibold text-white">Delete all errors</h3>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed mb-3">
          This permanently deletes{" "}
          <span className="text-white font-mono">{total}</span> record
          {total === 1 ? "" : "s"} across every project. This cannot be undone.
          Type <span className="text-white font-mono">DELETE</span> to confirm.
        </p>

        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          className="w-full px-3 py-2 bg-neutral-800 border border-white/10 rounded-md text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/40 font-mono"
        />

        <div className="flex items-center justify-end gap-2 mt-5">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onConfirm}
            disabled={!armed || deleting}
          >
            {deleting ? (
              <>
                <IoRefresh className="animate-spin" /> Deleting…
              </>
            ) : (
              <>
                <FaTrashAlt /> Delete all
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* =================================================================
   Main dashboard
================================================================= */
export default function ErrorTrackingDashboard() {
  // server-driven data
  const [errors, setErrors] = useState([]); // current page rows
  const [analytics, setAnalytics] = useState(null); // full-DB aggregates
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1 });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // export data
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // delete view
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);


  // detail view
  const [selectedError, setSelectedError] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // filters — projectFilter + page are SERVER-side; the rest refine the page
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [groupBy, setGroupBy] = useState("project"); // project | date | type
  const [page, setPage] = useState(1);

  // selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds]);
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const prevIdsRef = useRef(new Set());

  /* ---------- fetch list + analytics together ---------- */
  const fetchAll = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      try {
        const listURL = new URL(API);
        listURL.searchParams.set("page", String(page));
        listURL.searchParams.set("limit", String(PAGE_SIZE));
        if (projectFilter) listURL.searchParams.set("projectId", projectFilter);

        const anURL = new URL(ANALYTICS);
        anURL.searchParams.set("top", "8");
        if (projectFilter) anURL.searchParams.set("projectId", projectFilter);

        const [listRes, anRes] = await Promise.all([
          fetch(listURL.toString()).then((r) => r.json()),
          fetch(anURL.toString()).then((r) => r.json()),
        ]);

        setErrors(listRes?.data || []);
        setPageInfo({
          total: listRes?.total ?? 0,
          totalPages: listRes?.totalPages ?? 1,
        });
        setAnalytics(anRes?.success ? anRes : null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, projectFilter],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchAll(true), 30000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchAll]);

  // reset to page 1 whenever the server-side filter changes
  useEffect(() => {
    setPage(1);
  }, [projectFilter]);

  // clamp page if the total shrinks (e.g. after deletes)
  useEffect(() => {
    if (page > pageInfo.totalPages) setPage(pageInfo.totalPages || 1);
  }, [pageInfo.totalPages, page]);

  /* ---------- tab flash on new errors (current page) ---------- */
  useEffect(() => {
    const prev = prevIdsRef.current;
    const current = new Set(errors.map((e) => e._id));
    const fresh = [...current].filter((id) => !prev.has(id));
    prevIdsRef.current = current;
    const title = "Error Tracker";
    if (fresh.length > 0) {
      let f = false;
      const id = setInterval(() => {
        document.title = f ? `(${fresh.length}) New • ${title}` : title;
        f = !f;
      }, 1000);
      return () => {
        clearInterval(id);
        document.title = title;
      };
    }
    document.title = title;
  }, [errors]);

  const exportExcel = useCallback(async ({ projectId, range }) => {
    setExporting(true);
    try {
      const url = new URL(EXPORT);
      if (projectId) url.searchParams.set("projectId", projectId);

      // translate the range into an absolute cutoff (ISO) for the server
      if (range) {
        const now = Date.now();
        let from;
        if (range === "today") from = new Date().setHours(0, 0, 0, 0);
        else if (range === "week") from = now - 7 * 864e5;
        else if (range === "month") from = now - 30 * 864e5;
        if (from) url.searchParams.set("from", new Date(from).toISOString());
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Export failed (${res.status})`);

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename =
        match?.[1] ||
        `pixpro-errors-${new Date().toISOString().slice(0, 10)}.xlsx`;

      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);

      setExportOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  }, []);

  const ExportModal = ({
    open,
    onClose,
    onExport,
    projectOptions,
    defaultProject = "",
    exporting,
  }) => {
    const [proj, setProj] = useState(defaultProject);
    const [range, setRange] = useState("");

    useEffect(() => {
      if (open) {
        setProj(defaultProject);
        setRange("");
      }
    }, [open, defaultProject]);

    if (!open) return null;

    const selectClass =
      "w-full bg-neutral-800 border border-white/10 rounded-md px-2.5 py-2 text-sm text-neutral-100 focus:outline-none focus:border-white/40 hover:border-white/25 transition-colors";

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm et-in"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm mx-4 bg-neutral-900 border border-white/10 rounded-xl p-5 et-slide"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <FaFileExcel className="text-neutral-300" /> Export to Excel
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10"
            >
              <IoClose />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
                Project
              </label>
              <select
                value={proj}
                onChange={(e) => setProj(e.target.value)}
                className={selectClass}
              >
                <option value="">All projects</option>
                {projectOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
                Date range
              </label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className={selectClass}
              >
                <option value="">All time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-5">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="solid"
              size="sm"
              onClick={() => onExport({ projectId: proj, range })}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <IoRefresh className="animate-spin" /> Exporting…
                </>
              ) : (
                <>
                  <FaDownload /> Export
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };


  /* ---------- filter options (full-DB from analytics, page fallback) ---------- */
  const projectOptions = useMemo(() => {
    if (analytics?.projectCounts?.length)
      return analytics.projectCounts
        .map((p) => p.projectId)
        .filter(Boolean)
        .sort();
    return [...new Set(errors.map((e) => e.projectId || "Unknown"))].sort();
  }, [analytics, errors]);

  const typeOptions = useMemo(() => {
    if (analytics?.errorTypes?.length)
      return analytics.errorTypes
        .map((t) => t.name)
        .filter(Boolean)
        .sort();
    return [...new Set(errors.map((e) => e.error?.name || "Unknown"))].sort();
  }, [analytics, errors]);

  /* ---------- client-side refine over the CURRENT page ---------- */
  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const now = Date.now();
    return errors
      .filter((e) => {
        const searchMatch =
          !q ||
          e.error?.message?.toLowerCase().includes(q) ||
          e.error?.name?.toLowerCase().includes(q) ||
          e.userId?.toLowerCase().includes(q) ||
          e.projectId?.toLowerCase().includes(q) ||
          e.deviceInfo?.employeeDetails?.code?.toLowerCase().includes(q) ||
          e.deviceInfo?.employeeDetails?.name?.toLowerCase().includes(q);

        const typeMatch =
          !typeFilter || (e.error?.name || "Unknown") === typeFilter;
        const statusMatch =
          !statusFilter || (e.status || "pending") === statusFilter;

        let dateMatch = true;
        if (dateRange) {
          const t = new Date(e.timestamp).getTime();
          if (dateRange === "today")
            dateMatch =
              new Date(e.timestamp).toDateString() ===
              new Date().toDateString();
          else if (dateRange === "week") dateMatch = t >= now - 7 * 864e5;
          else if (dateRange === "month") dateMatch = t >= now - 30 * 864e5;
        }
        return searchMatch && typeMatch && statusMatch && dateMatch;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [errors, searchTerm, typeFilter, statusFilter, dateRange]);

  /* ---------- chart data (full-DB from analytics, page fallback) ---------- */
  const charts = useMemo(() => {
    if (analytics) {
      return {
        time: (analytics.timeSeries || []).map((d) => ({
          label: d.label,
          count: d.count,
        })),
        byProject: (analytics.projectCounts || []).slice(0, 5).map((p) => ({
          name: p.projectId || "Unknown",
          count: p.count,
        })),
        byType: (analytics.errorTypes || []).slice(0, 5).map((t) => ({
          name: t.name || "Unknown",
          count: t.count,
        })),
      };
    }

    // fallback: derive from the current page only
    const days = [];
    const map = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5);
      const key = d.toDateString();
      const label = d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      });
      map[key] = { label, count: 0 };
      days.push(key);
    }
    errors.forEach((e) => {
      const key = new Date(e.timestamp).toDateString();
      if (map[key]) map[key].count++;
    });
    const tally = (fn) => {
      const o = {};
      errors.forEach((e) => {
        const k = fn(e) || "Unknown";
        o[k] = (o[k] || 0) + 1;
      });
      return Object.entries(o)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    };
    return {
      time: days.map((k) => map[k]),
      byProject: tally((e) => e.projectId),
      byType: tally((e) => e.error?.name),
    };
  }, [analytics, errors]);

  /* ---------- grouping (current page) ---------- */
  const groups = useMemo(() => {
    const keyer = {
      project: (e) => e.projectId || "Unknown Project",
      date: (e) => dayKey(e.timestamp),
      type: (e) => e.error?.name || "Unknown Error",
    }[groupBy];

    const map = new Map();
    filtered.forEach((e) => {
      const k = keyer(e);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    });

    let arr = [...map.entries()].map(([label, errs]) => ({
      label,
      errors: errs,
    }));
    if (groupBy === "date")
      arr.sort(
        (a, b) =>
          new Date(b.errors[0].timestamp) - new Date(a.errors[0].timestamp),
      );
    else arr.sort((a, b) => b.errors.length - a.errors.length);
    return arr;
  }, [filtered, groupBy]);

  /* ---------- open detail: fetch full doc by id ---------- */
  const openDetail = useCallback(async (errorLike) => {
    setSelectedError(errorLike); // show the lightweight row instantly
    setDetailLoading(true);
    try {
      const res = await fetch(`${API}?id=${errorLike._id}`).then((r) =>
        r.json(),
      );
      if (res?.success && res.data) setSelectedError(res.data); // hydrate full
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  /* ---------- mutations ---------- */
  const updateStatus = async (id, status) => {
    if (!ALLOWED_STATUSES.includes(status)) return;
    setErrors((es) => es.map((e) => (e._id === id ? { ...e, status } : e)));
    setSelectedError((cur) =>
      cur && cur._id === id ? { ...cur, status } : cur,
    );
    try {
      await fetch(API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
    } catch (err) {
      console.error(err);
      fetchAll(true);
    }
  };

  const deleteError = async (id) => {
    setErrors((es) => es.filter((e) => e._id !== id));
    try {
      await fetch(API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      fetchAll(true); // resync counts/pages
    }
  };

  const bulkDelete = async (ids) => {
    if (!ids?.length) return;
    setErrors((es) => es.filter((e) => !ids.includes(e._id)));
    try {
      await fetch(API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      fetchAll(true);
    }
  };

  const deleteSelected = async () => {
    await bulkDelete([...selectedIds]);
    clearSelection();
  };

  const deleteAll = useCallback(async () => {
    setDeletingAll(true);
    try {
      await fetch(API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      clearSelection();
      setDeleteAllOpen(false);
      setPage(1);
      await fetchAll(true);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingAll(false);
    }
  }, [fetchAll, clearSelection]);

  /* ---------- selection summary (current page) ---------- */
  const selectedCount = useMemo(
    () => filtered.filter((e) => selectedIds.has(e._id)).length,
    [filtered, selectedIds],
  );
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((e) => selectedIds.has(e._id));
  const toggleSelectAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const all = filtered.every((e) => next.has(e._id));
      filtered.forEach((e) => (all ? next.delete(e._id) : next.add(e._id)));
      return next;
    });

  const resetFilters = () => {
    setSearchTerm("");
    setDateRange("");
    setProjectFilter("");
    setTypeFilter("");
    setStatusFilter("");
  };
  const hasFilters =
    searchTerm || dateRange || projectFilter || typeFilter || statusFilter;

  const groupIcon = { project: FaBuilding, date: FaCalendarAlt, type: FaBug }[
    groupBy
  ];

  const selectClass =
    "bg-neutral-800 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-white/40 hover:border-white/25 transition-colors";

  const totalInDb = analytics?.totalErrors ?? pageInfo.total;
  const totalPages = pageInfo.totalPages;
  const safePage = Math.min(page, totalPages);

  /* ---------- full-page detail ---------- */
  if (selectedError) {
    return (
      <ErrorDetail
        error={selectedError}
        loading={detailLoading}
        onBack={() => setSelectedError(null)}
        onResolve={(id) => {
          updateStatus(id, "resolved");
          setSelectedError(null);
        }}
        onReject={(id) => {
          updateStatus(id, "rejected");
          setSelectedError(null);
        }}
      />
    );
  }

  /* =================================================================
     Render dashboard
  ================================================================= */
  return (
    <div className="min-h-screen bg-black text-neutral-200 antialiased">
      <Styles />
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={exportExcel}
        projectOptions={projectOptions}
        defaultProject={projectFilter}
        exporting={exporting}
      />
      <DeleteAllModal
        open={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={deleteAll}
        total={totalInDb}
        deleting={deletingAll}
      />
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-white text-black">
              <FaBug className="text-sm" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-white tracking-tight leading-none">
                Error Tracker
              </h1>
              <p className="text-[10px] text-neutral-500 hidden sm:block mt-0.5">
                Monitor &amp; resolve application errors
              </p>
            </div>
            <span className="ml-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono text-neutral-200">
              {totalInDb} total
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              active={autoRefresh}
              onClick={() => setAutoRefresh((v) => !v)}
            >
              {autoRefresh ? <FaPause /> : <FaPlay />}
              <span className="hidden sm:inline">
                {autoRefresh ? "Pause" : "Live"}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchAll(true)}
              disabled={refreshing}
            >
              <IoRefresh className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
          <div className="space-x-2">

            <Button variant="ghost" size="sm" className="border border-gray-700" onClick={() => setExportOpen(true)}>
              <FaFileExcel />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteAllOpen(true)}
              disabled={totalInDb === 0}
            >
              <FaTrashAlt />
              <span className="hidden sm:inline">Delete all</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-3">
        {/* ---------- Stat cards (from analytics) ---------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <StatCard label="Total" value={totalInDb} icon={FaBug} delay={0} />
          <StatCard
            label="On this page"
            value={filtered.length}
            icon={FaSearch}
            delay={40}
          />
          <StatCard
            label="Projects"
            value={analytics?.projectCount ?? projectOptions.length}
            icon={FaBuilding}
            delay={80}
          />
          <StatCard
            label="Error Types"
            value={analytics?.errorTypeCount ?? typeOptions.length}
            icon={FaLayerGroup}
            delay={120}
          />
        </div>

        {/* ---------- Charts (from analytics) ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <TimeChart data={charts.time} delay={140} />
          <BarBlock title="Top projects" data={charts.byProject} delay={180} />
          <BarBlock title="Top error types" data={charts.byType} delay={220} />
        </div>

        {/* ---------- Filters ---------- */}
        <div className="bg-neutral-900 border border-white/10 rounded-lg p-2.5 space-y-2">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search this page (message, type, project, employee…)"
                className="w-full pl-9 pr-3 py-1.5 bg-neutral-800 border border-white/10 rounded-md text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/40"
              />
            </div>
            <div className="grid grid-cols-2 md:flex gap-2">
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className={selectClass}
                title="Filtered on the server across all errors"
              >
                <option value="">All projects</option>
                {projectOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={selectClass}
              >
                <option value="">All types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className={selectClass}
              >
                <option value="">All time</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectClass}
              >
                <option value="">All status</option>
                {ALLOWED_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                Group by
              </span>
              <div className="flex bg-neutral-800 border border-white/10 rounded-md p-0.5">
                {[
                  ["project", "Project", FaBuilding],
                  ["date", "Date", FaCalendarAlt],
                  ["type", "Error Type", FaBug],
                ].map(([val, lbl, Ic]) => (
                  <button
                    key={val}
                    onClick={() => setGroupBy(val)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${groupBy === val
                      ? "bg-white text-black"
                      : "text-neutral-400 hover:text-white"
                      }`}
                  >
                    <Ic className="text-[10px]" />
                    <span className="hidden sm:inline">{lbl}</span>
                  </button>
                ))}
              </div>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <IoClose /> Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* ---------- Action bar ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Check checked={allVisibleSelected} onChange={toggleSelectAll} />
            <span className="text-xs text-neutral-400">
              {selectedCount > 0
                ? `${selectedCount} selected`
                : "Select all on page"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 font-mono">
              {filtered.length} on page · {totalInDb} total
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={deleteSelected}
              disabled={selectedCount === 0}
            >
              <IoClose /> Delete selected
            </Button>
          </div>
        </div>

        {/* ---------- Groups ---------- */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-neutral-900 border border-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-neutral-900 border border-white/10 rounded-xl p-12 text-center et-in">
            <div className="inline-flex p-3 rounded-full bg-white/5 border border-white/10 mb-3">
              <FaBug className="text-2xl text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-300 mb-3">No errors found</p>
            {hasFilters && (
              <Button variant="solid" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {groups.map((g, i) => (
                <GroupCard
                  key={g.label}
                  group={g}
                  icon={groupIcon}
                  defaultOpen={i === 0}
                  delay={i * 40}
                  onView={openDetail}
                  onDelete={deleteError}
                  isSelected={isSelected}
                  toggleSelect={toggleSelect}
                />
              ))}
            </div>

            {/* ---------- Server pagination ---------- */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-neutral-500 font-mono">
                  Page {safePage} / {totalPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >
                    <FaChevronLeft className="text-[10px]" /> Prev
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - safePage) <= 1,
                    )
                    .map((p, idx, arr) => (
                      <span key={p} className="flex items-center">
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="px-1 text-neutral-600">…</span>
                        )}
                        <button
                          onClick={() => setPage(p)}
                          className={`min-w-[30px] h-[30px] rounded-md text-xs font-mono transition-colors ${p === safePage
                            ? "bg-white text-black"
                            : "bg-neutral-800 border border-white/10 text-neutral-400 hover:text-white"
                            }`}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                  >
                    Next <FaChevronRight className="text-[10px]" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-white/10 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-[11px] text-neutral-600 font-mono">
          Error Tracking Dashboard · React + Next.js
        </div>
      </footer>
    </div>
  );
}