/**
 * Delta-sync helper for simple reference-data endpoints (companies, brands,
 * product types, users). With no `since`, behaves like a normal list fetch
 * (excludes soft-deleted rows). With `since`, returns everything touched
 * after that timestamp — deletions included — so a client cache can both
 * pick up changes and prune records that got deleted.
 */
export function sinceMatch(sinceParam) {
    if (!sinceParam) return { deleted: { $ne: true } };
    const d = new Date(sinceParam);
    if (Number.isNaN(d.getTime())) return { deleted: { $ne: true } };
    return { updatedAt: { $gt: d } };
}
