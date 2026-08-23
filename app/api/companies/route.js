import { connectDB } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const companies = await db.collection('companies')
        .find({ deleted: { $ne: true } }).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(companies);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { name } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const doc = { name: name.trim(), deleted: false, createdAt: new Date() };
    const { insertedId } = await db.collection('companies').insertOne(doc);
    return NextResponse.json({ _id: insertedId, ...doc });
}
