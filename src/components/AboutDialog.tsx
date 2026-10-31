import { de } from '../i18n/de';
import { Dialog } from './Dialog';

interface AboutDialogProps {
  onClose: () => void;
}

export function AboutDialog({ onClose }: AboutDialogProps) {
  return (
    <Dialog
      title={de.about.title}
      onClose={onClose}
      className="dialog--about"
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {de.about.close}
        </button>
      }
    >
      <p className="about-intro">{de.about.intro}</p>

      <section className="about-section">
        <h3>{de.about.engineTitle}</h3>
        <p>{de.about.engineBody}</p>
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
        <h3>{de.about.pipelineTitle}</h3>
        <p>{de.about.pipelineBody}</p>
      </section>

      <section className="about-section">
        <h3>{de.about.privacyTitle}</h3>
        <p>{de.about.privacyBody}</p>
      </section>

      <section className="about-section">
        <h3>{de.about.limitsTitle}</h3>
        <p>{de.about.limitsBody}</p>
      </section>

      <section className="about-section">
        <h3>{de.about.licenseTitle}</h3>
        <p>{de.about.licenseBody}</p>
      </section>

      <section className="about-section">
        <h3>{de.about.shortcutsTitle}</h3>
        <dl className="shortcut-list">
          {de.about.shortcuts.map(([keys, action]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
        <p className="field-hint">{de.about.keyboardNote}</p>
      </section>
    </Dialog>
  );
}
