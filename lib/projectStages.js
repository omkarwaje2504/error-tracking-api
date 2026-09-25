// A project's current stage — a single quick-glance/quick-edit field shown
// right in the Projects table, separate from the detail page's multi-section
// journey (which can have several kickoff/design/development/production
// sections at once). This is just "where is it right now, broadly".
export const PROJECT_STAGES = ['link-creation', 'design', 'development', 'production'];

const PROJECT_STAGE_LABELS = {
    'link-creation': 'Link Creation',
    design: 'Design',
    development: 'Development',
    production: 'Production',
};

export function projectStageLabel(stage) {
    return PROJECT_STAGE_LABELS[stage] || '';
}

// Color per stage — same idea as the priority/status pills elsewhere, just
// a fixed map instead of colorFor() since there are only four values and
// a stable order (roughly the order work moves through them) reads better
// than hash-based coloring.
const PROJECT_STAGE_CLASSNAMES = {
    'link-creation': 'bg-neutral-500/15 text-neutral-500',
    design: 'bg-purple-500/15 text-purple-500',
    development: 'bg-blue-500/15 text-blue-500',
    production: 'bg-amber-500/15 text-amber-500',
};

export function projectStageClassName(stage) {
    return PROJECT_STAGE_CLASSNAMES[stage] || 'bg-neutral-500/10 text-neutral-400';
}
