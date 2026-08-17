/** Full-page Suspense fallback with accessible live region. */
export function PageLoader() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin"
        aria-hidden="true"
      />
      <span className="sr-only">Loading page</span>
      <p className="text-sm text-muted-foreground" aria-hidden="true">
        Loading…
      </p>
    </div>
  );
}
