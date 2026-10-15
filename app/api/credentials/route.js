import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/crypto';
import { NextResponse } from 'next/server';

// The encrypted blob is fetched only to decrypt it — list responses carry
// the plaintext `password` so the page can show it directly (logged-in
// users only), never the blob itself.
const LIST_FIELDS = {
    service: 1, name: 1, username: 1, notes: 1, createdBy: 1, createdByName: 1,
    createdAt: 1, updatedAt: 1, lastAccessedByName: 1, lastAccessedAt: 1,
    billingStatus: 1, billingAmount: 1, nextPaymentDate: 1, cardLast4: 1,
    encryptedPassword: 1,
};

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const creds = await db.collection('credentials')
        .find({ deleted: { $ne: true } }, { projection: LIST_FIELDS })
        .sort({ createdAt: -1 })
        .toArray();
    return NextResponse.json(creds.map(({ encryptedPassword, ...c }) => {
        let password = null; // null = couldn't decrypt (CREDENTIALS_SECRET changed)
        try { password = decrypt(encryptedPassword); } catch { /* leave null */ }
        return { ...c, password };
    }));
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
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
    const doc = {
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
        createdBy: oid(session.id),
        createdByName: session.name,
        lastAccessedBy: null,
        lastAccessedByName: null,
        lastAccessedAt: null,
        accessLog: [],
        deleted: false,
        createdAt: now,
        updatedAt: now,
    };
    const { insertedId } = await db.collection('credentials').insertOne(doc);
    const { encryptedPassword, accessLog, ...safe } = doc;
    return NextResponse.json({ _id: insertedId, ...safe });
}
