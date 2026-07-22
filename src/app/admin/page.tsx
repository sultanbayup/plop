import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from '../../lib/session';
import LoginClient from './login-client';

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const session = (await cookies()).get('plop_session');
  if (verifySessionToken(session?.value)) {
    redirect('/admin/dashboard');
  }
  return <LoginClient error={sp.error} />;
}
