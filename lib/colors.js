// A small rotating palette used to give otherwise-identical cards (companies,
// brands, product types) some visual distinction. Deterministic per name, so
// the same company always gets the same color.
export const PALETTE = [
    { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-300', bar: 'bg-indigo-500' },
    { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-300', bar: 'bg-violet-500' },
    { bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-300', bar: 'bg-pink-500' },
    { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-300', bar: 'bg-rose-500' },
    { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-300', bar: 'bg-amber-500' },
    { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-300', bar: 'bg-emerald-500' },
    { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-300', bar: 'bg-cyan-500' },
    { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-300', bar: 'bg-blue-500' },
];

export function colorFor(seed = '') {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return PALETTE[hash % PALETTE.length];
}
