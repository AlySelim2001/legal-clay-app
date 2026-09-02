import React from 'react';
import { useLocation } from 'react-router';

interface Props {
  children: React.ReactNode;
  routeName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Per-route error boundary that isolates crashes to individual route segments.
 * Prevents a single broken page from taking down the entire application.
 */
export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // Log to observability service in production
    console.error(
      `[RouteErrorBoundary] ${this.props.routeName ?? 'Unknown'} crashed:`,
      error,
      errorInfo.componentStack,
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/app/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6" dir="rtl">
          <div className="clay-card max-w-md w-full p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold text-clay-text-primary font-arabic mb-2">
              خطأ في تحميل الصفحة
            </h2>
            <p className="text-sm text-clay-text-secondary font-arabic mb-1">
              {this.props.routeName
                ? `حدث خطأ غير متوقع في "${this.props.routeName}"`
                : 'حدث خطأ غير متوقع'}
            </p>
            {this.state.error && (
              <p className="text-xs text-clay-text-secondary/60 font-mono mt-2 break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={this.handleRetry}
                className="clay-button clay-button-primary text-sm"
              >
                إعادة المحاولة
              </button>
              <button
                onClick={this.handleGoHome}
                className="clay-button text-sm"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Wrapper component that injects the current route name from the URL.
 */
export function RouteErrorBoundaryWrapper({
  children,
  routeName,
}: {
  children: React.ReactNode;
  routeName?: string;
}) {
  const location = useLocation();
  const name = routeName ?? location.pathname.split('/').pop() ?? 'صفحة';

  return (
    <RouteErrorBoundary routeName={name}>
      {children}
    </RouteErrorBoundary>
  );
}
