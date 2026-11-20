import { updateRow } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { name, email_id, printerType, pageColor, fileType, fileSize, pageType } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email_id || !email_id.trim()) {
        return NextResponse.json({ error: 'Email Id is required' }, { status: 400 });
    }
    const doc = await updateRow('printers', id, {
        name: name.trim(),
        email_id: email_id.trim(),
        printerType: printerType?.trim() || '',
        pageColor: pageColor?.trim() || '',
        fileType: fileType?.trim() || '',
        fileSize: fileSize?.trim() || '',
        pageType: pageType?.trim() || '',
        updatedAt: new Date(),
    });
    return NextResponse.json(doc);
}

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await updateRow('printers', id, { deleted: true, updatedAt: new Date() });
    return NextResponse.json({ ok: true });
}
