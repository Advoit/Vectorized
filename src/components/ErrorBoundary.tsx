import { Component, type ErrorInfo, type ReactNode } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Uncaught application error', error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="fatal-error" role="alert">
          <IconAlertTriangle size={24} stroke={1.7} aria-hidden="true" />
          <h1>Die Oberfläche ist auf einen Fehler gestoßen.</h1>
          <p>
            Die zuletzt importierten Bilder werden nicht gespeichert. Laden Sie die Seite neu, um neu zu
            beginnen.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Seite neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
