import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Bell, Search } from "lucide-react";
import { Avatar } from "@/components/common";
import { mockNotificationCount } from "@/data/mock";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";

export function TopBar({ title, leading }: { title: string; leading?: ReactNode }) {
  const [notifs, setNotifs] = useState(mockNotificationCount);
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = user?.full_name ?? "Account";

  return (
    <header className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 bg-card border-b border-border sticky top-0 z-10">
      {leading}
      <h1
        className="text-base sm:text-lg font-bold text-foreground flex-1 min-w-0 truncate"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {title}
      </h1>
      <div className="relative hidden sm:block">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          aria-hidden="true"
        />
        <label className="sr-only" htmlFor="topbar-search">
          Search
        </label>
        <input
          id="topbar-search"
          placeholder="Search..."
          className="pl-9 pr-4 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-40 lg:w-48"
        />
      </div>
      <button
        type="button"
        className="relative p-2 rounded-xl hover:bg-accent transition text-muted-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={() => setNotifs(0)}
        aria-label={notifs > 0 ? `Notifications, ${notifs} unread` : "Notifications"}
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {notifs > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {notifs}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => navigate(ROUTES.PROFILE)}
        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full"
        aria-label={`Open profile for ${displayName}`}
      >
        <Avatar name={displayName} size={9} />
      </button>
    </header>
  );
}
