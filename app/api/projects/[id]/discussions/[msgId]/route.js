import { findById, updateRow } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { msgId } = await params;

    const msg = await findById('discussions', msgId);
    if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const canDelete = msg.user === session.id || session.role === 'lead' || session.role === 'head';
    if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await updateRow('discussions', msgId, { deleted: true });
    return NextResponse.json({ ok: true });
}
