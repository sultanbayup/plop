import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifySessionToken } from '../../../lib/session';
import { createDriveFolder } from '../../../lib/google';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  const session = request.cookies.get('plop_session');
  if (!verifySessionToken(session?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const links = await prisma.uploadLink.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      label: true,
      enabled: true,
      createdAt: true,
      _count: { select: { uploads: true } },
    },
  });

  return NextResponse.json(links);
}

export async function POST(request: NextRequest) {
  const session = request.cookies.get('plop_session');
  if (!verifySessionToken(session?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findFirst();
  if (!user) {
    return NextResponse.json({ error: 'No user configured' }, { status: 400 });
  }

  const body = await request.json();
  const { label, password } = body;

  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    return NextResponse.json({ error: 'Label is required' }, { status: 400 });
  }

  const folderId = await createDriveFolder(`Plop - ${label.trim()}`);
  const slug = uuidv4();
  const passwordHash = password
    ? await bcrypt.hash(password, 12)
    : null;

  const link = await prisma.uploadLink.create({
    data: {
      userId: user.id,
      slug,
      label: label.trim(),
      passwordHash,
      targetFolderId: folderId,
    },
    select: {
      id: true,
      slug: true,
      label: true,
      enabled: true,
      createdAt: true,
    },
  });

  return NextResponse.json(link, { status: 201 });
}
