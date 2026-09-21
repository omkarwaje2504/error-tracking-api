// One-off migration: salesPerson/servicePerson on projects used to be a
// reference to a users._id (picked from a dropdown); they're now free-text
// fields. This converts existing ObjectId references into the referenced
// user's plain name string, so existing projects keep showing the right
// person after the dropdown is replaced with a text input.
// Run with: node scripts/migrate-sales-service-person.js
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

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

function isObjectIdLike(v) {
    return v instanceof ObjectId || (typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v));
}

async function main() {
    loadEnv();
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in .env');

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('task-tracker');
    const projects = db.collection('projects');
    const users = db.collection('users');

    const userNameById = new Map();
    for (const u of await users.find({}).project({ name: 1 }).toArray()) {
        userNameById.set(u._id.toString(), u.name);
    }

    const docs = await projects.find({
        $or: [
            { salesPerson: { $type: 'objectId' } },
            { servicePerson: { $type: 'objectId' } },
        ],
    }).toArray();

    let updated = 0;
    for (const p of docs) {
        const set = { updatedAt: new Date() };
        if (isObjectIdLike(p.salesPerson)) {
            set.salesPerson = userNameById.get(p.salesPerson.toString()) || '';
        }
        if (isObjectIdLike(p.servicePerson)) {
            set.servicePerson = userNameById.get(p.servicePerson.toString()) || '';
        }
        await projects.updateOne({ _id: p._id }, { $set: set });
        updated++;
        console.log(`"${p.name}": salesPerson -> "${set.salesPerson ?? p.salesPerson}", servicePerson -> "${set.servicePerson ?? p.servicePerson}"`);
    }

    console.log(`Done. ${updated} project(s) migrated.`);
    await client.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
