// Creates/updates the Postgres schema (db/schema.sql). Safe to re-run.
//   node --env-file=.env.local scripts/db-setup.mjs
import pg from 'pg';
import { readFileSync } from 'fs';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL (or DATABASE_URL_UNPOOLED) first.');

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
const { rows } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1"
);
console.log('Schema ready:', rows.map((r) => r.table_name).join(', '));
await client.end();
