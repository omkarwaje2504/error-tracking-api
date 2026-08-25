'use client';

// Minimal promise wrapper around IndexedDB — just enough for a keyed
// object store per reference-data type plus a small `_meta` store for
// sync checkpoints. No external dependency; the surface we need is tiny.

const DB_NAME = 'ione-cache';
const DB_VERSION = 1;
const STORES = ['companies', 'brands', 'productTypes', 'users', '_meta'];

let dbPromise = null;

function openDB() {
    if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            for (const store of STORES) {
                if (!db.objectStoreNames.contains(store)) {
                    db.createObjectStore(store, { keyPath: store === '_meta' ? 'key' : '_id' });
                }
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null); // no IndexedDB support / blocked (private mode etc.) — caller falls back to network
    });
    return dbPromise;
}

async function withStore(storeName, mode, fn) {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = fn(store);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
    });
}

export async function idbGetAll(storeName) {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(null);
    });
}

export async function idbPutAll(storeName, records) {
    await withStore(storeName, 'readwrite', (store) => {
        for (const r of records) store.put(r);
    });
}

export async function idbDeleteKeys(storeName, keys) {
    await withStore(storeName, 'readwrite', (store) => {
        for (const k of keys) store.delete(k);
    });
}

export async function idbGetMeta(key) {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
        const tx = db.transaction('_meta', 'readonly');
        const req = tx.objectStore('_meta').get(key);
        req.onsuccess = () => resolve(req.result?.value ?? null);
        req.onerror = () => resolve(null);
    });
}

export async function idbSetMeta(key, value) {
    await withStore('_meta', 'readwrite', (store) => {
        store.put({ key, value });
    });
}

export async function idbClearAll() {
    const db = await openDB();
    if (!db) return;
    for (const store of STORES) {
        await withStore(store, 'readwrite', (s) => s.clear());
    }
}
