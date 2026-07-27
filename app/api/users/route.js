import { connectDB } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const users = await db.collection('users')
        .find({ deleted: { $ne: true } })
        .project({ name: 1, email: 1, mobile: 1, role: 1, team: 1 })
        .toArray();
    return NextResponse.json(users);
}