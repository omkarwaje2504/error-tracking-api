import { connectDB } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(req) {
    const db = await connectDB();
    const { name, email, mobile, password, role, team } = await req.json();
    const exists = await db.collection('users').findOne({ email });
    if (exists) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    const hashed = await bcrypt.hash(password, 10);
    const { insertedId } = await db.collection('users').insertOne({
        name, email, mobile, password: hashed, role, team, deleted: false, createdAt: new Date(),
    });
    return NextResponse.json({ id: insertedId, name });
}