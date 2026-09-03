import { useNavigate } from "react-router";
import { AlertTriangle, Phone, ChevronLeft, Shield } from "lucide-react";

import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";
import { mockEmergencyWarningSigns } from "@/data/mock";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function EmergencyPage() {
  useDocumentTitle("Emergency Support");
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-red-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Red header */}
      <div className="bg-red-600 text-white px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate(isAuthenticated ? ROUTES.DASHBOARD : ROUTES.HOME)}
            className="p-2 rounded-xl bg-red-500 hover:bg-red-400 transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              <h1
                className="text-xl font-bold"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Emergency Support
              </h1>
            </div>
            <p className="text-sm text-red-200 mt-0.5">
              For a medical emergency in Sri Lanka, call 1990 Suwa Seriya now.
            </p>
          </div>
          <div className="animate-pulse w-3 h-3 bg-red-300 rounded-full" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {/* Emergency ambulance call */}
<a
  href="tel:1990"
  aria-label="Call 1990 Suwa Seriya"
  className="flex items-center justify-center gap-3 p-6 rounded-2xl bg-red-600 text-white shadow-lg hover:bg-red-700 transition-colors"
>
  <Phone className="w-7 h-7" />
  <div className="text-center">
    <div
      className="text-lg font-bold"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      Call 1990 Suwa Seriya
    </div>
    <div className="text-xs opacity-90 mt-0.5">
      Sri Lanka emergency ambulance service
    </div>
  </div>
</a>

        {/* Warning signs */}
        <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-sm">
          <h2
            className="font-bold text-red-800 mb-4 flex items-center gap-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            <AlertTriangle className="w-5 h-5" /> Seek Immediate Help If You Experience
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {mockEmergencyWarningSigns.map((s) => (
              <div key={s} className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-red-800 font-medium">{s}</span>
              </div>
            ))}
          </div>
        </div>



        {/* Emergency contacts */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <h2
            className="font-bold text-foreground mb-3"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Personal Emergency Contacts
          </h2>
          <div className="rounded-xl bg-gray-50 border border-border p-4 text-center">
  <p className="font-semibold text-sm text-foreground">
    No personal emergency contacts available
  </p>
  <p className="text-xs text-muted-foreground mt-1">
    Use the emergency ambulance call option above.
  </p>
</div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5 inline mr-1" />
          This application cannot contact emergency services for you. For a medical emergency in Sri Lanka, call 1990 Suwa Seriya immediately. This is not a diagnosis.
        </p>
      </div>
    </div>
  );
}
