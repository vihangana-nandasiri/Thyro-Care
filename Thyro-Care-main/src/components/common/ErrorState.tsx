import { AlertTriangle } from "lucide-react";
import { Btn } from "@/components/common/Button";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

/** Safe user-facing error panel — no technical details. */
export function ErrorState({
  title = "Unable to load",
  message = "Something went wrong. Please try again.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-3 py-12 px-4 ${className}`}
      role="alert"
    >
      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-red-600" aria-hidden="true" />
      </div>
      <h3
        className="text-lg font-bold text-foreground"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      {onRetry ? (
        <Btn variant="ghost" size="sm" onClick={onRetry}>
          Try again
        </Btn>
      ) : null}
    </div>
  );
}
