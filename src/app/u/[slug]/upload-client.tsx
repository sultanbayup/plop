'use client';

import { useState, useRef, useEffect } from 'react';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
];
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

type FileState = {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  driveFileId?: string;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function uploadFile(
  file: File,
  accessToken: string,
  folderId: string,
  onProgress: (pct: number) => void
): Promise<string> {
  const totalSize = file.size;

  // Initialize resumable upload session
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
      body: JSON.stringify({
        name: file.name,
        parents: [folderId],
      }),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Upload init failed: ${initRes.status} ${errText}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('No upload URL returned');

  let uploaded = 0;
  let retryCount = 0;
  const MAX_RETRIES = 5;

  while (uploaded < totalSize) {
    const end = Math.min(uploaded + CHUNK_SIZE, totalSize) - 1;
    const chunk = file.slice(uploaded, end + 1);
    const chunkSize = end - uploaded + 1;

    try {
      const chunkRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes ${uploaded}-${end}/${totalSize}`,
          'Content-Length': String(chunkSize),
        },
        body: chunk,
      });

      if (chunkRes.status === 200 || chunkRes.status === 201) {
        const data = await chunkRes.json();
        onProgress(100);
        return data.id;
      }

      if (chunkRes.status === 308) {
        const rangeHeader = chunkRes.headers.get('Range');
        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=0-(\d+)/);
          if (match) uploaded = parseInt(match[1], 10) + 1;
        } else {
          uploaded = end + 1;
        }
        onProgress(Math.round((uploaded / totalSize) * 100));
        retryCount = 0;
        continue;
      }

      const errorText = await chunkRes.text();
      throw new Error(`Chunk upload failed: ${chunkRes.status} ${errorText}`);
    } catch (err) {
      retryCount++;
      if (retryCount > MAX_RETRIES) throw err;
      await new Promise(r => setTimeout(r, 1000 * retryCount));
    }
  }

  throw new Error('Upload did not complete');
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export default function UploadClient({
  slug,
  hasPassword,
  label,
  appUrl,
}: {
  slug: string;
  hasPassword: boolean;
  label: string;
  appUrl: string;
}) {
  const [step, setStep] = useState<1 | 2>(hasPassword ? 1 : 2);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [credentials, setCredentials] = useState<{
    accessToken: string;
    folderId: string;
    linkId: string;
  } | null>(null);
  const [files, setFiles] = useState<FileState[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [loadingToken, setLoadingToken] = useState(!hasPassword);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasPassword) {
      fetch(`/api/verify/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
        .then(res => res.json())
        .then(data => {
          if (data.accessToken) setCredentials(data);
        })
        .catch(console.error)
        .finally(() => setLoadingToken(false));
    }
  }, [slug, hasPassword]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setPasswordError('');
    try {
      const res = await fetch(`/api/verify/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || 'Invalid password');
        return;
      }
      setCredentials(data);
      setStep(2);
    } catch {
      setPasswordError('Network error. Try again.');
    } finally {
      setUnlocking(false);
    }
  }

  function handleFiles(selectedFiles: FileList | null) {
    if (!selectedFiles) return;
    const newFiles: FileState[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i];

      if (f.size > MAX_FILE_SIZE) {
        newFiles.push({
          id: generateId(),
          file: f,
          status: 'error',
          progress: 0,
          error: `File too large (max ${formatBytes(MAX_FILE_SIZE)})`,
        });
        continue;
      }

      if (!ALLOWED_TYPES.includes(f.type) && f.type !== '') {
        newFiles.push({
          id: generateId(),
          file: f,
          status: 'error',
          progress: 0,
          error: `Unsupported format: ${f.type || 'unknown'}`,
        });
        continue;
      }

      newFiles.push({ id: generateId(), file: f, status: 'pending', progress: 0 });
    }
    setFiles(prev => [...prev, ...newFiles]);
    setDone(false);
  }

  function removeFile(id: string) {
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  async function handleUpload() {
    if (!credentials || files.length === 0) return;
    setUploading(true);

    for (const fs of files) {
      if (fs.status === 'error' || fs.status === 'done') continue;
      setFiles(prev =>
        prev.map(f => (f.id === fs.id ? { ...f, status: 'uploading', progress: 0 } : f))
      );

      try {
        const driveFileId = await uploadFile(
          fs.file,
          credentials.accessToken,
          credentials.folderId,
          (pct) => {
            setFiles(prev =>
              prev.map(f => (f.id === fs.id ? { ...f, progress: pct } : f))
            );
          }
        );

        setFiles(prev =>
          prev.map(f =>
            f.id === fs.id ? { ...f, status: 'done', progress: 100, driveFileId } : f
          )
        );

        // Log the upload
        await fetch('/api/upload-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            linkId: credentials.linkId,
            fileName: fs.file.name,
            fileSize: fs.file.size,
            mimeType: fs.file.type,
          }),
        });
      } catch (err) {
        setFiles(prev =>
          prev.map(f =>
            f.id === fs.id
              ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
              : f
          )
        );
      }
    }

    setUploading(false);
    setDone(true);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">plop</h1>
          {label && <p className="text-zinc-400 mt-1 text-sm">{label}</p>}
        </div>

        {/* Password Gate */}
        {step === 1 && hasPassword && (
          <form onSubmit={handleUnlock} className="space-y-4 p-4 rounded-lg border border-zinc-800">
            <p className="text-sm text-zinc-300 text-center">
              This link is password protected.
            </p>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              autoFocus
            />
            {passwordError && (
              <p className="text-red-400 text-xs text-center">{passwordError}</p>
            )}
            <button
              type="submit"
              disabled={unlocking || !password}
              className="w-full bg-white text-black font-medium py-2 rounded-md text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {unlocking ? 'Checking...' : 'Continue'}
            </button>
          </form>
        )}

        {/* No password case — load token immediately */}
        {step === 1 && !hasPassword && (
          <div className="text-center p-4">
            <p className="text-zinc-400 text-sm">Connecting to Google Drive...</p>
          </div>
        )}

        {/* Upload Zone */}
        {step === 2 && (
          <div className="space-y-4">
            {!credentials ? (
              <div className="text-center p-4">
                <p className="text-zinc-400 text-sm">Connecting to Google Drive...</p>
              </div>
            ) : (
              <>
            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center hover:border-zinc-500 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
            >
              <p className="text-zinc-400 text-sm">
                Drag & drop files here, or click to browse
              </p>
              <p className="text-zinc-600 text-xs mt-1">
                Photos, videos · up to {formatBytes(MAX_FILE_SIZE)} per file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/heic,image/heif,video/mp4,video/quicktime"
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map(f => (
                  <div
                    key={f.id}
                    className={`p-3 rounded-lg border text-sm ${
                      f.status === 'error'
                        ? 'border-red-500/30 bg-red-500/5'
                        : f.status === 'done'
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{f.file.name}</p>
                        <p className="text-zinc-500 text-xs">
                          {formatBytes(f.file.size)}
                        </p>
                      </div>
                      {f.status === 'pending' && !uploading && (
                        <button
                          onClick={() => removeFile(f.id)}
                          className="text-zinc-500 hover:text-zinc-300 text-xs"
                        >
                          Remove
                        </button>
                      )}
                      {f.status === 'uploading' && (
                        <span className="text-zinc-400 text-xs">{f.progress}%</span>
                      )}
                      {f.status === 'done' && (
                        <span className="text-green-400 text-xs">✓ Done</span>
                      )}
                      {f.status === 'error' && (
                        <span className="text-red-400 text-xs">{f.error}</span>
                      )}
                    </div>
                    {f.status === 'uploading' && (
                      <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full transition-all duration-300"
                          style={{ width: `${f.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}

                <button
                  onClick={handleUpload}
                  disabled={uploading || files.every(f => f.status === 'done' || f.status === 'error')}
                  className="w-full bg-white text-black font-medium py-3 rounded-md text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload All'}
                </button>
              </div>
            )}

            {done && (
              <div className="text-center p-4 rounded-lg border border-green-500/30 bg-green-500/5">
                <p className="text-green-400 text-sm">All files uploaded!</p>
                <p className="text-zinc-500 text-xs mt-1">
                  Files are in your Google Drive under &ldquo;Plop - {label}&rdquo;
                </p>
              </div>
            )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
