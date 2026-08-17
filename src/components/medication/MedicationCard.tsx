import { CheckCircle, Plus, X, AlertCircle } from "lucide-react";
import { Card, Badge } from "@/components/common";
import { BLUE, TEAL } from "@/constants/colors";
import type { MedicationLogStatus } from "@/types/medication";

export function MedicationCard({
  name,
  dose,
  time,
  instruction,
  logStatus,
  busy,
  onTaken,
  onMissed,
  onSkipped,
}: {
  name: string;
  dose: string;
  time: string;
  instruction?: string | null;
  logStatus: MedicationLogStatus | null;
  busy?: boolean;
  onTaken: () => void;
  onMissed: () => void;
  onSkipped: () => void;
}) {
  const isTaken = logStatus === "taken";
  const isMissed = logStatus === "missed";
  const isSkipped = logStatus === "skipped";

  return (
    <Card
      className={`border-l-4 transition-all ${isTaken || isSkipped ? "opacity-70" : ""}`}
      style={{ borderLeftColor: BLUE }}
    >
      <div className="flex items-center gap-4 flex-wrap">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${BLUE}18` }}
        >
          <CheckCircle className="w-6 h-6" style={{ color: BLUE }} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="font-bold text-foreground"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {name}
            </h3>
            <Badge color={isTaken ? "green" : isMissed ? "amber" : isSkipped ? "purple" : "blue"}>
              {isTaken ? "Taken" : isMissed ? "Missed" : isSkipped ? "Skipped" : "Pending"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {dose} · {time}
          </p>
          {instruction ? (
            <p className="text-xs text-muted-foreground mt-0.5">{instruction}</p>
          ) : null}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled={busy || isTaken}
            onClick={onTaken}
            aria-label={`Mark ${name} as taken`}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 ${
              isTaken ? "bg-green-100 text-green-700" : "text-white hover:opacity-90"
            }`}
            style={!isTaken ? { background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` } : {}}
          >
            {isTaken ? (
              <>
                <CheckCircle className="w-4 h-4" aria-hidden="true" /> Taken
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" aria-hidden="true" /> Taken
              </>
            )}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onMissed}
            aria-label={`Mark ${name} as missed`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-accent cursor-pointer disabled:opacity-50"
          >
            <AlertCircle className="w-4 h-4" aria-hidden="true" /> Missed
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSkipped}
            aria-label={`Mark ${name} as skipped`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-accent cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" aria-hidden="true" /> Skip
          </button>
        </div>
      </div>
    </Card>
  );
}
