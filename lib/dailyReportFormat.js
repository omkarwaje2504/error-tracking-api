import { formatDate } from '@/lib/taskDisplay';

// "Task name (Subtask ✓, Subtask; 12 completed, 1 declined)" — subtasks and
// today's quantity update both ride in the same bracket, semicolon-separated
// when a task has both.
export function formatTaskLine(t) {
    const parts = [];
    if (t.subtasks?.length) {
        parts.push(t.subtasks.map((s) => (s.done ? `${s.title} ✓` : s.title)).join(', '));
    }
    if (t.progress) {
        const p = [];
        if (t.progress.added) p.push(`+${t.progress.added} added`);
        if (t.progress.completed) p.push(`${t.progress.completed} completed`);
        if (t.progress.declined) p.push(`${t.progress.declined} declined`);
        if (p.length) parts.push(p.join(', '));
    }
    const bracket = parts.length ? ` (${parts.join('; ')})` : '';
    const project = t.project?.name ? ` [${t.project.name}]` : '';
    return `${t.title}${bracket}${project}`;
}

export function buildReportText(name, date, completedToday, pending) {
    const niceDate = new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const lines = [];
    lines.push(`Daily Update — ${name} — ${niceDate}`);
    lines.push('');

    lines.push(`✅ Completed today (${completedToday.length})`);
    if (completedToday.length === 0) {
        lines.push('- Nothing marked complete yet.');
    } else {
        completedToday.forEach((t) => lines.push(`- ${formatTaskLine(t)}`));
    }
    lines.push('');

    lines.push(`🔄 In progress (${pending.length})`);
    if (pending.length === 0) {
        lines.push('- Nothing else pending — all caught up.');
    } else {
        pending.forEach((t) => {
            const due = t.dueDate ? ` — due ${formatDate(t.dueDate)}` : '';
            lines.push(`- ${formatTaskLine(t)}${due}`);
        });
    }
    lines.push('');
    lines.push('Thanks!');

    return lines.join('\n');
}
