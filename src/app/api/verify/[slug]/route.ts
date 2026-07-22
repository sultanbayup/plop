import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { rateLimit } from '../../../../lib/rate-limit';
import { getAccessToken } from '../../../../lib/google';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limit = rateLimit(request);
  if (limit) return limit;

  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  const { password } = body;

  const link = await prisma.uploadLink.findUnique({
    where: { slug, enabled: true },
  });

  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
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

  const accessToken = await getAccessToken();

  return NextResponse.json({
    folderId: link.targetFolderId,
    accessToken,
    linkId: link.id,
  });
}
