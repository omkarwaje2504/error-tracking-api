// One-off maintenance script: merges printer records that share the same
// email and don't represent genuinely different printer types (a group is
// only merged when at most one distinct non-blank printerType is present in
// it — e.g. a sparse legacy row + a fuller row for the same physical
// printer). Groups with multiple distinct non-blank printerTypes for the
// same email (e.g. a shop that does both Digital Print and UV Print) are
// left alone since those are intentionally separate entries.
// Run with: node scripts/merge-duplicate-printers.js
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

const MERGEABLE_FIELDS = ['name', 'printerType', 'pageColor', 'fileType', 'fileSize', 'pageType'];

async function main() {
    loadEnv();
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in .env');

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('task-tracker');
    const col = db.collection('printers');

    const docs = await col.find({ deleted: { $ne: true } }).toArray();

    const byEmail = {};
    for (const d of docs) {
        const key = (d.email_id || '').trim().toLowerCase();
        if (!key) continue;
        (byEmail[key] = byEmail[key] || []).push(d);
    }

    let mergedGroups = 0;
    let removed = 0;

    for (const [email, group] of Object.entries(byEmail)) {
        if (group.length < 2) continue;

        const distinctTypes = new Set(
            group.map((d) => (d.printerType || '').trim()).filter(Boolean),
        );
        if (distinctTypes.size > 1) {
            console.log(`Skipping "${email}" — ${distinctTypes.size} distinct printer types, likely intentional (${[...distinctTypes].join(', ')}).`);
            continue;
        }

        group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const canonical = group[0];
        const rest = group.slice(1);

        const set = { updatedAt: new Date() };
        for (const field of MERGEABLE_FIELDS) {
            if (field === 'name') continue; // keep the canonical (oldest) name
            if (!canonical[field] || !canonical[field].trim()) {
                const filled = rest.find((d) => d[field] && d[field].trim());
                if (filled) set[field] = filled[field];
            }
        }

        await col.updateOne({ _id: canonical._id }, { $set: set });
        await col.updateMany(
            { _id: { $in: rest.map((d) => d._id) } },
            { $set: { deleted: true, mergedInto: canonical._id, updatedAt: new Date() } },
        );

        mergedGroups++;
        removed += rest.length;
        console.log(`Merged ${group.length} record(s) for "${email}" into "${canonical.name}" (${canonical._id}).`);
    }

    console.log(`Done. ${mergedGroups} group(s) merged, ${removed} duplicate record(s) soft-deleted.`);
    await client.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
