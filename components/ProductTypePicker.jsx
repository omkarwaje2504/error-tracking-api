'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Type-to-filter combobox for a project's product type. Pick an existing
 * one, or just type a new name straight in — it gets created on the fly.
 */
export default function ProductTypePicker({ value, onChange }) {
    const [types, setTypes] = useState([]);
    const [query, setQuery] = useState(value || '');
    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => { setQuery(value || ''); }, [value]);
    useEffect(() => { load(); }, []);

    async function load() {
        const res = await fetch('/api/product-types');
        if (res.ok) setTypes(await res.json());
    }

    useEffect(() => {
        function onDocClick(e) {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    const filtered = types.filter((t) => !query || t.name.toLowerCase().includes(query.toLowerCase()));
    const exact = types.find((t) => t.name.toLowerCase() === query.trim().toLowerCase());

    function pick(name) {
        setQuery(name);
        setOpen(false);
        onChange(name);
    }

    async function createAndPick(name) {
        setCreating(true);
        try {
            const res = await fetch('/api/product-types', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await res.json();
            if (res.ok) {
                setTypes((t) => (t.some((x) => x._id === data._id) ? t : [...t, data]));
                pick(data.name);
            }
        } finally {
            setCreating(false);
        }
    }

    return (
        <div className="relative" ref={boxRef}>
            <input
                className="input"
                placeholder="Type or pick a product type…"
                value={query}
                onFocus={() => setOpen(true)}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onBlur={() => onChange(query.trim())}
            />
            {open && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-panel shadow-[var(--shadow-pop)]">
                    {filtered.map((t) => (
                        <button
                            key={t._id} type="button"
                            className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-panel2"
                            onMouseDown={(e) => { e.preventDefault(); pick(t.name); }}
                        >
                            {t.name}
                        </button>
                    ))}
                    {query.trim() && !exact && (
                        <button
                            type="button" disabled={creating}
                            className="block w-full truncate px-3 py-2 text-left text-sm font-medium text-[var(--accent)] hover:bg-panel2"
                            onMouseDown={(e) => { e.preventDefault(); createAndPick(query.trim()); }}
                        >
                            {creating ? 'Adding…' : `+ Create "${query.trim()}"`}
                        </button>
                    )}
                    {filtered.length === 0 && !query.trim() && (
                        <p className="px-3 py-2 text-sm text-neutral-500">No product types yet — start typing to create one.</p>
                    )}
                </div>
            )}
        </div>
    );
}
