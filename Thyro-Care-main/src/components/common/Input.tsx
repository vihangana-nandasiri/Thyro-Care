import { forwardRef, type ReactNode, type ChangeEvent, type InputHTMLAttributes } from "react";

type InputProps = {
  label?: string;
  icon?: ReactNode;
  error?: string;
  onValueChange?: (v: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
    onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
  };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    type = "text",
    placeholder,
    icon,
    name,
    error,
    className = "",
    onChange,
    onValueChange,
    "aria-describedby": ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const inputId = id ?? name;
  const errorId = error && inputId ? `${inputId}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onValueChange?.(e.target.value);
  };

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-semibold text-foreground">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {icon ? (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          placeholder={placeholder}
          onChange={handleChange}
          aria-invalid={Boolean(error) || rest["aria-invalid"]}
          aria-describedby={describedBy}
          className={`w-full rounded-xl border bg-input-background py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition disabled:opacity-50 ${
            error ? "border-red-400" : "border-border"
          } ${icon ? "pl-10 pr-4" : "px-4"} ${className}`}
          {...rest}
        />
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
