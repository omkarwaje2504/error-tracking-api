import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

const MAX_LOG_ENTRIES = 20;

/**
 * Reveals one credential's real password — but only after the viewer
 * re-enters *their own* account login password (not the credential's).
 * This is a step-up re-auth check, same idea as GitHub's "sudo mode":
 * being logged in isn't enough on its own to read a shared secret.
 */
export async function POST(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const { password } = await req.json();
    if (!password) return NextResponse.json({ error: 'Enter your login password.' }, { status: 400 });

    const me = await db.collection('users').findOne({ _id: oid(session.id) });
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const match = await bcrypt.compare(password, me.password);
    if (!match) return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });

    const cred = await db.collection('credentials').findOne({ _id: oid(id), deleted: { $ne: true } });
    if (!cred) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let plaintext;
    try {
        plaintext = decrypt(cred.encryptedPassword);
    } catch {
        return NextResponse.json({ error: 'Could not decrypt this credential — CREDENTIALS_SECRET may have changed.' }, { status: 500 });
    }

    const now = new Date();
    const logEntry = { by: oid(session.id), byName: session.name, at: now };
    const accessLog = [...(cred.accessLog || []), logEntry].slice(-MAX_LOG_ENTRIES);
    await db.collection('credentials').updateOne({ _id: oid(id) }, {
        $set: { lastAccessedBy: oid(session.id), lastAccessedByName: session.name, lastAccessedAt: now, accessLog },
    });

    return NextResponse.json({ password: plaintext, username: cred.username });
}
