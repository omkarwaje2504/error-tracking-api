export const PRIORITY_META = {
    low: { label: 'Low', className: 'bg-neutral-500/15 text-neutral-500' },
    medium: { label: 'Medium', className: 'bg-blue-500/15 text-blue-500' },
    high: { label: 'High', className: 'bg-amber-500/15 text-amber-500' },
    urgent: { label: 'Urgent', className: 'bg-red-500/15 text-red-500' },
};

export const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

// Same underlying values as the `team` a user belongs to (see TEAMS in the
// users/team/reports pages) — a task's department is what links it back to
// a team's work queue, so the two stay in sync.
export const DEPARTMENTS = ['graphic', 'video', 'frontend', 'backend', 'app'];

const DEPARTMENT_LABELS = {
    graphic: 'Graphic Design',
    video: 'Video Design',
    frontend: 'Frontend',
    backend: 'Backend',
    app: 'App Development',
};

export function departmentLabel(d) {
    return DEPARTMENT_LABELS[d] || d || 'No department';
}

export function priorityMeta(p) {
    return PRIORITY_META[p] || PRIORITY_META.medium;
}

export function isOverdue(t) {
    return t.status !== 'completed' && !!t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString());
}

export function formatDate(d) {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Simple gamified score: base points per completed task + a bonus for how urgent it was.
const PRIORITY_POINT_BONUS = { low: 0, medium: 2, high: 5, urgent: 8 };

export function pointsFor(t) {
    return 10 + (PRIORITY_POINT_BONUS[t.priority] ?? 2);
}
