import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const { name, email_id, printer_type, page_color, file_type, page_type, file_sizes } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email_id || !email_id.trim()) {
        return NextResponse.json({ error: 'Email Id is required' }, { status: 400 });
    }
    await db.collection('printers').updateOne({ _id: oid(id) }, {
        $set: {
            name: name.trim(), email_id: email_id.trim(),
            printer_type: (printer_type || '').trim(),
            page_color: (page_color || '').trim(),
            file_type: (file_type || '').trim(),
            page_type: (page_type || '').trim(),
            file_sizes: Array.isArray(file_sizes) ? file_sizes.map((s) => String(s).trim()).filter(Boolean) : [],
            updatedAt: new Date(),
        },
    });
    const doc = await db.collection('printers').findOne({ _id: oid(id) });
    return NextResponse.json(doc);
}

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    await db.collection('printers').updateOne({ _id: oid(id) }, { $set: { deleted: true, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
}
