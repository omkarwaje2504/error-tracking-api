"use client";
// ─────────────────────────────────────────────
//  components/left-panel/tools/PhotosTool.jsx
// ─────────────────────────────────────────────
import { useRef } from "react";
import { PanelHeader } from "../../ui-atoms";

const STOCK_PHOTOS = [
  { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=70", label: "Mountains" },
  { url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=70", label: "Night Sky" },
  { url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=70", label: "Forest"    },
  { url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=70", label: "Ocean"     },
  { url: "https://images.unsplash.com/photo-1531804055935-76f44d7c3621?w=400&q=70", label: "City"      },
  { url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&q=70", label: "Flowers"   },
];

export default function PhotosTool({ addImage }) {
  const fileRef = useRef();

  const loadFromUrl = (src) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => addImage(img, img.width, img.height);
    img.src = src;
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => addImage(img, img.width, img.height);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <PanelHeader label="Photos" />

      <button
        onClick={() => fileRef.current.click()}
        className="py-2.5 rounded-lg border border-dashed border-white text-white text-sm font-semibold hover:bg-white hover:text-black transition-colors"
      >
        ⬆ Upload Image
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files[0]) handleFile(e.target.files[0]);
          e.target.value = "";
        }}
      />

      <PanelHeader label="Stock Photos" small />
      <div className="grid grid-cols-2 gap-2">
        {STOCK_PHOTOS.map((s) => (
          <div
            key={s.url}
            onClick={() => loadFromUrl(s.url)}
            className="relative rounded-lg overflow-hidden cursor-pointer border border-gray-800 hover:border-white transition-colors aspect-square"
          >
            <img src={s.url} alt={s.label} className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-xs text-white">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
