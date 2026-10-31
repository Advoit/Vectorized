import { useMessages } from '../i18n';
import { Dialog } from './Dialog';

interface AboutDialogProps {
  onClose: () => void;
}

export function AboutDialog({ onClose }: AboutDialogProps) {
  const m = useMessages();

  return (
    <Dialog
      title={m.about.title}
      onClose={onClose}
      className="dialog--about"
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {m.about.close}
        </button>
      }
    >
      <p className="about-intro">{m.about.intro}</p>

      <section className="about-section">
        <h3>{m.about.engineTitle}</h3>
        <p>{m.about.engineBody}</p>
        <p className="about-links">
          <a href="https://github.com/visioncortex/vtracer" target="_blank" rel="noreferrer noopener">
            visioncortex/vtracer
          </a>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/jsscheller/vtracer-wasm" target="_blank" rel="noreferrer noopener">
            vtracer-wasm
          </a>
        </p>
      </section>

      <section className="about-section">
        <h3>{m.about.pipelineTitle}</h3>
        <p>{m.about.pipelineBody}</p>
      </section>

      <section className="about-section">
        <h3>{m.about.privacyTitle}</h3>
        <p>{m.about.privacyBody}</p>
      </section>

      <section className="about-section">
        <h3>{m.about.limitsTitle}</h3>
        <p>{m.about.limitsBody}</p>
      </section>

      <section className="about-section">
        <h3>{m.about.licenseTitle}</h3>
        <p>{m.about.licenseBody}</p>
      </section>

      <section className="about-section">
        <h3>{m.about.shortcutsTitle}</h3>
        <dl className="shortcut-list">
          {m.about.shortcuts.map(([keys, action]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
        <p className="field-hint">{m.about.keyboardNote}</p>
      </section>
    </Dialog>
  );
}
