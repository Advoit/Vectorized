import { IconCheck, IconFile, IconShieldLock, IconUpload } from '@tabler/icons-react';
import { useMessages } from '../i18n';

interface EmptyStateProps {
  onOpen: () => void;
  onSample: () => void;
  sampleLoading: boolean;
}

export function EmptyState({ onOpen, onSample, sampleLoading }: EmptyStateProps) {
  const m = useMessages();

  return (
    <main className="empty-state" id="main-content">
      <div className="empty-panel">
        <h1 className="empty-title">{m.empty.heading}</h1>
        <p className="empty-intro">{m.empty.body}</p>

        <button type="button" className="dropzone" onClick={onOpen}>
          <span className="dropzone__icon" aria-hidden="true">
            <IconUpload size={26} stroke={1.6} />
          </span>
          <span className="dropzone__title">{m.empty.dropTitle}</span>
          <span className="dropzone__body">{m.empty.dropBody}</span>
          <span className="btn btn--primary dropzone__button">
            <IconFile size={16} stroke={1.7} aria-hidden="true" />
            {m.empty.chooseFile}
          </span>
        </button>

        <p className="empty-formats">{m.empty.formats}</p>

        <div className="empty-meta">
          <p className="empty-privacy">
            <IconShieldLock size={15} stroke={1.7} aria-hidden="true" />
            <span>{m.empty.privacy}</span>
          </p>
          <span className="empty-maxsize">{m.empty.maxSize}</span>
        </div>

        <button type="button" className="link-button" onClick={onSample} disabled={sampleLoading}>
          {sampleLoading ? m.common.loading : m.empty.example}
        </button>

        <div className="empty-fit-grid">
          <section>
            <h2>
              <IconCheck size={15} stroke={1.8} aria-hidden="true" />
              {m.empty.goodFor}
            </h2>
            <p>{m.empty.goodForList}</p>
          </section>
          <section>
            <h2 className="is-muted">
              <span className="minus-mark" aria-hidden="true">
                −
              </span>
              {m.empty.lessGood}
            </h2>
            <p>{m.empty.lessGoodList}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
