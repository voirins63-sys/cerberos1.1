import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Une erreur inattendue est survenue.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-obsidian text-zinc-100">
          <div className="max-w-lg w-full bg-charcoal gold-border rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="font-display text-lg font-bold text-gold">
              Erreur de synchronisation — LOS CERBEROS
            </h2>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Une erreur est survenue lors de la connexion à la base de données partagée. Rechargez la page pour réessayer.
            </p>
            <pre className="text-[11px] bg-obsidian border border-zinc-800 rounded-xl p-3 overflow-x-auto text-red-300">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition cursor-pointer"
            >
              Recharger l&apos;application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
