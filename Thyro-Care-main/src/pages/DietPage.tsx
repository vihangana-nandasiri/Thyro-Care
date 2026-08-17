import { useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { CheckCircle } from "lucide-react";
import { Card, Badge } from "@/components/common";
import { BLUE, TEAL, GREEN } from "@/constants/colors";
import { iodineSeverityLabels } from "@/constants/status";
import { mockFoodsToEat, mockFoodsToAvoid, mockMeals, mockDietStatus } from "@/data/mock";

export function DietPage() {
  useDocumentTitle("Diet Guide");
  const [tab, setTab] = useState<"eat" | "avoid" | "meals">("eat");

  const foodsToEat = mockFoodsToEat;
  const foodsToAvoid = mockFoodsToAvoid;
  const meals = mockMeals;

  return (
    <>
      {/* Day status */}
      <div
        className="rounded-2xl p-5 mb-5 text-white"
        style={{ background: `linear-gradient(135deg, ${GREEN}, ${TEAL})` }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold opacity-90 text-sm">{mockDietStatus.title}</p>
            <h2
              className="text-2xl font-extrabold mt-1"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Day {mockDietStatus.day} of {mockDietStatus.totalDays}
            </h2>
            <p className="opacity-80 text-sm mt-1">{mockDietStatus.subtitle}</p>
          </div>
          <div className="text-right">
            <div
              className="text-3xl font-extrabold"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {mockDietStatus.adherencePct}%
            </div>
            <div className="text-sm opacity-80">Diet adherence today</div>
            <div className="mt-2 bg-white/20 rounded-full h-2 w-32 ml-auto">
              <div
                className="bg-white rounded-full h-2"
                style={{ width: `${mockDietStatus.adherencePct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(["eat", "avoid", "meals"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition cursor-pointer capitalize ${
              tab === t ? "text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
            style={tab === t ? { background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` } : {}}
          >
            {t === "eat" ? "Foods to Eat" : t === "avoid" ? "Foods to Avoid" : "Meal Planner"}
          </button>
        ))}
      </div>

      {tab === "eat" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {foodsToEat.map((f) => (
            <Card key={f.name} className="flex items-start gap-3 hover:shadow-md transition-shadow">
              <span className="text-3xl">{f.icon}</span>
              <div>
                <div
                  className="font-bold text-sm text-foreground"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {f.name}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{f.note}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "avoid" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {foodsToAvoid.map((f) => (
            <Card
              key={f.name}
              className={`flex items-start gap-3 border-l-4 ${
                f.severity === "high"
                  ? "border-l-red-500"
                  : f.severity === "medium"
                    ? "border-l-amber-400"
                    : "border-l-yellow-300"
              }`}
            >
              <span className="text-3xl">{f.icon}</span>
              <div>
                <div
                  className="font-bold text-sm text-foreground"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {f.name}
                </div>
                <Badge
                  color={f.severity === "high" ? "red" : f.severity === "medium" ? "amber" : "blue"}
                >
                  {iodineSeverityLabels[f.severity]}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "meals" && (
        <div className="grid sm:grid-cols-2 gap-4">
          {meals.map((m) => (
            <Card key={m.meal}>
              <div className="flex items-center justify-between mb-3">
                <h3
                  className="font-bold text-foreground"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {m.meal}
                </h3>
                <Badge color="teal">{m.cals} cal</Badge>
              </div>
              <ul className="space-y-1.5">
                {m.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
