import { useEffect, useRef, type ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';
import { useMessages } from '../i18n';
import { IconButton } from './IconButton';

interface DialogProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  className?: string;
}

/** Native dialog: focus trap, Escape handling and backdrop semantics for free. */
export function Dialog({ title, description, children, footer, onClose, className = '' }: DialogProps) {
  const m = useMessages();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useRef(`dialog-title-${Math.random().toString(36).slice(2, 9)}`);
  const descriptionId = useRef(`dialog-desc-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`dialog ${className}`}
      aria-labelledby={titleId.current}
      aria-describedby={description ? descriptionId.current : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="dialog__inner">
        <header className="dialog__header">
          <div>
            <h2 id={titleId.current}>{title}</h2>
            {description ? (
              <p id={descriptionId.current} className="dialog__description">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label={m.common.close} icon={<IconX size={17} stroke={1.7} />} onClick={onClose} />
        </header>
        <div className="dialog__body">{children}</div>
        {footer ? <footer className="dialog__footer">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
