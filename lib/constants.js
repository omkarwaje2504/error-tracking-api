// ─────────────────────────────────────────────
//  lib/constants.js  — shared config values
// ─────────────────────────────────────────────

export const FONTS = [
  "Playfair Display", "Montserrat", "Oswald", "Lato",
  "Georgia", "Trebuchet MS", "Verdana", "Courier New", "Impact", "Arial Black",
];

export const UNITS = ["px", "cm", "mm", "in"];

export const PX_PER = { px: 1, cm: 37.7953, mm: 3.77953, in: 96 };

export const SNAP_THRESHOLD = 8; // px distance that triggers magnetic guides

export const PRESET_SIZES = [
  { label: "Instagram Post",  w: 800,  h: 800  },
  { label: "Instagram Story", w: 450,  h: 800  },
  { label: "Facebook Cover",  w: 820,  h: 312  },
  { label: "Twitter Post",    w: 800,  h: 450  },
  { label: "A4 Portrait",     w: 595,  h: 842  },
  { label: "A4 Landscape",    w: 842,  h: 595  },
  { label: "Business Card",   w: 700,  h: 400  },
  { label: "Presentation",    w: 800,  h: 450  },
];

export const SHAPE_TYPES = [
  { id: "rect",     label: "Rect",     icon: "▭" },
  { id: "circle",   label: "Circle",   icon: "○" },
  { id: "triangle", label: "Triangle", icon: "△" },
  { id: "star",     label: "Star",     icon: "★" },
  { id: "arrow",    label: "Arrow",    icon: "→" },
  { id: "line",     label: "Line",     icon: "╱" },
];

export const PALETTE = [
  "#ffffff", "#f5f5f5", "#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373", "#404040", "#171717",
  "#fca5a5", "#ef4444", "#b91c1c", "#fde68a", "#f59e0b", "#b45309",
  "#86efac", "#22c55e", "#15803d", "#93c5fd", "#3b82f6", "#1d4ed8",
  "#d8b4fe", "#a855f7", "#7e22ce", "#f9a8d4", "#ec4899", "#be185d",
  "#67e8f9", "#06b6d4", "#0e7490", "#fdba74", "#f97316", "#c2410c",
];

export const LEFT_TOOLS = [
  { id: "text",   icon: "T",  label: "Text"   },
  { id: "shapes", icon: "⬡",  label: "Shapes" },
  { id: "photos", icon: "🖼", label: "Photos" },
  { id: "layers", icon: "⧉",  label: "Layers" },
  { id: "size",   icon: "⤢",  label: "Size"   },
];

export const SHORTCUTS = {
  "ctrl+z":         "Undo",
  "ctrl+y":         "Redo",
  "ctrl+c":         "Copy",
  "ctrl+v":         "Paste",
  "ctrl+d":         "Duplicate",
  "ctrl+a":         "Select All",
  "ctrl+g":         "Group",
  "ctrl+shift+g":   "Ungroup",
  "Delete":         "Delete selected",
  "Backspace":      "Delete selected",
  "Escape":         "Deselect",
  "ctrl+]":         "Bring forward",
  "ctrl+[":         "Send backward",
  "ArrowUp":        "Nudge up 1px",
  "ArrowDown":      "Nudge down 1px",
  "ArrowLeft":      "Nudge left 1px",
  "ArrowRight":     "Nudge right 1px",
  "shift+Arrow":    "Nudge ×10px",
};
