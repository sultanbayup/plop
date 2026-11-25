import { NextRequest, NextResponse } from 'next/server';
import { appPath } from '../../../../lib/app-url';
import { handleCallback } from '../../../../lib/google';
import { generateSessionToken } from '../../../../lib/session';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(appPath('/admin?error=no_code'));
  }

  try {
    const user = await handleCallback(code);
    const { token, expires } = generateSessionToken();

    const response = NextResponse.redirect(appPath('/admin/dashboard'));

    response.cookies.set('plop_session', `${token}:${expires}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    const response =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: unknown } }).response
        : undefined;
    console.error('OAuth callback error:', err instanceof Error ? err.message : err);
    if (response?.data) {
      console.error('OAuth error detail:', JSON.stringify(response.data));
    }
    const msg = err instanceof Error ? err.message : 'auth_failed';
    return NextResponse.redirect(
      appPath(`/admin?error=${encodeURIComponent(msg)}`)
    );
  }
}
