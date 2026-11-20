/**
 * Delta-sync helper for simple reference-data endpoints (companies, brands,
 * product types, users). With no `since`, behaves like a normal list fetch
 * (excludes soft-deleted rows). With `since`, returns everything touched
 * after that timestamp — deletions included — so a client cache can both
 * pick up changes and prune records that got deleted.
 *
 * Adds its condition to a `where()` builder from lib/db; `alias` prefixes
 * the columns when the query joins other tables.
 */
export function addSinceFilter(w, sinceParam, alias = '') {
    const p = alias ? `${alias}.` : '';
    const d = sinceParam ? new Date(sinceParam) : null;
    if (!d || Number.isNaN(d.getTime())) w.add(`NOT ${p}"deleted"`);
    else w.add(`${p}"updatedAt" > $?`, d);
    return w;
}
