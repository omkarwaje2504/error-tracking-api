import { query, updateRow, findById, USER_COLUMNS } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function PUT(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  // Only head can change roles/teams or edit other people.
  const isSelf = session.id === id;
  const isHead = session.role === 'head';
  if (!isHead && !isSelf) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const set = { updatedAt: new Date() };
  if (body.name !== undefined) set.name = body.name;
  if (body.mobile !== undefined) set.mobile = body.mobile;
  if (body.email !== undefined) set.email = body.email;

  // role & team are head-only
  if (isHead) {
    if (body.role !== undefined) set.role = body.role;
    if (body.team !== undefined) set.team = body.team;
    if (body.restore === true) set.deleted = false;
  }

  // optional password reset (self, or head resetting someone)
  if (body.password) {
    set.password = await bcrypt.hash(body.password, 10);
  }

  await updateRow('users', id, set);
  const user = await findById('users', id, USER_COLUMNS);
  return NextResponse.json(user);
}

export async function DELETE(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  // deleting users is head-only
  if (session.role !== 'head') {
    return NextResponse.json({ error: 'Only head can remove users' }, { status: 403 });
  }
  // guard: don't let head delete themselves
  if (session.id === id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
  }

  const permanent = new URL(req.url).searchParams.get('permanent') === 'true';
  if (permanent) {
    await query(`DELETE FROM users WHERE "_id" = $1`, [id]);
    return NextResponse.json({ ok: true, permanent: true });
  }
  await updateRow('users', id, { deleted: true, updatedAt: new Date() });
  return NextResponse.json({ ok: true });
}
