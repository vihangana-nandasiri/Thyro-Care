import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type BtnProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "teal";
  size?: "sm" | "md" | "lg";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  {
    children,
    onClick,
    variant = "primary",
    size = "md",
    className = "",
    disabled = false,
    type = "button",
    ...rest
  },
  ref,
) {
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  };
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-blue-600 shadow-sm",
    secondary: "bg-secondary text-secondary-foreground hover:bg-teal-500 shadow-sm",
    ghost: "bg-transparent text-foreground hover:bg-accent border border-border",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
    teal: "bg-teal-500 text-white hover:bg-teal-600 shadow-sm",
  };
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

/** Alias matching common naming; identical to Btn. */
export const Button = Btn;
