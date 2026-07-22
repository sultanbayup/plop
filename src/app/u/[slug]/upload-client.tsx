'use client';

import { useEffect, useRef, useState } from 'react';
import ThemeToggle from '@/components/theme-toggle';
import {
  IconCheckCircle,
  IconCloud,
  IconFile,
  IconLock,
  IconUpload,
  IconX,
  IconXCircle,
} from '@/components/icons';

const CHUNK_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
];
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

type FileState = {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

async function uploadFile(
  file: File,
  accessToken: string,
  folderId: string,
  onProgress: (pct: number) => void,
): Promise<string> {
  const totalSize = file.size;
  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Content-Length': String(totalSize),
      },
      body: JSON.stringify({ name: file.name, parents: [folderId] }),
    },
  );
  if (!initRes.ok) throw new Error(`Upload init failed: ${initRes.status}`);
  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('No upload URL');

  let uploaded = 0;
  let retry = 0;
  while (uploaded < totalSize) {
    const end = Math.min(uploaded + CHUNK_SIZE, totalSize) - 1;
    const chunk = file.slice(uploaded, end + 1);
    try {
      const r = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes ${uploaded}-${end}/${totalSize}`,
          'Content-Length': String(end - uploaded + 1),
        },
        body: chunk,
      });
      if (r.status === 200 || r.status === 201) {
        onProgress(100);
        const d = await r.json();
        return d.id;
      }
      if (r.status === 308) {
        const rh = r.headers.get('Range');
        uploaded = rh ? parseInt(rh.match(/bytes=0-(\d+)/)![1], 10) + 1 : end + 1;
        onProgress(Math.round((uploaded / totalSize) * 100));
        retry = 0;
        continue;
      }
      throw new Error(`Chunk failed: ${r.status}`);
    } catch (err) {
      retry++;
      if (retry > 5) throw err;
      await new Promise((r) => setTimeout(r, 1000 * retry));
    }
  }
  throw new Error('Upload incomplete');
}

function uid() {
  return Math.random().toString(36).substring(2, 15);
}

export default function UploadClient({
  slug,
  hasPassword,
  label,
}: {
  slug: string;
  hasPassword: boolean;
  label: string;
}) {
  const [step, setStep] = useState<1 | 2>(hasPassword ? 1 : 2);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [creds, setCreds] = useState<{
    accessToken: string;
    folderId: string;
    linkId: string;
  } | null>(null);
  const [files, setFiles] = useState<FileState[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasPassword) {
      fetch(`/api/verify/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.accessToken) setCreds(d);
        })
        .catch(console.error);
    }
  }, [slug, hasPassword]);

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setPasswordError('');
    fetch(`/api/verify/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setPasswordError(d.error);
          return;
        }
        setCreds(d);
        setStep(2);
      })
      .catch(() => setPasswordError('Network error. Please try again.'))
      .finally(() => setUnlocking(false));
  }

  function handleFiles(fl: FileList | null) {
    if (!fl) return;
    const nf: FileState[] = [];
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i];
      if (f.size > MAX_FILE_SIZE) {
        nf.push({
          id: uid(),
          file: f,
          status: 'error',
          progress: 0,
          error: `Max ${formatBytes(MAX_FILE_SIZE)}`,
        });
        continue;
      }
      if (!ALLOWED_TYPES.includes(f.type) && f.type !== '') {
        nf.push({
          id: uid(),
          file: f,
          status: 'error',
          progress: 0,
          error: 'Unsupported format',
        });
        continue;
      }
      nf.push({ id: uid(), file: f, status: 'pending', progress: 0 });
    }
    setFiles((p) => [...p, ...nf]);
    setDone(false);
  }

  function removeFile(id: string) {
    setFiles((p) => p.filter((f) => f.id !== id));
  }

  async function handleUpload() {
    if (!creds || files.length === 0) return;
    setUploading(true);
    for (const fs of files) {
      if (fs.status === 'error' || fs.status === 'done') continue;
      setFiles((p) => p.map((f) => (f.id === fs.id ? { ...f, status: 'uploading', progress: 0 } : f)));
      try {
        await uploadFile(fs.file, creds.accessToken, creds.folderId, (pct) => {
          setFiles((p) => p.map((f) => (f.id === fs.id ? { ...f, progress: pct } : f)));
        });
        setFiles((p) => p.map((f) => (f.id === fs.id ? { ...f, status: 'done', progress: 100 } : f)));
        fetch('/api/upload-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            linkId: creds.linkId,
            fileName: fs.file.name,
            fileSize: fs.file.size,
            mimeType: fs.file.type,
          }),
        });
      } catch (err) {
        setFiles((p) =>
          p.map((f) =>
            f.id === fs.id
              ? {
                  ...f,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Upload failed',
                }
              : f,
          ),
        );
      }
    }
    setUploading(false);
    setDone(true);
  }

  const doneCount = files.filter((f) => f.status === 'done').length;
  const canUpload = !uploading && files.some((f) => f.status === 'pending');

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="app-header">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base font-bold tracking-tight text-primary leading-none">plop</span>
            {label && (
              <>
                <span className="text-muted">/</span>
                <span className="text-sm text-secondary truncate">{label}</span>
              </>
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl mx-auto flex flex-col gap-6">
          {step === 1 && hasPassword && (
            <div className="animate-fade-in flex flex-col gap-5">
              <div className="text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
                  <IconLock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-primary">Password required</h2>
                  <p className="text-sm text-secondary mt-1">Enter the password to unlock this upload link.</p>
                </div>
              </div>

              <div className="panel p-5">
                <form onSubmit={handleUnlock} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-medium text-secondary mb-1 block" htmlFor="upload-password">
                      Password
                    </label>
                    <input
                      id="upload-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="input"
                      autoFocus
                    />
                  </div>
                  {passwordError && (
                    <p className="text-xs text-danger text-center">{passwordError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={unlocking || !password}
                    className="btn btn-lg btn-primary w-full"
                  >
                    {unlocking ? 'Checking...' : 'Continue'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {step === 2 && (
            <>
              {!creds ? (
                <div className="text-center py-16">
                  <p className="text-sm text-muted">Connecting to Google Drive...</p>
                </div>
              ) : (
                <>
                  <div
                    className={`dropzone ${dragOver ? 'dropzone-active' : ''}`}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleFiles(e.dataTransfer.files);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
                    }}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className={dragOver ? 'scale-105 transition-transform' : 'transition-transform'}>
                        <IconCloud active={dragOver} />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-primary">
                          {dragOver ? 'Drop to add files' : 'Drop & plop it here'}
                        </p>
                        <p className="text-sm text-secondary mt-1">
                          {label ? `Upload directly to ${label}` : 'Upload directly to Google Drive'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileRef.current?.click();
                        }}
                      >
                        <IconUpload />
                        Browse files
                      </button>
                      <p className="text-xs text-muted font-mono">
                        Photos, videos · max {formatBytes(MAX_FILE_SIZE)} per file
                      </p>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/gif,image/heic,image/heif,video/mp4,video/quicktime"
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                  </div>

                  {files.length > 0 && (
                    <div className="flex flex-col gap-2 animate-fade-in">
                      {files.map((f) => (
                        <div
                          key={f.id}
                          className={`file-row ${
                            f.status === 'error'
                              ? 'file-row-error'
                              : f.status === 'done'
                                ? 'file-row-done'
                                : ''
                          }`}
                        >
                          <div
                            className="shrink-0"
                            style={{
                              color:
                                f.status === 'done'
                                  ? 'var(--success-text)'
                                  : f.status === 'error'
                                    ? 'var(--danger-text)'
                                    : 'var(--text-muted)',
                            }}
                          >
                            {f.status === 'done' ? (
                              <IconCheckCircle />
                            ) : f.status === 'error' ? (
                              <IconXCircle />
                            ) : (
                              <IconFile />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-primary truncate">{f.file.name}</p>
                              <span className="text-xs font-mono text-muted shrink-0">
                                {formatBytes(f.file.size)}
                              </span>
                            </div>

                            {f.status === 'uploading' && (
                              <div className="flex items-center gap-3 mt-2">
                                <div className="flex-1 progress-bg">
                                  <div className="progress-fill" style={{ width: `${f.progress}%` }} />
                                </div>
                                <span className="text-xs font-mono text-accent shrink-0">
                                  {f.progress}%
                                </span>
                              </div>
                            )}

                            {f.status === 'error' && (
                              <p className="text-xs text-danger mt-1">{f.error}</p>
                            )}
                          </div>

                          {f.status === 'pending' && !uploading && (
                            <button
                              type="button"
                              onClick={() => removeFile(f.id)}
                              className="btn btn-icon-sm btn-ghost shrink-0"
                              aria-label={`Remove ${f.file.name}`}
                            >
                              <IconX />
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={!canUpload}
                        className="btn btn-lg btn-primary w-full mt-2"
                      >
                        <IconUpload />
                        {uploading
                          ? 'Uploading...'
                          : (() => {
                              const n = files.filter((f) => f.status === 'pending').length;
                              return n === 1 ? 'Upload 1 file' : `Upload ${n} files`;
                            })()}
                      </button>
                    </div>
                  )}

                  {done && doneCount > 0 && (
                    <div className="panel p-8 text-center animate-fade-in border-success bg-success-soft">
                      <div className="flex justify-center text-success mb-4 animate-check">
                        <IconCheckCircle className="w-8 h-8" />
                      </div>
                      <p className="text-base font-semibold text-primary">All done</p>
                      <p className="text-sm text-secondary mt-1">
                        {doneCount} file{doneCount !== 1 ? 's' : ''} uploaded
                        {label ? ` to Plop — ${label}` : ' to Google Drive'}
                      </p>
                      <button
                        type="button"
                        className="btn btn-md btn-secondary mt-5"
                        onClick={() => {
                          setFiles([]);
                          setDone(false);
                        }}
                      >
                        Upload more files
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
