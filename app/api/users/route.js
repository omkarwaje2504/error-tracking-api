import { connectDB } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await connectDB();

  // head can optionally see soft-deleted users to restore them
  const includeDeleted = new URL(req.url).searchParams.get('includeDeleted') === 'true'
    && session.role === 'head';

  const filter = includeDeleted ? {} : { deleted: { $ne: true } };
  const users = await db.collection('users')
    .find(filter)
    .project({ password: 0 })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(users);
}