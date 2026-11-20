import pg from 'pg';
import { randomBytes } from 'crypto';
import { attachDatabasePool } from '@vercel/functions';

// Postgres (Neon) access for every API route. Tables/columns mirror the old
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

/** Every users column except the password hash. */
export const USER_COLUMNS = `"_id", "name", "email", "mobile", "role", "team", "deleted", "createdAt", "updatedAt"`;

/** Double-quote an identifier (columns are camelCase, so they must be quoted). */
export const col = (name) => `"${name.replace(/"/g, '""')}"`;

// Columns stored as JSONB, per table. pg would otherwise send a JS array as
// a Postgres array literal, so these get JSON.stringify'd on the way in.
const JSONB_COLUMNS = {
    projects: ['attachments', 'sections', 'kickoff'],
    tasks: ['revertNote', 'attachments', 'evideoRows'],
    discussions: ['attachments'],
    credentials: ['encryptedPassword', 'accessLog'],
    posts: ['attachments'],
    settings: ['value'],
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

/** UPDATE one row by "_id" with the keys of `set`; returns the updated row (or null if no such id). */
export async function updateRow(table, id, set) {
    const keys = Object.keys(set).filter((k) => set[k] !== undefined);
    if (!keys.length) return queryOne(`SELECT * FROM ${table} WHERE "_id" = $1`, [id]);
    const sql = `UPDATE ${table} SET ${keys.map((k, i) => `${col(k)} = $${i + 2}`).join(', ')}
                 WHERE "_id" = $1 RETURNING *`;
    return queryOne(sql, [id, ...keys.map((k) => toParam(table, k, set[k]))]);
}

/** SELECT one row by "_id". */
export function findById(table, id, columns = '*') {
    return queryOne(`SELECT ${columns} FROM ${table} WHERE "_id" = $1`, [id]);
}

/**
 * Tiny WHERE builder: `w.add('"status" = $?', value)` appends a condition,
 * numbering each `$?` placeholder in order. `w.sql` is '' or 'WHERE …'.
 */
export function where() {
    const conds = [];
    const params = [];
    return {
        params,
        add(cond, ...values) {
            const text = cond.replace(/\$\?/g, () => {
                params.push(values.shift());
                return `$${params.length}`;
            });
            conds.push(text);
            return this;
        },
        get sql() { return conds.length ? `WHERE ${conds.join(' AND ')}` : ''; },
        /** Next placeholder number, for clauses (LIMIT/OFFSET) appended after the WHERE. */
        next(value) { params.push(value); return `$${params.length}`; },
    };
}
