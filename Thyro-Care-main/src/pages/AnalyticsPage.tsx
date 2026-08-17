import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card } from "@/components/common";
import { BLUE, TEAL, GRAY } from "@/constants/colors";
import { moodLabels } from "@/constants/status";
import {
  mockWeeklyHealthData,
  mockWellnessBreakdown,
  mockMoodEmojis,
  mockProgressStats,
  mockHealthScore,
} from "@/data/mock";

export function AnalyticsPage() {
  useDocumentTitle("Analytics");
  const weeklyData = mockWeeklyHealthData;
  const pieData = mockWellnessBreakdown;
  const moods = mockMoodEmojis;

  return (
    <>
      {/* Score hero */}
      <div
        className="rounded-3xl p-6 mb-5 text-white"
        style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="opacity-80 text-sm">Weekly Health Score</p>
            <div
              className="text-6xl font-extrabold mt-1"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {mockHealthScore.value}
              <span className="text-3xl opacity-70">/{mockHealthScore.max}</span>
            </div>
            <p className="opacity-80 text-sm mt-1">{mockHealthScore.deltaLabel}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {mockProgressStats.map((s) => (
              <div key={s.label} className="bg-white/20 rounded-xl px-3 py-2 text-center">
                <div className="text-lg">{s.icon}</div>
                <div className="text-sm font-bold">{s.value}</div>
                <div className="text-xs opacity-70">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <h3
            className="font-bold text-foreground mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Weekly Health Trend
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyData} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="progGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
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
                fill="url(#progGrad)"
                dot={{ fill: BLUE, r: 4, strokeWidth: 0 }}
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
            Wellness Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "none" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <span className="font-bold text-foreground">{d.value}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <h3
            className="font-bold text-foreground mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Mood Tracking This Week
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {weeklyData.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <span className="text-3xl">{moods[d.mood - 1]}</span>
                <span className="text-xs font-semibold text-foreground">{d.day}</span>
                <span className="text-xs text-muted-foreground">{moodLabels[d.mood - 1]}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
