import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const existing = await db.collection('credentials').findOne({ _id: oid(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Anyone can add a shared credential; only whoever created it (or a
    // lead/head) can edit or remove it — same rule as project discussion
    // messages elsewhere in the app.
    const isOwner = existing.createdBy?.toString() === session.id;
    const isManager = session.role === 'lead' || session.role === 'head';
    if (!isOwner && !isManager) {
        return NextResponse.json({ error: 'Only whoever added this credential (or a lead) can edit it.' }, { status: 403 });
    }

    const {
        service, name, username, password, notes,
        billingStatus, billingAmount, nextPaymentDate, cardLast4,
    } = await req.json();
    if (service !== undefined && !service.trim()) return NextResponse.json({ error: 'Service is required' }, { status: 400 });
    if (cardLast4 && !/^\d{4}$/.test(cardLast4)) {
        return NextResponse.json({ error: 'Card last 4 digits must be exactly 4 digits' }, { status: 400 });
    }

    const set = { updatedAt: new Date() };
    if (service !== undefined) set.service = service.trim();
    if (name !== undefined) set.name = name.trim();
    if (username !== undefined) set.username = username;
    if (notes !== undefined) set.notes = notes;
    if (password) set.encryptedPassword = encrypt(password); // blank = keep existing password
    if (billingStatus !== undefined) set.billingStatus = billingStatus === 'suspended' ? 'suspended' : 'active';
    if (billingAmount !== undefined) set.billingAmount = billingAmount;
    if (nextPaymentDate !== undefined) set.nextPaymentDate = nextPaymentDate || null;
    if (cardLast4 !== undefined) set.cardLast4 = cardLast4;

    await db.collection('credentials').updateOne({ _id: oid(id) }, { $set: set });
    const { encryptedPassword, accessLog, ...safe } = await db.collection('credentials').findOne({ _id: oid(id) });
    return NextResponse.json(safe);
}

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const existing = await db.collection('credentials').findOne({ _id: oid(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isOwner = existing.createdBy?.toString() === session.id;
    const isManager = session.role === 'lead' || session.role === 'head';
    if (!isOwner && !isManager) {
        return NextResponse.json({ error: 'Only whoever added this credential (or a lead) can delete it.' }, { status: 403 });
    }

    await db.collection('credentials').updateOne({ _id: oid(id) }, { $set: { deleted: true, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
}
