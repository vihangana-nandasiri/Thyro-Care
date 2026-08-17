import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "style">;

export function Card({ children, className = "", style, ...rest }: CardProps) {
  return (
    <div
      className={`bg-card rounded-2xl shadow-sm border border-border p-5 ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}
