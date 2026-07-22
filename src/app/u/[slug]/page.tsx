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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center flex flex-col gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">plop</h1>
          <p className="text-sm font-medium text-slate-500">This upload link doesn't exist or has been disabled.</p>
        </div>
      </div>
    );
  }

  return (
    <UploadClient
      slug={slug}
      hasPassword={!!link.passwordHash}
      label={link.label}
    />
  );
}
