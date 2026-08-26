import { connectDB } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Small shared key/value store for cross-page, cross-user preferences
 * (currently: hidden product types, the "show only this type" filter).
 *
 * Role determines *whose* value a request reads/writes, not just whether
 * it's allowed:
 *  - lead:        the one shared team-wide value — their edits are what
 *                  every team-member sees.
 *  - head:        their own private value — edits only affect their own
 *                  view, never the team's.
 *  - team-member: reads the team-wide (lead-set) value; can't write at all.
 *
 * This mapping happens here, server-side, so it can't be spoofed from the
 * client by passing a different key.
 */
function keyFor(name, session) {
    return session.role === 'head' ? `${name}:user:${session.id}` : `${name}:team`;
}

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const name = new URL(req.url).searchParams.get('name');
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const db = await connectDB();
    const doc = await db.collection('settings').findOne({ key: keyFor(name, session) });
    return NextResponse.json({ name, value: doc?.value ?? null });
}

export async function PUT(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['lead', 'head'].includes(session.role)) {
        return NextResponse.json({ error: 'Only leads and heads can change this.' }, { status: 403 });
    }
    const { name, value } = await req.json();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const db = await connectDB();
    const key = keyFor(name, session);
    await db.collection('settings').updateOne(
        { key },
        { $set: { key, value, updatedAt: new Date(), updatedBy: session.id } },
        { upsert: true }
    );
    return NextResponse.json({ name, value });
}
