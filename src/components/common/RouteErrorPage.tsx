import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { Btn } from "@/components/common/Button";
import { BrandLogo } from "@/components/common/BrandLogo";
import { ROUTES } from "@/constants/routes";

/**
 * Safe route-level error UI. Stack traces stay in the developer console only.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  // Preserve developer visibility without exposing details to users
  if (error) {
    console.error("[RouteError]", error);
  }

  const message = isRouteErrorResponse(error)
    ? "Something went wrong while loading this page."
    : "An unexpected error occurred.";

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-6"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <BrandLogo size="md" className="mb-6" />
      <h1
        className="text-2xl font-bold text-foreground mb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        Unable to load page
      </h1>
      <p className="text-muted-foreground text-center max-w-md mb-6">{message}</p>
      <Btn onClick={() => navigate(ROUTES.HOME)}>Return Home</Btn>
    </div>
  );
}
