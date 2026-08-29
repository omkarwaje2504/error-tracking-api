import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';
import { NextResponse } from 'next/server';

// Never project the encrypted password blob into list responses — reveal
// is the only endpoint allowed to touch it, and only after the viewer
// re-enters their own login password.
const LIST_FIELDS = {
    service: 1, name: 1, username: 1, notes: 1, createdBy: 1, createdByName: 1,
    createdAt: 1, updatedAt: 1, lastAccessedByName: 1, lastAccessedAt: 1,
};

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const creds = await db.collection('credentials')
        .find({ deleted: { $ne: true } }, { projection: LIST_FIELDS })
        .sort({ service: 1, name: 1 })
        .toArray();
    return NextResponse.json(creds);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { service, name, username, password, notes } = await req.json();
    // `service` is the grouping key (e.g. "Adobe") — several accounts under
    // the same service show grouped together. `name` is just an optional
    // label to tell those accounts apart (e.g. "Design team").
    if (!service || !service.trim()) return NextResponse.json({ error: 'Service is required' }, { status: 400 });
    if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 });

    const now = new Date();
    const doc = {
        service: service.trim(),
        name: (name || '').trim(),
        username: username || '',
        notes: notes || '',
        encryptedPassword: encrypt(password),
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
