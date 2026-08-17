import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/constants/routes";
import { PageLoader } from "@/components/common/PageLoader";

/**
 * Requires authentication. Waits for session bootstrap before redirecting.
 */
export function ProtectedRoute() {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();

  if (status === "initializing") {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
