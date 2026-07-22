'use client';

import { useState } from 'react';
import HistoryModal from './history-modal';

type Link = {
  id: string;
  slug: string;
  label: string;
  enabled: boolean;
  createdAt: Date | string;
  _count: { uploads: number };
};

type TokenStatus = { valid: boolean; expiresAt: Date | string | null };

export default function DashboardClient({
  initialLinks,
  initialTokenStatus,
  appUrl,
}: {
  initialLinks: Link[];
  initialTokenStatus: TokenStatus;
  appUrl: string;
}) {
  const [links, setLinks] = useState(initialLinks);
  const [tokenStatus, setTokenStatus] = useState(initialTokenStatus);
  const [newLabel, setNewLabel] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [historyLink, setHistoryLink] = useState<Link | null>(null);

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel, password: newPassword || undefined }),
      });
      const link = await res.json();
      if (res.ok) {
        setLinks([link, ...links]);
        setNewLabel('');
        setNewPassword('');
      }
    } finally {
      setCreating(false);
    }
  }

  async function disableLink(id: string) {
    await fetch(`/api/links/${id}`, { method: 'DELETE' });
    setLinks(links.map(l => (l.id === id ? { ...l, enabled: false } : l)));
  }

  function copyUrl(slug: string) {
    const url = `${appUrl}/u/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">plop admin</h1>
            <p className="text-zinc-400 text-sm mt-1">Manage your upload links</p>
          </div>
          <a
            href="/api/auth?action=logout"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Logout
          </a>
        </div>

        {/* Token Status */}
        <div className={`rounded-lg border p-4 ${tokenStatus.valid ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${tokenStatus.valid ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className={tokenStatus.valid ? 'text-green-400' : 'text-red-400'}>
              {tokenStatus.valid ? 'Google Drive connected' : 'Google Drive disconnected'}
            </span>
          </div>
          {!tokenStatus.valid && (
            <a
              href="/api/auth?action=login"
              className="inline-block mt-3 text-sm bg-white text-black px-4 py-1.5 rounded-md hover:bg-zinc-200 transition-colors"
            >
              Reconnect
            </a>
          )}
          {tokenStatus.valid && tokenStatus.expiresAt && (
            <p className="text-zinc-500 text-xs mt-2">
              Token expires {new Date(tokenStatus.expiresAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Create Link */}
        <form onSubmit={createLink} className="space-y-3 p-4 rounded-lg border border-zinc-800">
          <h2 className="font-medium text-sm text-zinc-300">New upload link</h2>
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="e.g. Photos from Bali"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Password (optional)"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="w-full bg-white text-black font-medium py-2 rounded-md text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Link'}
          </button>
        </form>

        {/* Links List */}
        <div className="space-y-3">
          <h2 className="font-medium text-sm text-zinc-300">Your links</h2>
          {links.length === 0 && (
            <p className="text-zinc-500 text-sm">No links yet. Create one above.</p>
          )}
          {links.map(link => (
            <div
              key={link.id}
              className={`p-4 rounded-lg border ${link.enabled ? 'border-zinc-800' : 'border-zinc-800/50 opacity-50'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm truncate">{link.label}</h3>
                  <p className="text-zinc-500 text-xs mt-1">
                    {link._count.uploads} uploads ·{' '}
                    {new Date(link.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {link.enabled && (
                    <>
                      <button
                        onClick={() => copyUrl(link.slug)}
                        className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                      >
                        {copied === link.slug ? 'Copied!' : 'Copy URL'}
                      </button>
                      <button
                        onClick={() => setHistoryLink(link)}
                        className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                      >
                        History
                      </button>
                      <button
                        onClick={() => disableLink(link.id)}
                        className="text-xs px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                      >
                        Disable
                      </button>
                    </>
                  )}
                  {!link.enabled && (
                    <span className="text-xs text-zinc-600">Disabled</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {historyLink && (
          <HistoryModal
            linkId={historyLink.id}
            label={historyLink.label}
            onClose={() => setHistoryLink(null)}
          />
        )}
      </div>
    </div>
  );
}
