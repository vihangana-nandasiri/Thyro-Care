import { useMemo } from "react";
import { useNavigate } from "react-router";
import { CheckCircle, Clock } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, Badge } from "@/components/common";
import { BLUE, GRAY } from "@/constants/colors";
import { SCREEN_PATH } from "@/constants/routes";
import {
  mockDashboardCards,
  mockDashboardQuickStats,
  mockDashboardWeekData,
  mockDashboardReminders,
} from "@/data/mock";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useMedications } from "@/hooks/useMedications";
import { useAppointments } from "@/hooks/useAppointments";
import { useSymptoms } from "@/hooks/useSymptoms";

export function DashboardPage() {
  useDocumentTitle("Dashboard");
  const navigate = useNavigate();
  const { todaySchedule, adherence, loading: medLoading } = useMedications();
  const { upcoming, loading: apptLoading } = useAppointments();
  const { active: activeSymptoms, symptoms: allSymptoms, loading: symLoading } = useSymptoms();
  const weekData = mockDashboardWeekData;

  const quickStats = useMemo(() => {
    return mockDashboardQuickStats.map((s) => {
      if (s.label !== "Medication Adherence") return s;
      if (medLoading) return { ...s, value: "…" };
      const pct = adherence?.adherence_percentage;
      return {
        ...s,
        value: pct === null || pct === undefined ? "—" : `${Math.round(pct)}%`,
      };
    });
  }, [adherence, medLoading]);

  const cards = useMemo(() => {
    const pending = todaySchedule.filter((i) => !i.log_status).length;
    const taken = todaySchedule.filter((i) => i.log_status === "taken").length;
    const next = todaySchedule.find((i) => !i.log_status);
    const nextAppt = upcoming[0];
    return mockDashboardCards.map((c) => {
      if (c.id === "medication") {
        if (medLoading) {
          return { ...c, value: "Loading…", sub: "Today's schedule" };
        }
        if (todaySchedule.length === 0) {
          return { ...c, value: "No doses today", sub: "Open Medications" };
        }
        if (next) {
          return {
            ...c,
            value: `${next.medication_name}`,
            sub: `${next.scheduled_local_time} · ${pending} pending`,
          };
        }
        return {
          ...c,
          value: `${taken} of ${todaySchedule.length} taken`,
          sub: "Today's schedule complete",
        };
      }
      if (c.id === "followup") {
        if (apptLoading) {
          return { ...c, value: "Loading…", sub: "Follow-ups" };
        }
        if (!nextAppt) {
          return { ...c, value: "No upcoming", sub: "Open Follow-ups" };
        }
        const when = new Date(nextAppt.scheduled_start).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        return {
          ...c,
          value: nextAppt.title,
          sub: `${when} · ${upcoming.length} upcoming`,
        };
      }
      if (c.id === "symptoms") {
        if (symLoading) {
          return { ...c, value: "Loading…", sub: "Symptom tracking" };
        }
        if (activeSymptoms.length === 0 && allSymptoms.length === 0) {
          return { ...c, value: "No entries yet", sub: "Open Symptoms" };
        }
        const recent = allSymptoms[0];
        const when = recent
          ? new Date(recent.started_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "—";
        return {
          ...c,
          value: `${activeSymptoms.length} active`,
          sub: recent ? `Last: ${when}` : "Open Symptoms",
        };
      }
      return c;
    });
  }, [todaySchedule, medLoading, upcoming, apptLoading, activeSymptoms, allSymptoms, symLoading]);

  return (
    <>
      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {quickStats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${s.color}18` }}
              >
                <Icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <div
                  className="text-2xl font-extrabold text-foreground"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {s.value}
                  <span className="text-sm font-normal text-muted-foreground">{s.unit}</span>
                </div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Feature cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => navigate(SCREEN_PATH[c.id] ?? "/dashboard")}
              className="text-left bg-white rounded-2xl border border-border p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                style={{ background: c.bg }}
              >
                <Icon className="w-5 h-5" style={{ color: c.color }} />
              </div>
              <div
                className="font-bold text-sm text-foreground"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {c.label}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Bottom grid: chart + alerts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3
              className="font-bold text-foreground"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Weekly Health Score
            </h3>
            <Badge color="blue">This week</Badge>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={weekData} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: GRAY }} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: GRAY }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "none",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke={BLUE}
                strokeWidth={2.5}
                fill="url(#scoreGrad)"
                dot={{ fill: BLUE, strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3
            className="font-bold text-foreground mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Today&apos;s Reminders
          </h3>
          <div className="space-y-3">
            {mockDashboardReminders.map((r) => (
              <div key={r.task} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${r.done ? "bg-green-100" : "bg-muted"}`}
                >
                  {r.done ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium ${r.done ? "line-through text-muted-foreground" : "text-foreground"}`}
                  >
                    {r.task}
                  </div>
                  <div className="text-xs text-muted-foreground">{r.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
