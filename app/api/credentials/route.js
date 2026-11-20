import { query, insertRow } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/crypto';
import { NextResponse } from 'next/server';

// The encrypted blob is fetched only to decrypt it — list responses carry
// the plaintext `password` so the page can show it directly (logged-in
// users only), never the blob itself.
const LIST_COLUMNS = `"_id", "service", "name", "username", "notes", "createdBy", "createdByName",
    "createdAt", "updatedAt", "lastAccessedByName", "lastAccessedAt",
    "billingStatus", "billingAmount", "nextPaymentDate", "cardLast4", "encryptedPassword"`;

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const creds = await query(`SELECT ${LIST_COLUMNS} FROM credentials WHERE NOT "deleted" ORDER BY "createdAt" DESC`);
    return NextResponse.json(creds.map(({ encryptedPassword, ...c }) => {
        let password = null; // null = couldn't decrypt (CREDENTIALS_SECRET changed)
        try { password = decrypt(encryptedPassword); } catch { /* leave null */ }
        return { ...c, password };
    }));
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const {
        service, name, username, password, notes,
        billingStatus, billingAmount, nextPaymentDate, cardLast4,
    } = await req.json();
    // `service` is the grouping key (e.g. "Adobe") — several accounts under
    // the same service show grouped together. `name` is just an optional
    // label to tell those accounts apart (e.g. "Design team").
    if (!service || !service.trim()) return NextResponse.json({ error: 'Service is required' }, { status: 400 });
    if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    if (cardLast4 && !/^\d{4}$/.test(cardLast4)) {
        return NextResponse.json({ error: 'Card last 4 digits must be exactly 4 digits' }, { status: 400 });
    }

    const now = new Date();
    const doc = await insertRow('credentials', {
        service: service.trim(),
        name: (name || '').trim(),
        username: username || '',
        notes: notes || '',
        encryptedPassword: encrypt(password),
        // Billing/subscription tracking — e.g. multiple Adobe seats, each
        // with its own renewal date and which card it's billed to.
        billingStatus: billingStatus === 'suspended' ? 'suspended' : 'active',
        billingAmount: billingAmount || '',
        nextPaymentDate: nextPaymentDate || null,
        cardLast4: cardLast4 || '',
        createdBy: session.id,
        createdByName: session.name,
        lastAccessedBy: null,
        lastAccessedByName: null,
        lastAccessedAt: null,
        accessLog: [],
        deleted: false,
        createdAt: now,
        updatedAt: now,
    });
    const { encryptedPassword, accessLog, ...safe } = doc;
    return NextResponse.json(safe);
}
