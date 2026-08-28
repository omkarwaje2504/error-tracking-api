'use client';
import { useEffect, useRef, useState } from 'react';
import { getReference } from '@/lib/referenceCache';

/**
 * Type-to-filter combobox for a printer, same pattern as ProductTypePicker —
 * pick an existing one, or just type a new name straight in to create it.
 */
export default function PrinterPicker({ value, onChange }) {
    const [printers, setPrinters] = useState([]);
    const [query, setQuery] = useState(value || '');
    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => { setQuery(value || ''); }, [value]);
    useEffect(() => { load(); }, []);

    async function load() {
        setPrinters(await getReference('printers'));
    }

    useEffect(() => {
        function onDocClick(e) {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    const filtered = printers.filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()));
    const exact = printers.find((p) => p.name.toLowerCase() === query.trim().toLowerCase());

    function pick(name) {
        setQuery(name);
        setOpen(false);
        onChange(name);
    }

    async function createAndPick(name) {
        setCreating(true);
        try {
            const res = await fetch('/api/printers', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await res.json();
            if (res.ok) {
                setPrinters((p) => (p.some((x) => x._id === data._id) ? p : [...p, data]));
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
                placeholder="Type or pick a printer…"
                value={query}
                onFocus={() => setOpen(true)}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onBlur={() => onChange(query.trim())}
            />
            {open && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-panel shadow-[var(--shadow-pop)]">
                    {filtered.map((p) => (
                        <button
                            key={p._id} type="button"
                            className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-panel2"
                            onMouseDown={(e) => { e.preventDefault(); pick(p.name); }}
                        >
                            {p.name}
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
                        <p className="px-3 py-2 text-sm text-neutral-500">No printers yet — start typing to create one.</p>
                    )}
                </div>
            )}
        </div>
    );
}
