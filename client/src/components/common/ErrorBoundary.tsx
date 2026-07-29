import { Component, ReactNode } from 'react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      const isDev = import.meta.env?.DEV;
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠️</div>
            <h2 className="error-boundary-title">Something went wrong</h2>
            <p className="error-boundary-message">
              {this.state.error.message || 'An unexpected error occurred.'}
            </p>
            {isDev && (
              <pre className="error-boundary-stack">
                {this.state.error.stack}
              </pre>
            )}
            <div className="error-boundary-actions">
              <button
                onClick={() => window.location.reload()}
                className="error-boundary-btn-primary"
              >
                Reload
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="error-boundary-btn-secondary"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
