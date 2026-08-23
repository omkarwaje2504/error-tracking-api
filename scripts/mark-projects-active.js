// One-off maintenance script: sets status = 'active' on every non-deleted project.
// Run with: node scripts/mark-projects-active.js
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
    }
}

async function main() {
    loadEnv();
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in .env');

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('task-tracker');

    const result = await db.collection('projects').updateMany(
        { deleted: { $ne: true } },
        { $set: { status: 'active', updatedAt: new Date() } }
    );

    console.log(`Matched ${result.matchedCount} project(s), updated ${result.modifiedCount}.`);
    await client.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
