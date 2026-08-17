import { useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Sidebar, MobileMenuButton, SkipLink } from "./Sidebar";
import { TopBar } from "./TopBar";
import { resolveRouteTitle } from "@/constants/routes";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const title = resolveRouteTitle(pathname);
  useDocumentTitle(title.replace(/👋/g, "").trim() || "Dashboard");

  return (
    <>
      <SkipLink />
      <div className="flex min-h-screen bg-background">
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            title={title}
            leading={<MobileMenuButton onClick={() => setMobileOpen(true)} />}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-y-auto p-4 sm:p-6 outline-none"
          >
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
