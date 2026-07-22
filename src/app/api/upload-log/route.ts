import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifySessionToken } from '../../../lib/session';

export async function POST(request: NextRequest) {
  const session = request.cookies.get('plop_session');
  if (!verifySessionToken(session?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { linkId, fileName, fileSize, mimeType } = body;

  if (!linkId || !fileName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  await prisma.upload.create({
    data: { linkId, fileName, fileSize: fileSize || 0, mimeType: mimeType || 'application/octet-stream' },
  });

  return NextResponse.json({ logged: true });
}
