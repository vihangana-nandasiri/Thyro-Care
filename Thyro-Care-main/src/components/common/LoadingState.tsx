type LoadingStateProps = {
  message?: string;
  className?: string;
};

/** Accessible inline loading indicator — preserves existing visual language. */
export function LoadingState({ message = "Loading…", className = "" }: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
