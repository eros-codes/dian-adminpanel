import React from 'react';
import { useTranslation } from 'react-i18next';

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('UI ErrorBoundary caught an error', { error, info });
    }
  }

  render() {
    if (this.state.hasError) {
      // Using a simple hook bridge component to access i18n in class component
      const Message: React.FC = () => {
        const { t } = useTranslation();
        return (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm">
            {t('common.loadError') || 'An error occurred while loading the page. Please refresh.'}
          </div>
        );
      };
      return (
        <div className="p-6">
          <Message />
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;


