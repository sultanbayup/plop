import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '../../../lib/google';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  if (action === 'login') {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  }

  if (action === 'logout') {
    const response = NextResponse.redirect(new URL('/admin', request.url));
    response.cookies.delete('plop_session');
    return response;
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
