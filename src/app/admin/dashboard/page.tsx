import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from '../../../lib/session';
import { getTokenStatus } from '../../../lib/google';
import DashboardClient from './dashboard-client';
import { prisma } from '../../../lib/prisma';

export default async function DashboardPage() {
  const session = (await cookies()).get('plop_session');
  if (!verifySessionToken(session?.value)) {
    redirect('/admin');
  }

  const tokenStatus = await getTokenStatus();
  const rawLinks = await prisma.uploadLink.findMany({
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

  const links = rawLinks.map(l => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }));

  const status = {
    valid: tokenStatus.valid,
    expiresAt: tokenStatus.expiresAt?.toISOString() || null,
  };

  return (
    <DashboardClient
      initialLinks={links}
      initialTokenStatus={status}
      appUrl={process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}
    />
  );
}
