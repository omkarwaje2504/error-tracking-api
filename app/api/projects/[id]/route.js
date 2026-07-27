import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const { name, description } = await req.json();
    await db.collection('projects').updateOne({ _id: oid(id) }, { $set: { name, description } });
    const project = await db.collection('projects').findOne({ _id: oid(id) });
    return NextResponse.json(project);
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
        await db.collection('projects').deleteOne({ _id: oid(id) });
        return NextResponse.json({ ok: true, permanent: true });
    }
    await db.collection('projects').updateOne({ _id: oid(id) }, { $set: { deleted: true } });
    return NextResponse.json({ ok: true });
}