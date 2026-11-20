// Seeds/updates the printer reference data in Postgres. Safe to re-run.
//   node --env-file=.env.local scripts/import-printers.mjs
import pg from 'pg';

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

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
await client.connect();

let created = 0;
let updated = 0;
for (const p of PRINTERS) {
    // A printer can offer more than one printerType (e.g. "Sales Alpha" does
    // both Digital Print and UV Print), so the match key includes printerType.
    const { rowCount } = await client.query(
        `UPDATE printers SET "pageColor" = $4, "fileType" = $5, "fileSize" = $6, "pageType" = $7,
                "deleted" = false, "updatedAt" = now()
         WHERE "name" = $1 AND "email_id" = $2 AND "printerType" = $3`,
        [p.name, p.email_id, p.printerType, p.pageColor, p.fileType, p.fileSize, p.pageType]
    );
    if (rowCount) { updated++; continue; }
    await client.query(
        `INSERT INTO printers ("name", "email_id", "printerType", "pageColor", "fileType", "fileSize", "pageType")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.name, p.email_id, p.printerType, p.pageColor, p.fileType, p.fileSize, p.pageType]
    );
    created++;
}

console.log(`Printers: ${created} created, ${updated} updated.`);
await client.end();
