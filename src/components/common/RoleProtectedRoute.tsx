import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types/auth";
import { ROUTES } from "@/constants/routes";
import { PageLoader } from "@/components/common/PageLoader";

/**
 * Role-guard for ADMIN and MEDICAL_EXPERT governance routes.
 * Backend authorization remains authoritative.
 */
export function RoleProtectedRoute({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const { isAuthenticated, role, status } = useAuth();
  const location = useLocation();

  if (status === "initializing") {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
  }

  return <Outlet />;
}
