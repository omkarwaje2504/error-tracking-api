import { query, queryOne, updateRow, findById } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { name, company } = await req.json();

    const set = { updatedAt: new Date() };
    if (name !== undefined) {
        if (!name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        set.name = name.trim();
    }
    if (company !== undefined) set.company = company || null;

    const existing = await findById('brands', id);
    const companyId = company !== undefined ? (company || null) : existing?.company;
    if (companyId) {
        const companyDoc = await queryOne(`SELECT "name" FROM companies WHERE "_id" = $1`, [companyId]);
        const checkName = (set.name ?? existing?.name ?? '').trim().toLowerCase();
        if (companyDoc && checkName && companyDoc.name.trim().toLowerCase() === checkName) {
            return NextResponse.json({ error: 'A brand cannot have the same name as its company' }, { status: 400 });
        }
    }

    const brand = await updateRow('brands', id, set);
    return NextResponse.json(brand);
}

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const permanent = new URL(req.url).searchParams.get('permanent') === 'true';

    if (permanent) {
        if (session.role !== 'head')
            return NextResponse.json({ error: 'Only head can permanently delete' }, { status: 403 });
        await query(`DELETE FROM brands WHERE "_id" = $1`, [id]);
        return NextResponse.json({ ok: true, permanent: true });
    }
    await updateRow('brands', id, { deleted: true, updatedAt: new Date() });
    return NextResponse.json({ ok: true });
}
