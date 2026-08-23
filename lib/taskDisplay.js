export const PRIORITY_META = {
    low: { label: 'Low', className: 'bg-neutral-500/15 text-neutral-500' },
    medium: { label: 'Medium', className: 'bg-blue-500/15 text-blue-500' },
    high: { label: 'High', className: 'bg-amber-500/15 text-amber-500' },
    urgent: { label: 'Urgent', className: 'bg-red-500/15 text-red-500' },
};

export const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

export function priorityMeta(p) {
    return PRIORITY_META[p] || PRIORITY_META.medium;
}

export function isOverdue(t) {
    return t.status !== 'completed' && !!t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString());
}

export function formatDate(d) {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
