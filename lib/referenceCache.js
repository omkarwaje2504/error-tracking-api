'use client';
import { idbGetAll, idbPutAll, idbDeleteKeys, idbGetMeta, idbSetMeta } from './idb';

const ENDPOINTS = {
    companies: '/api/companies',
    brands: '/api/brands',
    productTypes: '/api/product-types',
    users: '/api/users',
};

// Small safety margin on the sync checkpoint so a record saved in the same
// tick as the previous sync's timestamp can't slip past a strict `$gt`.
const CLOCK_SKEW_BUFFER_MS = 5000;

// IndexedDB's getAll() comes back in primary-key (_id) order, not whatever
// order the API used to sort by — so every store gets a consistent,
// deterministic order here instead. All four reference stores have a name.
function sortByName(records) {
    return [...records].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * The current list for a reference-data store (companies, brands,
 * productTypes, users) — read from IndexedDB and kept fresh with a
 * `since=<lastSync>` delta fetch, so repeat calls across the app only
 * transfer what actually changed instead of the whole list every time.
 *
 * Falls back straight to a normal network fetch if IndexedDB isn't
 * available (private browsing, old browser) or the request fails and
 * nothing is cached yet — callers always get an array back.
 */
export async function getReference(storeName) {
    const endpoint = ENDPOINTS[storeName];
    if (!endpoint) throw new Error(`Unknown reference store: ${storeName}`);

    const metaKey = `${storeName}:lastSync`;
    const lastSync = await idbGetMeta(metaKey);
    const since = lastSync ? new Date(new Date(lastSync).getTime() - CLOCK_SKEW_BUFFER_MS).toISOString() : null;
    const url = since ? `${endpoint}?since=${encodeURIComponent(since)}` : endpoint;

    let delta;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('reference fetch failed');
        delta = await res.json();
    } catch {
        const cached = await idbGetAll(storeName);
        return sortByName(cached || []);
    }

    const syncedAt = new Date().toISOString();

    if (!since) {
        // First sync this browser has ever done for this store (or no IndexedDB) — delta *is* the full list.
        const live = delta.filter((r) => !r.deleted);
        await idbPutAll(storeName, live);
        await idbSetMeta(metaKey, syncedAt);
        return sortByName(live);
    }

    const toDelete = delta.filter((r) => r.deleted).map((r) => r._id);
    const toUpsert = delta.filter((r) => !r.deleted);
    if (toDelete.length) await idbDeleteKeys(storeName, toDelete);
    if (toUpsert.length) await idbPutAll(storeName, toUpsert);
    await idbSetMeta(metaKey, syncedAt);

    const all = await idbGetAll(storeName);
    return sortByName(all && all.length ? all : toUpsert);
}

/** Force the next getReference() call for this store to do a full re-sync. */
export async function invalidateReference(storeName) {
    await idbSetMeta(`${storeName}:lastSync`, null);
}
