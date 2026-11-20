import pg from 'pg';
import { randomBytes } from 'crypto';
import { attachDatabasePool } from '@vercel/functions';

// Postgres (Neon) access for the API routes. Tables/columns mirror the old
// Mongo documents one-to-one (see db/schema.sql), so rows come back in the
// same shape the pages already expect: "_id", camelCase fields, Dates for
// timestamps, parsed objects for JSONB.

if (!process.env.DATABASE_URL) {
    throw new Error('Invalid/Missing environment variable: "DATABASE_URL"');
}

function makePool() {
    return new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
}

// Reuse one pool across HMR reloads in dev.
const globalForPg = globalThis;
const pool = process.env.NODE_ENV === 'development'
    ? (globalForPg._pgPool ??= makePool())
    : makePool();

attachDatabasePool(pool);

export default pool;

/** Run a query, return all rows. */
export async function query(text, params = []) {
    const { rows } = await pool.query(text, params);
    return rows;
}

/** Run a query, return the first row or null. */
export async function queryOne(text, params = []) {
    const { rows } = await pool.query(text, params);
    return rows[0] ?? null;
}

/** A fresh id in the same 24-char hex format as the old Mongo ObjectIds. */
export function newId() {
    return randomBytes(12).toString('hex');
}

/** True for strings that look like one of our ids. */
export function isId(value) {
    return typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value);
}

/** Double-quote an identifier (columns are camelCase, so they must be quoted). */
export const col = (name) => `"${name.replace(/"/g, '""')}"`;

// Columns stored as JSONB, per table. pg would otherwise send a JS array as
// a Postgres array literal, so these get JSON.stringify'd on the way in.
const JSONB_COLUMNS = {
    error_logs: ['error', 'mappedStack', 'deviceInfo', 'locationInfo', 'geo'],
};

function toParam(table, key, value) {
    if (value === undefined) return null;
    if (JSONB_COLUMNS[table]?.includes(key)) return value === null ? null : JSON.stringify(value);
    return value;
}

/** INSERT one row from a plain object (an "_id" is generated if missing); returns the stored row. */
export async function insertRow(table, doc) {
    const row = { _id: doc._id || newId(), ...doc };
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    const sql = `INSERT INTO ${table} (${keys.map(col).join(', ')})
                 VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})
                 RETURNING *`;
    return queryOne(sql, keys.map((k) => toParam(table, k, row[k])));
}
