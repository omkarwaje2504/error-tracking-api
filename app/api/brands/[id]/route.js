import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const { name, company } = await req.json();

    const set = { updatedAt: new Date() };
    if (name !== undefined) {
        if (!name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        set.name = name.trim();
    }
    if (company !== undefined) set.company = company ? oid(company) : null;

    const existing = await db.collection('brands').findOne({ _id: oid(id) });
    const companyId = company !== undefined ? (company ? oid(company) : null) : existing?.company;
    if (companyId) {
        const companyDoc = await db.collection('companies').findOne({ _id: companyId });
        const checkName = (set.name ?? existing?.name ?? '').trim().toLowerCase();
        if (companyDoc && checkName && companyDoc.name.trim().toLowerCase() === checkName) {
            return NextResponse.json({ error: 'A brand cannot have the same name as its company' }, { status: 400 });
        }
    }

    await db.collection('brands').updateOne({ _id: oid(id) }, { $set: set });
    const brand = await db.collection('brands').findOne({ _id: oid(id) });
    return NextResponse.json(brand);
}

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const permanent = new URL(req.url).searchParams.get('permanent') === 'true';

    if (permanent) {
        if (session.role !== 'head')
            return NextResponse.json({ error: 'Only head can permanently delete' }, { status: 403 });
        await db.collection('brands').deleteOne({ _id: oid(id) });
        return NextResponse.json({ ok: true, permanent: true });
    }
    await db.collection('brands').updateOne({ _id: oid(id) }, { $set: { deleted: true, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
}
