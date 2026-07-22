'use client';

import { useState, useEffect } from 'react';

type Upload = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function HistoryModal({
  linkId,
  label,
  onClose,
}: {
  linkId: string;
  label: string;
  onClose: () => void;
}) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/links/${linkId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setUploads(data);
      })
      .finally(() => setLoading(false));
  }, [linkId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-lg max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="font-medium text-sm">History: {label}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 transition-colors text-lg leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {loading && <p className="text-zinc-500 text-sm">Loading...</p>}
          {!loading && uploads.length === 0 && (
            <p className="text-zinc-500 text-sm">No uploads yet.</p>
          )}
          {uploads.map(upload => (
            <div key={upload.id} className="flex items-center justify-between text-sm py-2 border-b border-zinc-800/50 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate">{upload.fileName}</p>
                <p className="text-zinc-500 text-xs">
                  {formatBytes(upload.fileSize)} · {new Date(upload.uploadedAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
