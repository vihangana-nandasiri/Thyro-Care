import { useNavigate } from "react-router";
import { AlertTriangle } from "lucide-react";
import { ROUTES } from "@/constants/routes";

export function ChatSafetyBanner() {
  const navigate = useNavigate();

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
      <span className="text-xs text-red-700 flex-1">
        <strong>Emergency:</strong> If experiencing chest pain, severe breathing difficulty, or high
        fever — call 911 immediately or visit your nearest ER.
      </span>
      <button
        onClick={() => navigate(ROUTES.EMERGENCY)}
        className="text-xs font-bold text-red-600 hover:underline cursor-pointer whitespace-nowrap"
      >
        Emergency Help
      </button>
    </div>
  );
}
