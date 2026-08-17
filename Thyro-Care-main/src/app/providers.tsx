/**
 * Application-level providers.
 * Phase 2: mock AuthProvider. Phase 3: ErrorBoundary + Toast foundation.
 * Temporary mock authentication for routing demonstration. Replace during Phase 6.
 */
import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ToastProvider } from "@/components/common/Toast";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        {children}
        <ToastProvider />
      </AuthProvider>
    </ErrorBoundary>
  );
}
