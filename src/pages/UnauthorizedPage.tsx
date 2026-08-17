import { useNavigate } from "react-router";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Shield } from "lucide-react";
import { Btn, BrandLogo } from "@/components/common";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";

export function UnauthorizedPage() {
  useDocumentTitle("Unauthorized");
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-6"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <BrandLogo size="md" className="mb-6" />
      <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
        <Shield className="w-7 h-7 text-amber-600" />
      </div>
      <h1
        className="text-2xl font-bold text-foreground mb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        Unauthorized
      </h1>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        You do not have permission to view this page.
      </p>
      <Btn onClick={() => navigate(isAuthenticated ? ROUTES.DASHBOARD : ROUTES.HOME)}>
        {isAuthenticated ? "Back to Dashboard" : "Return Home"}
      </Btn>
    </div>
  );
}
