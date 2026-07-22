import { prisma } from '../../../lib/prisma';
import UploadClient from './upload-client';

export default async function UploadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const link = await prisma.uploadLink.findUnique({
    where: { slug, enabled: true },
  });

  if (!link) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">plop</h1>
          <p className="text-zinc-400">This upload link doesn't exist or has been disabled.</p>
        </div>
      </div>
    );
  }

  return (
    <UploadClient
      slug={slug}
      hasPassword={!!link.passwordHash}
      label={link.label}
      appUrl={process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}
    />
  );
}
