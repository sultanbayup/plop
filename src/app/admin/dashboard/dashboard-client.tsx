'use client';

import { useState } from 'react';
import HistoryModal from './history-modal';
import ThemeToggle from '@/components/theme-toggle';
import {
  IconCheck,
  IconCopy,
  IconHistory,
  IconLogout,
  IconPause,
  IconPlus,
  IconTrash,
} from '@/components/icons';

type Link = {
  id: string; slug: string; label: string; enabled: boolean;
  createdAt: string; _count: { uploads: number };
};

type TokenStatus = { valid: boolean; expiresAt: string | null };

export default function DashboardClient({
  initialLinks, initialTokenStatus, appUrl,
}: {
  initialLinks: Link[]; initialTokenStatus: TokenStatus; appUrl: string;
}) {
  const [links, setLinks] = useState(initialLinks);
  const [tokenStatus] = useState(initialTokenStatus);
  const [newLabel, setNewLabel] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [historyLink, setHistoryLink] = useState<Link | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel,
          password: newPassword || undefined,
          folder: newFolder || undefined,
        }),
      });
      const link = await res.json();
      if (res.ok) {
        setLinks([link, ...links]);
        setNewLabel('');
        setNewPassword('');
        setNewFolder('');
        setShowForm(false);
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggleLink(id: string, enabled: boolean) {
    await fetch(`/api/links/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    setLinks(links.map((l) => (l.id === id ? { ...l, enabled } : l)));
  }

  async function deleteLinkPermanently(id: string) {
    if (!confirm('Permanently delete this link and all its upload history?')) return;
    await fetch(`/api/links/${id}`, { method: 'DELETE' });
    setLinks(links.filter((l) => l.id !== id));
  }

  function copyUrl(slug: string) {
    navigator.clipboard.writeText(`${appUrl}/u/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="app-header">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="text-base font-bold tracking-tight text-primary leading-none">plop</h1>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`status-dot ${tokenStatus.valid ? 'status-dot-ok' : 'status-dot-err'}`} />
              <span className={`text-xs truncate ${tokenStatus.valid ? 'text-secondary' : 'text-danger'}`}>
                {tokenStatus.valid ? (
                  'Drive connected'
                ) : (
                  <a href="/api/auth?action=login" className="underline">
                    Reconnect Drive
                  </a>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <a href="/api/auth?action=logout" className="btn btn-sm btn-ghost" title="Logout">
              <IconLogout />
              <span className="sm-hidden">Logout</span>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Links</p>
            <h2 className="text-2xl font-bold tracking-tight text-primary leading-none">
              {links.length} link{links.length !== 1 ? 's' : ''}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="btn btn-md btn-primary"
          >
            <IconPlus />
            Create link
          </button>
        </div>

        {showForm && (
          <div className="panel p-5 animate-fade-in">
            <form onSubmit={createLink} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-secondary mb-1 block" htmlFor="link-label">
                  Label
                </label>
                <input
                  id="link-label"
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Photos from Bali"
                  required
                  className="input"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-secondary mb-1 block" htmlFor="link-folder">
                    Drive folder
                  </label>
                  <input
                    id="link-folder"
                    type="text"
                    value={newFolder}
                    onChange={(e) => setNewFolder(e.target.value)}
                    placeholder="URL or ID (optional)"
                    className="input"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-secondary mb-1 block" htmlFor="link-password">
                    Password
                  </label>
                  <input
                    id="link-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Optional"
                    className="input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-sm btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn btn-sm btn-primary">
                  {creating ? 'Creating...' : 'Create link'}
                </button>
              </div>
            </form>
          </div>
        )}

        {links.length > 0 ? (
          <section className="panel px-5">
            {links.map((link) => (
              <div
                key={link.id}
                className={`link-row ${link.enabled ? '' : 'link-row-disabled'}`}
              >
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">{link.label}</p>
                    {!link.enabled && (
                      <span className="text-xs font-medium text-muted shrink-0">Disabled</span>
                    )}
                  </div>
                  <p className="text-xs text-muted">
                    {link._count.uploads} upload{link._count.uploads !== 1 ? 's' : ''}
                    <span className="mx-2 text-muted">·</span>
                    <span suppressHydrationWarning>
                      {new Date(link.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </p>
                </div>

                <div className="link-actions flex items-center gap-1.5 shrink-0">
                  {link.enabled ? (
                    <>
                      <button
                        type="button"
                        onClick={() => copyUrl(link.slug)}
                        className="btn btn-sm btn-secondary"
                        title="Copy link"
                      >
                        <IconCopy />
                        {copied === link.slug ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryLink(link)}
                        className="btn btn-sm btn-soft"
                        title="Upload history"
                      >
                        <IconHistory />
                        History
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleLink(link.id, false)}
                        className="btn btn-sm btn-soft"
                        title="Disable link"
                      >
                        <IconPause />
                        Disable
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleLink(link.id, true)}
                        className="btn btn-sm btn-success"
                        title="Enable link"
                      >
                        <IconCheck />
                        Enable
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLinkPermanently(link.id)}
                        className="btn btn-sm btn-danger"
                        title="Delete link"
                      >
                        <IconTrash />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </section>
        ) : (
          <div className="panel py-16 px-6 text-center">
            <p className="text-sm text-secondary mb-1">No links yet</p>
            <p className="text-xs text-muted mb-5">Create a shareable upload link to get started.</p>
            <button type="button" onClick={() => setShowForm(true)} className="btn btn-md btn-primary">
              <IconPlus />
              Create your first link
            </button>
          </div>
        )}
      </main>

      {historyLink && (
        <HistoryModal
          linkId={historyLink.id}
          label={historyLink.label}
          onClose={() => setHistoryLink(null)}
        />
      )}
    </div>
  );
}
