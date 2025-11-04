import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary Component
 * 
 * Catches React rendering errors and displays a graceful fallback UI.
 * Logs errors to Application Insights for monitoring.
 * 
 * Usage:
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 */
class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to Application Insights
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // TODO: Send to Application Insights once configured
    // appInsights.trackException({
    //   exception: error,
    //   properties: {
    //     componentStack: errorInfo.componentStack,
    //     errorBoundary: 'GlobalErrorBoundary',
    //   },
    //   severityLevel: SeverityLevel.Error,
    // });

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

function ErrorFallback({ error, errorInfo, onReset }: ErrorFallbackProps) {
  const navigate = useNavigate();

  const handleGoHome = () => {
    onReset();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
        </div>

        {/* Error Title */}
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
          Something went wrong
        </h1>

        {/* Error Description */}
        <p className="text-lg text-gray-600 text-center mb-8">
          We're sorry, but something unexpected happened. Our team has been notified and we're working on it.
        </p>

        {/* Error Details (Development Only) */}
        {import.meta.env.DEV && error && (
          <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Error Details (Development Only)
            </h2>
            <div className="text-xs text-gray-600 font-mono space-y-2">
              <div>
                <span className="font-semibold">Message:</span> {error.message}
              </div>
              {error.stack && (
                <div>
                  <span className="font-semibold">Stack:</span>
                  <pre className="mt-1 whitespace-pre-wrap break-all text-xs">
                    {error.stack}
                  </pre>
                </div>
              )}
              {errorInfo?.componentStack && (
                <div>
                  <span className="font-semibold">Component Stack:</span>
                  <pre className="mt-1 whitespace-pre-wrap break-all text-xs">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleGoHome}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Home className="w-5 h-5" />
            Go to Home
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Reload Page
          </button>
        </div>

        {/* Help Text */}
        <p className="text-sm text-gray-500 text-center mt-8">
          If the problem persists, please contact support or try again later.
        </p>
      </div>
    </div>
  );
}

// HOC wrapper to use hooks with class component
export default function ErrorBoundary(props: Props) {
  return <ErrorBoundaryClass {...props} />;
}
