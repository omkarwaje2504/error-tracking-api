// Daily social/marketing posts — a standalone system (own collection, own
// page), deliberately kept out of tasks and projects. Each post is one
// day's piece of content plus its attachments, which double as the
// company's asset library (see the Assets view on /posts).

export const POST_STATUSES = ['pending', 'posted'];

export const POST_STATUS_META = {
    pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-500' },
    posted: { label: 'Posted', className: 'bg-green-500/15 text-green-500' },
};

/** Local-time YYYY-MM-DD — postDate is stored as this plain string so day grouping never shifts with timezones. */
export function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
