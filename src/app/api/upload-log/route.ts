import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { linkId, fileName, fileSize, mimeType } = body;

  if (!linkId || !fileName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const link = await prisma.uploadLink.findUnique({ where: { id: linkId } });
  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }

  await prisma.upload.create({
    data: { linkId, fileName, fileSize: fileSize || 0, mimeType: mimeType || 'application/octet-stream' },
  });

  return NextResponse.json({ logged: true });
}
