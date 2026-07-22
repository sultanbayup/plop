'use client';

import { useEffect, useState } from 'react';
import { IconFile, IconX } from '@/components/icons';

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
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUploads(data);
      })
      .finally(() => setLoading(false));
  }, [linkId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel animate-fade-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Upload history for ${label}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-primary truncate">Upload history</h3>
            <p className="text-xs text-muted mt-0.5 truncate">{label}</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-icon-sm btn-ghost" aria-label="Close">
            <IconX />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {loading && (
            <div className="text-center py-10">
              <p className="text-sm text-muted">Loading history...</p>
            </div>
          )}

          {!loading && uploads.length === 0 && (
            <div className="text-center py-10">
              <div className="flex justify-center text-muted mb-3">
                <IconFile className="w-8 h-8" />
              </div>
              <p className="text-sm text-secondary">No uploads yet</p>
              <p className="text-xs text-muted mt-1">Files will appear here after someone uses this link.</p>
            </div>
          )}

          {!loading &&
            uploads.map((upload) => (
              <div key={upload.id} className="flex items-start gap-3 py-3 border-b last:border-b-0">
                <div className="text-muted shrink-0 mt-0.5">
                  <IconFile />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-primary truncate">{upload.fileName}</p>
                  <p className="text-xs text-muted font-mono mt-0.5">
                    {formatBytes(upload.fileSize)}
                    <span className="mx-2">·</span>
                    <span suppressHydrationWarning>
                      {new Date(upload.uploadedAt).toLocaleString()}
                    </span>
                  </p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
