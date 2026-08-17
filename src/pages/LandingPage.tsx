import { useNavigate } from "react-router";
import { Phone, ArrowRight, MessageCircle, Shield } from "lucide-react";
import { Card, Badge, Btn, BrandLogo } from "@/components/common";
import { BLUE, TEAL } from "@/constants/colors";
import { ROUTES } from "@/constants/routes";
import { mockLandingFeatures, mockLandingStats } from "@/data/mock";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { env } from "@/config/env";

export function LandingPage() {
  useDocumentTitle(env.appName);
  const navigate = useNavigate();
  const features = mockLandingFeatures;

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <BrandLogo size="sm" />
            <span
              className="font-bold text-foreground"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              ThyroCare AI
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            <Btn variant="ghost" size="sm" onClick={() => navigate(ROUTES.LOGIN)}>
              Sign In
            </Btn>
            <Btn size="sm" onClick={() => navigate(ROUTES.REGISTER)}>
              Get Started
            </Btn>
            <button
              type="button"
              onClick={() => navigate(ROUTES.EMERGENCY)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <Phone className="w-3.5 h-3.5" aria-hidden="true" /> Emergency
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <Badge color="blue">AI-Powered Healthcare Support</Badge>
          <h1
            className="text-5xl font-extrabold text-foreground leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Your Recovery,
            <br />
            <span
              style={{
                background: `linear-gradient(90deg, ${BLUE}, ${TEAL})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Supported Every Step
            </span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            ThyroCare AI is your intelligent companion for life after thyroidectomy — providing
            personalized guidance, medication support, dietary advice, and 24/7 AI chat for
            differentiated thyroid cancer survivors.
          </p>
          <div className="flex flex-wrap gap-3">
            <Btn size="lg" onClick={() => navigate(ROUTES.REGISTER)}>
              Start Your Journey <ArrowRight className="w-5 h-5" />
            </Btn>
            <Btn variant="ghost" size="lg" onClick={() => navigate(ROUTES.CHAT)}>
              Try AI Chat Free
            </Btn>
          </div>
          <div className="flex items-center gap-6 pt-2">
            {mockLandingStats.map(([val, label]) => (
              <div key={label}>
                <div
                  className="text-2xl font-extrabold text-foreground"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {val}
                </div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-border">
            <img
              src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=500&fit=crop&auto=format"
              alt="Healthcare professional supporting patient"
              className="w-full h-80 object-cover"
            />
          </div>
          {/* Chat preview bubble */}
          <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl p-4 border border-border max-w-56">
            <div className="flex items-start gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
              >
                <MessageCircle className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">ThyroCare AI</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your Levothyroxine reminder: Take 100mcg with water 30 min before breakfast. ✓
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -top-3 -right-3 bg-green-500 text-white rounded-2xl shadow-xl px-4 py-2.5">
            <div className="text-xs font-bold">Health Score</div>
            <div
              className="text-2xl font-extrabold"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              87/100
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2
            className="text-3xl font-bold text-foreground mb-3"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Everything You Need to Recover Confidently
          </h2>
          <p className="text-muted-foreground">
            Comprehensive tools designed specifically for post-thyroidectomy patients
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="hover:shadow-md transition-shadow cursor-default">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${f.color}18` }}
                >
                  <Icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3
                  className="font-bold text-foreground mb-1.5"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {f.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div
          className="rounded-3xl p-10 text-center text-white"
          style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
        >
          <h2
            className="text-3xl font-bold mb-3"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Begin Your Recovery Journey Today
          </h2>
          <p className="opacity-90 mb-6 max-w-md mx-auto">
            Join thousands of thyroid cancer survivors who trust ThyroCare AI for their daily
            healthcare support.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <button
              onClick={() => navigate(ROUTES.REGISTER)}
              className="px-7 py-3.5 bg-white rounded-xl font-bold text-blue-600 hover:bg-blue-50 transition cursor-pointer"
            >
              Create Free Account
            </button>
            <button
              onClick={() => navigate(ROUTES.LOGIN)}
              className="px-7 py-3.5 bg-white/20 rounded-xl font-bold text-white border border-white/30 hover:bg-white/30 transition cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <footer className="border-t border-border px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
          <Shield className="w-3.5 h-3.5 inline mr-1" />
          <strong>Medical Disclaimer:</strong> ThyroCare AI provides informational support only and
          is not a substitute for professional medical advice, diagnosis, or treatment. Always
          consult your healthcare provider for medical decisions. In case of emergency, call 911 or
          your local emergency services immediately.
        </p>
      </footer>
    </div>
  );
}
