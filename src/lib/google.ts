import { OAuth2Client } from 'google-auth-library';
import { prisma } from './prisma';
import { encrypt, decrypt } from './crypto';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
];

let cachedAccessToken: string | null = null;
let cachedTokenExpiry: number = 0;

export function getAuthUrl(): string {
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

export async function handleCallback(code: string) {
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('No refresh token received. Revoke access and try again.');
  }

  let email = '';
  let name = '';

  if (tokens.id_token) {
    const idToken = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = idToken.getPayload();
    email = payload?.email || '';
    name = payload?.name || email;
  }

  if (!email && tokens.access_token) {
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    email = userInfo.email || '';
    name = userInfo.name || email;
  }

  if (!email) throw new Error('Could not verify Google account');

  const encryptedToken = encrypt(tokens.refresh_token);
  const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      googleRefreshToken: encryptedToken,
      googleTokenExpires: expiryDate,
    },
    create: {
      email,
      name,
      googleRefreshToken: encryptedToken,
      googleTokenExpires: expiryDate,
    },
  });

  if (tokens.access_token) {
    cachedAccessToken = tokens.access_token;
    cachedTokenExpiry = tokens.expiry_date || 0;
  }

  return user;
}

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedTokenExpiry > now + 60000) {
    return cachedAccessToken;
  }

  const user = await prisma.user.findFirst();
  if (!user) throw new Error('No user configured');

  const refreshToken = decrypt(user.googleRefreshToken);
  client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error('Failed to refresh access token');

  cachedAccessToken = credentials.access_token;
  cachedTokenExpiry = credentials.expiry_date || now + 3600000;

  await prisma.user.update({
    where: { id: user.id },
    data: { googleTokenExpires: new Date(cachedTokenExpiry) },
  });

  return cachedAccessToken;
}

export async function getTokenStatus(): Promise<{ valid: boolean; expiresAt: Date | null }> {
  const user = await prisma.user.findFirst();
  if (!user) return { valid: false, expiresAt: null };

  try {
    await getAccessToken();
    return { valid: true, expiresAt: user.googleTokenExpires };
  } catch {
    return { valid: false, expiresAt: user.googleTokenExpires };
  }
}

export async function createDriveFolder(folderName: string): Promise<string> {
  const accessToken = await getAccessToken();
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!response.ok) throw new Error(`Failed to create folder: ${await response.text()}`);
  const data = await response.json();
  return data.id;
}

export function extractFolderId(folderInput: string): string | null {
  const urlMatch = folderInput.match(/[?&]id=([^&]+)/);
  if (urlMatch) return urlMatch[1];

  const pathMatch = folderInput.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];

  if (/^[a-zA-Z0-9_-]{20,}$/.test(folderInput.trim())) return folderInput.trim();

  return null;
}

export function getDriveClient() {
  return client;
}
