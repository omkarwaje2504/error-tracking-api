'use client';

/**
 * A <th> with an up/down arrow pair for sorting, shared across every table
 * in the app. Click cycles asc -> desc -> reset (back to the table's
 * default order) -> asc again. `sort` is { key, dir } state owned by the
 * page (dir: 'asc' | 'desc', key: null when reset); `onSort(key)` applies
 * the cycle for the clicked column.
 */
export default function SortableTh({ sortKey, label, sort, onSort, className = '', align = 'left' }) {
    const active = sort.key === sortKey;
    return (
        <th
            className={`cursor-pointer select-none px-4 py-3 font-medium hover:text-neutral-700 dark:hover:text-neutral-300 ${align === 'right' ? 'text-right' : ''} ${className}`}
            onClick={() => onSort(sortKey)}
        >
            <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                {label}
                <span className="flex flex-col leading-[7px]">
                    <span className={`text-[8px] ${active && sort.dir === 'asc' ? 'text-[var(--accent)]' : 'text-neutral-300 dark:text-neutral-700'}`}>▲</span>
                    <span className={`text-[8px] ${active && sort.dir === 'desc' ? 'text-[var(--accent)]' : 'text-neutral-300 dark:text-neutral-700'}`}>▼</span>
                </span>
            </span>
        </th>
    );
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
