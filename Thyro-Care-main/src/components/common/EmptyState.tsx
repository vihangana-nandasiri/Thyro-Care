import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-3 py-12 px-4 ${className}`}
      role="status"
    >
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
        {icon ?? <Inbox className="w-6 h-6" aria-hidden="true" />}
      </div>
      <h3
        className="text-lg font-bold text-foreground"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {title}
      </h3>
      {description ? <p className="text-sm text-muted-foreground max-w-sm">{description}</p> : null}
      {action}
    </div>
  );
}
