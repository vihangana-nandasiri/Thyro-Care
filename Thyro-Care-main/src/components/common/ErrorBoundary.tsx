import { Component, type ErrorInfo, type ReactNode } from "react";
import { Btn } from "@/components/common/Button";
import { BrandLogo } from "@/components/common/BrandLogo";
import { ROUTES } from "@/constants/routes";
import { env } from "@/config/env";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Global React error boundary for unexpected render failures.
 * Route-level errors remain handled by React Router errorElement.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (env.isDevelopment) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.assign(ROUTES.HOME);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen bg-background flex flex-col items-center justify-center px-6"
          style={{ fontFamily: "'Inter', sans-serif" }}
          role="alert"
        >
          <BrandLogo size="md" className="mb-6" />
          <h1
            className="text-2xl font-bold text-foreground mb-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Something went wrong
          </h1>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            An unexpected error occurred. You can reload the page or return home.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Btn onClick={this.handleReload}>Reload</Btn>
            <Btn variant="ghost" onClick={this.handleHome}>
              Return Home
            </Btn>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
