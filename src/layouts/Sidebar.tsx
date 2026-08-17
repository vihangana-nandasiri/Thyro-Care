import { useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router";
import { ChevronRight, ChevronLeft, AlertTriangle, LogOut, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/common";
import { BLUE, TEAL } from "@/constants/colors";
import { getNavItemsForRole } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";

type SidebarProps = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
};

function NavBody({
  collapsed,
  showCollapse,
  onCollapseToggle,
  onNavigate,
}: {
  collapsed: boolean;
  showCollapse?: boolean;
  onCollapseToggle?: () => void;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const { logout, user, role } = useAuth();
  const items = getNavItemsForRole(role);
  const homePath =
    role === "admin"
      ? ROUTES.ADMIN_KNOWLEDGE
      : role === "medical_expert"
        ? ROUTES.MEDICAL_REVIEW
        : ROUTES.DASHBOARD;

  const handleLogout = async () => {
    onNavigate?.();
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            navigate(homePath);
          }}
          className="flex items-center gap-3 min-w-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
          aria-label="ThyroCare dashboard"
        >
          <BrandLogo size="sm" />
          {!collapsed && (
            <div className="leading-none text-left">
              <div
                className="font-bold text-sm text-foreground"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                ThyroCare
              </div>
              <div className="text-[10px] text-muted-foreground font-medium">AI Support</div>
            </div>
          )}
        </button>
        {showCollapse ? (
          <button
            type="button"
            onClick={onCollapseToggle}
            className="ml-auto text-muted-foreground hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>

      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto" aria-label="Main navigation">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => onNavigate?.()}
              aria-label={item.label}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isActive
                    ? "text-white shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`
              }
              style={({ isActive }) =>
                isActive ? { background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` } : undefined
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-2 pb-4 space-y-1">
        {!collapsed && user ? (
          <div className="px-3 py-2 mb-1 rounded-xl bg-muted/60">
            <p className="text-sm font-semibold text-foreground truncate">{user.full_name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
          </div>
        ) : null}
        <NavLink
          to={ROUTES.EMERGENCY}
          onClick={() => onNavigate?.()}
          aria-label="Emergency support"
          className={({ isActive }) =>
            `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
              isActive ? "bg-red-500 text-white" : "text-red-500 hover:bg-red-50"
            }`
          }
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {!collapsed && <span>Emergency</span>}
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Logout"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  );
}

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, setMobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen, setMobileOpen]);

  return (
    <>
      <aside
        className="hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 z-20"
        style={{ width: collapsed ? 64 : 220, minHeight: "100vh" }}
        aria-label="Sidebar"
      >
        <NavBody
          collapsed={collapsed}
          showCollapse
          onCollapseToggle={() => setCollapsed(!collapsed)}
        />
      </aside>

      {mobileOpen ? (
        <div className="md:hidden fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 border-0"
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 w-[220px] max-w-[85vw] bg-card border-r border-border shadow-xl flex flex-col z-10"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span
                className="font-bold text-sm text-foreground"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Menu
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-xl hover:bg-accent text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <NavBody collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="md:hidden p-2 rounded-xl hover:bg-accent text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label="Open navigation menu"
    >
      <Menu className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:text-foreground focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
    >
      Skip to main content
    </a>
  );
}
