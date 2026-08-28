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

// Team members mark their own work 'done'; only a lead/head promotes that
// to 'completed' (or sends it back to 'pending', optionally with a note —
// see task.revertNote). Subtasks skip this and stay pending/completed.
export const STATUS_META = {
    pending: { label: 'Pending', className: 'bg-neutral-500/15 text-neutral-500' },
    done: { label: 'Done', className: 'bg-amber-500/15 text-amber-500' },
    completed: { label: 'Completed', className: 'bg-green-500/15 text-green-400' },
};

export function statusMeta(s) {
    return STATUS_META[s] || STATUS_META.pending;
}

export function canManageTasks(user) {
    return user?.role === 'lead' || user?.role === 'head';
}

export function isOverdue(t) {
    // 'done' means the work itself is finished (just awaiting lead review),
    // so it shouldn't read as overdue any more than 'completed' does.
    return t.status !== 'completed' && t.status !== 'done' && !!t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString());
}

export function formatDate(d) {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Simple gamified score: base points per completed task + a bonus for how urgent it was.
const PRIORITY_POINT_BONUS = { low: 0, medium: 2, high: 5, urgent: 8 };

export function pointsFor(t) {
    return 10 + (PRIORITY_POINT_BONUS[t.priority] ?? 2);
}
