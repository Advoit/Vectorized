import type { ReactNode } from 'react';
import { IconAlertTriangle, IconCheck, IconInfoCircle, IconX } from '@tabler/icons-react';
import { useToasts, type ToastKind } from '../state/useToasts';

const ICONS: Record<ToastKind, ReactNode> = {
  success: <IconCheck size={16} stroke={2} aria-hidden="true" />,
  error: <IconAlertTriangle size={16} stroke={1.8} aria-hidden="true" />,
  info: <IconInfoCircle size={16} stroke={1.8} aria-hidden="true" />,
};

export function ToastViewport({ toasts, dismiss }: ReturnType<typeof useToasts>) {
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
          <span className="toast__icon">{ICONS[toast.kind]}</span>
          <span className="toast__message">{toast.message}</span>
          <button
            type="button"
            className="toast__close"
            aria-label="Meldung schließen"
            onClick={() => dismiss(toast.id)}
          >
            <IconX size={14} stroke={1.8} />
          </button>
        </div>
      ))}
    </div>
  );
}
