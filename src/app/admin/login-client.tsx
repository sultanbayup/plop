'use client';

import ThemeToggle from '@/components/theme-toggle';
import { IconGoogle } from '@/components/icons';

export default function LoginClient({ error }: { error?: string }) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="app-header">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-base font-bold tracking-tight text-primary">plop</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm flex flex-col items-center gap-8 animate-fade-in">
          <div className="text-center flex flex-col gap-3">
            <h1 className="text-4xl font-bold tracking-tighter text-primary leading-none">plop</h1>
            <p className="text-sm text-secondary leading-relaxed max-w-[260px] mx-auto">
              Share a link. Let people drop files directly into your Google Drive.
            </p>
          </div>

          {error && (
            <div className="w-full panel border-danger bg-danger-soft px-4 py-3">
              <p className="text-sm text-danger text-center">
                {error === 'no_code'
                  ? 'Login was cancelled.'
                  : error === 'auth_failed'
                    ? 'Authentication failed. Please try again.'
                    : error}
              </p>
            </div>
          )}

          <div className="w-full flex flex-col gap-4">
            <a href="/api/auth?action=login" className="btn btn-lg btn-primary w-full">
              <IconGoogle className="w-5 h-5" />
              Sign in with Google
            </a>
            <p className="text-xs text-muted text-center">
              Access is limited to files Plop creates
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
