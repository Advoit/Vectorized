import { Component, type ErrorInfo, type ReactNode } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { currentMessages } from '../i18n';

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
      // Class components cannot use hooks, so this reads the active locale
      // synchronously. The boundary only renders after a crash.
      const m = currentMessages();
      return (
        <div className="fatal-error" role="alert">
          <IconAlertTriangle size={24} stroke={1.7} aria-hidden="true" />
          <h1>{m.errors.crashTitle}</h1>
          <p>{m.errors.crashBody}</p>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            {m.errors.crashReload}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
