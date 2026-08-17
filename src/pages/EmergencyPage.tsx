import { useNavigate } from "react-router";
import { AlertTriangle, Phone, ChevronLeft, MessageCircle, Shield } from "lucide-react";
import { Avatar } from "@/components/common";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";
import {
  mockEmergencyCallOptions,
  mockEmergencyWarningSigns,
  mockEmergencyContacts,
} from "@/data/mock";
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
              If you are in immediate danger, call 911 now
            </p>
          </div>
          <div className="animate-pulse w-3 h-3 bg-red-300 rounded-full" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {/* Emergency call buttons */}
        <div className="grid sm:grid-cols-3 gap-4">
          {mockEmergencyCallOptions.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.label}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl text-white shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer border-2 border-white/20"
                style={{ background: c.color }}
              >
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                  <Icon className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <div
                    className="text-lg font-bold"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {c.label}
                  </div>
                  <div className="text-xs opacity-80 whitespace-pre-line mt-0.5">{c.sub}</div>
                </div>
              </button>
            );
          })}
        </div>

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

        {/* AI Emergency Guidance */}
        <div className="bg-white rounded-2xl border border-orange-200 p-5 shadow-sm">
          <h2
            className="font-bold text-foreground mb-3 flex items-center gap-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            <MessageCircle className="w-5 h-5 text-orange-500" /> AI Emergency Guidance
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Describe your symptoms and get immediate AI guidance while you wait for help.
          </p>
          <div className="flex gap-2">
            <input
              placeholder="Describe your emergency symptoms..."
              className="flex-1 rounded-xl border border-border bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <button className="px-4 py-3 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition cursor-pointer">
              Get Help
            </button>
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
          <div className="space-y-3">
            {mockEmergencyContacts.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-border"
              >
                <Avatar name={c.name} size={10} />
                <div className="flex-1">
                  <div className="font-semibold text-sm text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.relation} · {c.phone}
                  </div>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition cursor-pointer">
                  <Phone className="w-3.5 h-3.5" /> Call
                </button>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5 inline mr-1" />
          ThyroCare AI emergency guidance is supplemental only. This application cannot contact
          emergency services for you. Always call emergency services for life-threatening
          situations. This is not a diagnosis.
        </p>
      </div>
    </div>
  );
}
