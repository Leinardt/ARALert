import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, ShieldAlert } from 'lucide-react';
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
            <div className="flex justify-center items-center gap-2 mb-2">
              <img
                src={aralertLogo}
                alt="ARALert"
                className="w-10 h-10 object-contain drop-shadow-sm"
              />
              <span className="text-xl font-black tracking-tight text-slate-800 dark:text-white">
                ARALert
              </span>
            </div>

            {/* Error Icon Badge */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              {isChunkError ? <RefreshCw className="w-8 h-8 animate-spin-reverse" /> : <ShieldAlert className="w-8 h-8" />}
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {this.props.fallbackTitle || (isChunkError ? 'Updating Application...' : 'Something went wrong')}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isChunkError
                  ? 'A new system update was detected or network was interrupted. Refreshing ensures you get the latest version.'
                  : (this.props.fallbackMessage || 'The page encountered an unexpected issue while rendering. Please try refreshing.')}
              </p>
            </div>

            {/* Technical Detail (Subtle toggle or preview) */}
            {!isChunkError && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 text-left text-xs font-mono text-slate-600 dark:text-slate-400 break-words max-h-24 overflow-y-auto">
                {errorMsg}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#0052B7] hover:bg-[#003e8b] text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <RefreshCw size={16} />
                <span>Refresh Page</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
              >
                <Home size={16} />
                <span>Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
