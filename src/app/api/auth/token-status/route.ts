import { getTokenStatus } from '../../../../lib/google';
import { verifySessionToken } from '../../../../lib/session';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const session = request.cookies.get('plop_session');
  if (!verifySessionToken(session?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = await getTokenStatus();
  return NextResponse.json(status);
}
