import { connectDB } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(req) {
    const db = await connectDB();
    const { email, password } = await req.json();
    const user = await db.collection('users').findOne({ email, deleted: { $ne: true } });
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const token = signToken({ id: user._id.toString(), role: user.role, team: user.team, name: user.name });
    const res = NextResponse.json({ id: user._id, name: user.name, role: user.role });
    res.cookies.set('token', token, { httpOnly: true, path: '/', maxAge: 604800 });
    return res;
}