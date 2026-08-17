import { forwardRef, type TextareaHTMLAttributes } from "react";

type TextareaProps = {
  label?: string;
  error?: string;
  hint?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    id,
    label,
    name,
    error,
    hint,
    className = "",
    rows = 5,
    "aria-describedby": ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const areaId = id ?? name;
  const errorId = error && areaId ? `${areaId}-error` : undefined;
  const hintId = hint && areaId ? `${areaId}-hint` : undefined;
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={areaId} className="block text-sm font-semibold text-foreground">
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={areaId}
        name={name}
        rows={rows}
        aria-invalid={Boolean(error) || rest["aria-invalid"]}
        aria-describedby={describedBy}
        className={`w-full rounded-xl border bg-input-background py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition disabled:opacity-50 ${
          error ? "border-red-400" : "border-border"
        } ${className}`}
        {...rest}
      />
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
