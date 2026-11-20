import { query, updateRow } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { name } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const company = await updateRow('companies', id, { name: name.trim(), updatedAt: new Date() });
    return NextResponse.json(company);
}

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const permanent = new URL(req.url).searchParams.get('permanent') === 'true';

    if (permanent) {
        if (session.role !== 'head')
            return NextResponse.json({ error: 'Only head can permanently delete' }, { status: 403 });
        await query(`DELETE FROM companies WHERE "_id" = $1`, [id]);
        return NextResponse.json({ ok: true, permanent: true });
    }
    await updateRow('companies', id, { deleted: true, updatedAt: new Date() });
    return NextResponse.json({ ok: true });
}
