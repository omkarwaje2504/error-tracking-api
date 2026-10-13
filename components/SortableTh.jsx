'use client';

/**
 * A <th> with an up/down arrow pair for sorting, shared across every table
 * in the app. Click cycles asc -> desc -> reset (back to the table's
 * default order) -> asc again. `sort` is { key, dir } state owned by the
 * page (dir: 'asc' | 'desc', key: null when reset); `onSort(key)` applies
 * the cycle for the clicked column.
 *
 * Multi-column mode: pass `sort` as an array of { key, dir } (priority
 * order) instead. `onSort(key, additive)` then gets `additive = true` on
 * shift+click, and each sorted header shows its priority number once more
 * than one column is sorted. Pair with `nextMultiSort`.
 */
export default function SortableTh({ sortKey, label, sort, onSort, className = '', align = 'left' }) {
    const multi = Array.isArray(sort);
    const idx = multi ? sort.findIndex((s) => s.key === sortKey) : -1;
    const active = multi ? idx !== -1 : sort.key === sortKey;
    const dir = multi ? sort[idx]?.dir : sort.dir;
    return (
        <th
            className={`cursor-pointer select-none px-4 py-3 font-medium hover:text-neutral-700 dark:hover:text-neutral-300 ${align === 'right' ? 'text-right' : ''} ${className}`}
            onClick={(e) => onSort(sortKey, e.shiftKey)}
            title={multi ? 'Click to sort · Shift+click to add as another sort level' : undefined}
        >
            <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                {label}
                <span className="flex flex-col leading-[7px]">
                    <span className={`text-[8px] ${active && dir === 'asc' ? 'text-[var(--accent)]' : 'text-neutral-300 dark:text-neutral-700'}`}>▲</span>
                    <span className={`text-[8px] ${active && dir === 'desc' ? 'text-[var(--accent)]' : 'text-neutral-300 dark:text-neutral-700'}`}>▼</span>
                </span>
                {multi && active && sort.length > 1 && (
                    <span className="text-[10px] font-semibold text-[var(--accent)]">{idx + 1}</span>
                )}
            </span>
        </th>
    );
}

/**
 * Multi-column counterpart of nextSort over an array of { key, dir }.
 * Plain click: sort by `key` alone (cycling asc -> desc -> reset if it was
 * already the only sort). Additive (shift) click: append `key` as the next
 * level, or cycle it in place asc -> desc -> removed, keeping other levels.
 */
export function nextMultiSort(sorts, key, additive) {
    const i = sorts.findIndex((s) => s.key === key);
    if (!additive) {
        if (sorts.length === 1 && i === 0) {
            const n = nextSort(sorts[0], key);
            return n.key ? [n] : [];
        }
        return [{ key, dir: 'asc' }];
    }
    if (i === -1) return [...sorts, { key, dir: 'asc' }];
    if (sorts[i].dir === 'asc') return sorts.map((s, j) => (j === i ? { key, dir: 'desc' } : s));
    return sorts.filter((_, j) => j !== i);
}

/** Compare two rows over a multi-sort chain; `val(row, key)` extracts the value. */
export function compareMulti(a, b, sorts, val) {
    for (const s of sorts) {
        const c = compareSortValues(val(a, s.key), val(b, s.key), s.dir);
        if (c) return c;
    }
    return 0;
}

/** Cycle a { key, dir } sort state through asc -> desc -> reset for `key`. */
export function nextSort(sort, key) {
    if (sort.key !== key) return { key, dir: 'asc' };
    if (sort.dir === 'asc') return { key, dir: 'desc' };
    return { key: null, dir: null };
}

/** Generic comparator: string/number-aware, nulls/undefined sort last regardless of direction. */
export function compareSortValues(av, bv, dir) {
    const aNil = av === null || av === undefined || av === '';
    const bNil = bv === null || bv === undefined || bv === '';
    if (aNil && bNil) return 0;
    if (aNil) return 1;
    if (bNil) return -1;
    let cmp;
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
}
