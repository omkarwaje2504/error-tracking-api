import { queryOne, insertRow } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(req) {
    const { name, email, mobile, password, role, team } = await req.json();
    const exists = await queryOne(`SELECT "_id" FROM users WHERE "email" = $1 LIMIT 1`, [email]);
    if (exists) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    const hashed = await bcrypt.hash(password, 10);
    const now = new Date();
    const user = await insertRow('users', {
        name, email, mobile, password: hashed, role, team, deleted: false, createdAt: now, updatedAt: now,
    });
    return NextResponse.json({ id: user._id, name });
}
