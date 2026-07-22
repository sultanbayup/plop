import { NextRequest, NextResponse } from 'next/server';
import { handleCallback } from '../../../../lib/google';
import { generateSessionToken } from '../../../../lib/session';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(
      new URL(`/admin?error=no_code`, request.url)
    );
  }

  try {
    const user = await handleCallback(code);
    const { token, expires } = generateSessionToken();

    const response = NextResponse.redirect(
      new URL('/admin/dashboard', request.url)
    );

    response.cookies.set('plop_session', `${token}:${expires}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error('OAuth callback error:', err);
    const msg = err instanceof Error ? err.message : 'auth_failed';
    return NextResponse.redirect(
      new URL(`/admin?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
