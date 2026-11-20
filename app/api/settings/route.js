import { query, queryOne } from '@/lib/db';
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

    const doc = await queryOne(`SELECT "value" FROM settings WHERE "key" = $1`, [keyFor(name, session)]);
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

    await query(
        `INSERT INTO settings ("key", "value", "updatedAt", "updatedBy") VALUES ($1, $2, now(), $3)
         ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now(), "updatedBy" = EXCLUDED."updatedBy"`,
        [keyFor(name, session), JSON.stringify(value ?? null), session.id]
    );
    return NextResponse.json({ name, value });
}
