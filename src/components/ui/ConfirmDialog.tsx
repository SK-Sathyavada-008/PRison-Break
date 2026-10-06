// ─────────────────────────────────────────────
// ConfirmDialog — confirmation modal
// ─────────────────────────────────────────────

import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-box"
        style={{ borderColor: variant === 'danger' ? 'rgba(255,45,85,0.3)' : 'rgba(0,255,157,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <h3 className="font-display text-sm font-semibold text-slate-200 tracking-wide">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-slate-600 hover:text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Message */}
        <p className="font-mono text-xs text-slate-400 leading-relaxed mb-6">{message}</p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn btn-ghost">{cancelLabel}</button>
          <button
            onClick={onConfirm}
            className={variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
