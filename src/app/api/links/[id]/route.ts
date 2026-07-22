import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { verifySessionToken } from '../../../../lib/session';
import bcrypt from 'bcryptjs';
import { rateLimit } from '../../../../lib/rate-limit';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = request.cookies.get('plop_session');
  if (!verifySessionToken(session?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await prisma.uploadLink.update({
    where: { id },
    data: { enabled: false },
  });

  return NextResponse.json({ success: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limit = rateLimit(request);
  if (limit) return limit;

  const { password } = await request.json().catch(() => ({ password: '' }));

  const { id } = await params;
  const link = await prisma.uploadLink.findUnique({
    where: { id, enabled: true },
    include: { user: true },
  });

  if (!link) {
    return NextResponse.json({ error: 'Link not found or disabled' }, { status: 404 });
  }

  if (link.passwordHash) {
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password required' }, { status: 401 });
    }
    const valid = await bcrypt.compare(password, link.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }
  }

  const { getAccessToken } = await import('../../../../lib/google');
  const accessToken = await getAccessToken();

  return NextResponse.json({
    folderId: link.targetFolderId,
    accessToken,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = request.cookies.get('plop_session');
  if (!verifySessionToken(session?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const uploads = await prisma.upload.findMany({
    where: { linkId: id },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      uploadedAt: true,
    },
    take: 100,
  });

  return NextResponse.json(uploads);
}
