// One-off maintenance script: imports/updates the printer reference data.
// Run with: node scripts/import-printers.js
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

const PRINTERS = [
    { name: 'Photofine', email_id: 'photofine01@gmail.com', printerType: 'Camera print', pageColor: 'RGB', fileType: 'Image - JPG', fileSize: '8x12 / 6x8', pageType: 'Matt / Pearl Metallic' },
    { name: 'JK Pliezer', email_id: 'print@plezerlab.com', printerType: 'Camera print', pageColor: 'RGB', fileType: 'Image - JPG', fileSize: '8x12 / 6x8 / 12x16 / 12x17 / 12x18', pageType: 'Matt / Pearl Metallic' },
    { name: 'Sales Alpha', email_id: 'sales@alphadigitalprints.com', printerType: 'Digital Print', pageColor: 'CMYK', fileType: 'PDF (sigle pdf)', fileSize: '13x19', pageType: '210GSM / 170 GSM' },
    { name: 'Muketshwar', email_id: 'kewalprint@gmail.com', printerType: 'Digital Print', pageColor: 'CMYK', fileType: 'PDF', fileSize: '13x19 / 12x18', pageType: '210GSM / 170 GSM' },
    { name: 'Sales Alpha', email_id: 'sales@alphadigitalprints.com', printerType: 'UV Print (caricature)', pageColor: '', fileType: 'PDF', fileSize: '8x12 (4x6)', pageType: '' },
    { name: 'Arpit store', email_id: 'arpitstore@gmail.com', printerType: 'Digital Print', pageColor: 'CMYK', fileType: 'PDF', fileSize: '12x18', pageType: '210GSM / 170 GSM' },
    { name: 'Printopia', email_id: 'printopia.solution@gmail.com', printerType: '', pageColor: '', fileType: '', fileSize: '', pageType: '' },
    { name: 'Metro Digital', email_id: 'metrodigital159@gmail.com', printerType: 'Digital Print', pageColor: 'CMYK', fileType: 'PDF', fileSize: '13x19 / 12x18', pageType: '' },
];

async function main() {
    loadEnv();
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in .env');

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('task-tracker');
    const col = db.collection('printers');

    let created = 0;
    let updated = 0;
    const now = new Date();

    for (const p of PRINTERS) {
        // A printer can offer more than one printerType (e.g. "Sales Alpha" does
        // both Digital Print and UV Print), so the match key includes printerType.
        const filter = { name: p.name, email_id: p.email_id, printerType: p.printerType };
        const res = await col.updateOne(
            filter,
            {
                $set: { ...p, deleted: false, updatedAt: now },
                $setOnInsert: { createdAt: now },
            },
            { upsert: true },
        );
        if (res.upsertedCount > 0) created++;
        else if (res.modifiedCount > 0) updated++;
    }

    console.log(`Printers: ${created} created, ${updated} updated, ${PRINTERS.length - created - updated} unchanged.`);
    await client.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
