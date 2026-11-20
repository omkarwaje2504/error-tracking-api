// One-time copy of the old MongoDB data into Postgres.
//
//   MONGODB_URI="mongodb+srv://…" node --env-file=.env.local scripts/import-from-mongo.mjs
//
// Copies every collection into its table (see MAP below). Ids keep their
// 24-char hex value, so links and references carry over unchanged. Fields
// with no matching column are dropped; ObjectIds anywhere (including inside
// JSON like attachments/sections) become plain hex strings. Rows whose "_id"
// already exists are skipped, so it's safe to re-run.
import pg from 'pg';
import { MongoClient, ObjectId } from 'mongodb';

const MAP = [
    ['task-tracker', 'users', 'users'],
    ['task-tracker', 'companies', 'companies'],
    ['task-tracker', 'brands', 'brands'],
    ['task-tracker', 'productTypes', 'product_types'],
    ['task-tracker', 'printers', 'printers'],
    ['task-tracker', 'projects', 'projects'],
    ['task-tracker', 'tasks', 'tasks'],
    ['task-tracker', 'progress', 'progress'],
    ['task-tracker', 'discussions', 'discussions'],
    ['task-tracker', 'credentials', 'credentials'],
    ['task-tracker', 'posts', 'posts'],
    ['task-tracker', 'settings', 'settings'],
    ['task-tracker', 'activity', 'activity'],
    ['errors', 'pixpro', 'error_logs'],
    ['apicalls', 'analysis', 'api_calls'],
];

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI to the old MongoDB connection string.');

/** ObjectIds -> hex strings, recursively; Dates and primitives left alone. */
function plain(value) {
    if (value instanceof ObjectId) return value.toHexString();
    if (value instanceof Date || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(plain);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
}

function toColumn(value, type) {
    if (value === undefined) return null;
    const v = plain(value);
    if (type === 'jsonb') return v === null ? null : JSON.stringify(v);
    if (type === 'ARRAY') return Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)];
    if (type === 'boolean') return v == null ? null : !!v;
    if (type === 'integer' || type === 'double precision') return v == null || v === '' ? null : Number(v) || 0;
    if (type.startsWith('timestamp')) return v == null || v === '' ? null : new Date(v);
    if (type === 'text') {
        if (v == null) return null;
        if (v instanceof Date) return v.toISOString().slice(0, 10); // e.g. a deadline stored as a Date
        return typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    return v;
}

const mongo = new MongoClient(process.env.MONGODB_URI);
await mongo.connect();
const pgc = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
await pgc.connect();

for (const [dbName, collName, table] of MAP) {
    const { rows: cols } = await pgc.query(
        `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table]
    );
    const types = Object.fromEntries(cols.map((c) => [c.column_name, c.data_type]));
    const key = table === 'settings' ? 'key' : '_id';
    let copied = 0;
    let skipped = 0;

    for await (const doc of mongo.db(dbName).collection(collName).find()) {
        const row = {};
        for (const [name, type] of Object.entries(types)) {
            if (doc[name] === undefined) continue; // let the column default apply
            const value = toColumn(doc[name], type);
            // NOT NULL columns (deleted, pinned, attachments, …) fall back to their default.
            if (value === null && cols.find((c) => c.column_name === name).is_nullable === 'NO') continue;
            row[name] = value;
        }
        const names = Object.keys(row);
        const res = await pgc.query(
            `INSERT INTO ${table} (${names.map((n) => `"${n}"`).join(', ')})
             VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')})
             ON CONFLICT ("${key}") DO NOTHING`,
            names.map((n) => row[n])
        );
        if (res.rowCount) copied++; else skipped++;
    }
    console.log(`${dbName}.${collName} -> ${table}: ${copied} copied, ${skipped} already there`);
}

await mongo.close();
await pgc.end();
