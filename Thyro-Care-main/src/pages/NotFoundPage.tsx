import { useNavigate } from "react-router";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Btn, BrandLogo } from "@/components/common";
import { ROUTES } from "@/constants/routes";

export function NotFoundPage() {
  useDocumentTitle("Page not found");
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-6"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <BrandLogo size="md" className="mb-6" />
      <p
        className="text-5xl font-extrabold text-foreground mb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        404
      </p>
      <h1
        className="text-2xl font-bold text-foreground mb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        Page not found
      </h1>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        The page you requested does not exist or has been moved.
      </p>
      <Btn onClick={() => navigate(ROUTES.HOME)}>Return Home</Btn>
    </div>
  );
}
