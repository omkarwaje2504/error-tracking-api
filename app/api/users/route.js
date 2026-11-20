import { query, where, USER_COLUMNS } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { addSinceFilter } from '@/lib/sinceQuery';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const since = params.get('since');

  // head can optionally see soft-deleted users to restore them
  const includeDeleted = params.get('includeDeleted') === 'true' && session.role === 'head';

  const w = where();
  if (since) addSinceFilter(w, since);
  else if (!includeDeleted) w.add('NOT "deleted"');
  const users = await query(`SELECT ${USER_COLUMNS} FROM users ${w.sql} ORDER BY "createdAt" DESC`, w.params);

  return NextResponse.json(users);
}
