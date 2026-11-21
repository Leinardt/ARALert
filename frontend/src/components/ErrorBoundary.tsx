import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import aralertLogo from '../assets/ARALert_Logo_LIGHT.png';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ARALert ErrorBoundary] Uncaught render error:', error, errorInfo);
    this.setState({ errorInfo });

    // Check if error is related to dynamic import / chunk failure
    const errorMsg = String(error?.message || '');
    const isChunkLoadError =
      error?.name === 'ChunkLoadError' ||
      errorMsg.includes('Failed to fetch dynamically imported module') ||
      errorMsg.includes('Loading chunk') ||
      errorMsg.includes('dynamically imported module') ||
      errorMsg.includes('Importing a module script failed');

    if (isChunkLoadError) {
      const retryKey = 'aralert_chunk_retry_timestamp';
      const lastRetry = sessionStorage.getItem(retryKey);
      const now = Date.now();
      if (!lastRetry || now - Number(lastRetry) > 12000) {
        sessionStorage.setItem(retryKey, String(now));
        console.warn('[ARALert ErrorBoundary] Chunk load error detected. Automatically reloading page...');
        window.location.reload();
      }
    }
  }

  private handleReload = () => {
    // Clear chunk retry lock and refresh the application
    sessionStorage.removeItem('aralert_chunk_retry_timestamp');
    window.location.reload();
  };

  private handleGoHome = () => {
    sessionStorage.removeItem('aralert_chunk_retry_timestamp');
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'An unexpected application error occurred.';
      const isChunkError =
        errorMsg.includes('Failed to fetch dynamically imported module') ||
        errorMsg.includes('Loading chunk') ||
        errorMsg.includes('ChunkLoadError');

      return (
        <div className="min-h-screen min-h-[100dvh] w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0c0d0e] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#003E8B] selection:text-white">
          <div className="w-full max-w-md bg-white dark:bg-[#141619] border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
            {/* Header Brand */}
            <div className="flex justify-center items-center gap-2">
              <img
                src={aralertLogo}
                alt="ARALert"
                className="w-10 h-10 object-contain drop-shadow-sm"
              />
              <span className="text-xl font-black tracking-tight text-slate-800 dark:text-white">
                ARALert
              </span>
            </div>

            {/* Formal Title & Description */}
            <div className="space-y-2.5 pt-1">
              <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {isChunkError ? 'System Notice' : 'System Error'}
              </p>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {this.props.fallbackTitle || (isChunkError ? 'System Update in Progress' : 'Unable to Display Page')}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isChunkError
                  ? 'A newer version of ARALert is available, or your connection was briefly interrupted. Please refresh the page to load the latest update.'
                  : (this.props.fallbackMessage || 'An unexpected system error prevented this page from loading properly. Please refresh the page or return to the home page. If this issue persists, kindly report it to your School Administrator.')}
              </p>
            </div>

            {/* Action Buttons (Text Only, No Icons) */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center px-5 py-3 rounded-xl font-bold text-sm bg-[#0052B7] hover:bg-[#003e8b] text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                Refresh Page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center px-4 py-3 rounded-xl font-semibold text-sm border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
