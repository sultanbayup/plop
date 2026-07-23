export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  return 'http://localhost:3000';
}

export function appPath(path: string): URL {
  return new URL(path, `${getAppUrl()}/`);
}
