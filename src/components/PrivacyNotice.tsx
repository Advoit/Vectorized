import { useState } from 'react';
import { IconShieldLock } from '@tabler/icons-react';
import { useMessages } from '../i18n';

const NOTICE_KEY = 'kontur.notice.v1';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(NOTICE_KEY, '1');
  } catch {
    // Without storage the notice reappears on the next visit.
  }
}

interface PrivacyNoticeProps {
  onShowDetails?: () => void;
}

/**
 * Informational notice, not a consent gate: the app sets no cookies and loads
 * no third-party resources, so there is nothing to opt in or out of. It only
 * states that fact and can be dismissed; nothing is blocked meanwhile.
 */
export function PrivacyNotice({ onShowDetails }: PrivacyNoticeProps) {
  const m = useMessages();
  const [visible, setVisible] = useState(() => !readDismissed());

  if (!visible) return null;

  const dismiss = () => {
    writeDismissed();
    setVisible(false);
  };

  return (
    <section className="privacy-notice" aria-labelledby="privacy-notice-title">
      <span className="privacy-notice__icon" aria-hidden="true">
        <IconShieldLock size={17} stroke={1.7} />
      </span>

      <div className="privacy-notice__body">
        <h2 id="privacy-notice-title" className="privacy-notice__title">
          {m.privacy.title}
        </h2>
        <p className="privacy-notice__text">{m.privacy.body}</p>
        {onShowDetails ? (
          <button type="button" className="link-button privacy-notice__link" onClick={onShowDetails}>
            {m.privacy.more}
          </button>
        ) : null}
      </div>

      <button type="button" className="btn btn--secondary privacy-notice__action" onClick={dismiss}>
        {m.privacy.dismiss}
      </button>
    </section>
  );
}
