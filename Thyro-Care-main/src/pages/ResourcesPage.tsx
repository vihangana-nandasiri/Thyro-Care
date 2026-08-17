import { useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Clock, Play, Info } from "lucide-react";
import { Card, Badge } from "@/components/common";
import { BLUE, TEAL } from "@/constants/colors";
import { mockArticles, mockFaqs, mockVideos } from "@/data/mock";

export function ResourcesPage() {
  useDocumentTitle("Resources");
  const [tab, setTab] = useState<"articles" | "videos" | "faqs">("articles");

  const articles = mockArticles;
  const faqs = mockFaqs;

  return (
    <>
      <div className="flex gap-2 mb-5">
        {(["articles", "videos", "faqs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition cursor-pointer capitalize ${
              tab === t ? "text-white" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
            style={tab === t ? { background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` } : {}}
          >
            {t === "faqs" ? "FAQs" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "articles" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a) => (
            <Card key={a.title} className="hover:shadow-md transition-shadow cursor-pointer group">
              <div className="flex items-center gap-2 mb-3">
                <Badge color={a.badge as "blue" | "teal" | "green" | "amber" | "red" | "purple"}>
                  {a.category}
                </Badge>
                {a.new && <Badge color="green">New</Badge>}
              </div>
              <h3
                className="font-bold text-sm text-foreground leading-snug group-hover:text-primary transition"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {a.title}
              </h3>
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>{a.time}</span>
                <span className="ml-auto text-primary font-semibold">Read →</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "videos" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockVideos.map((v) => (
            <Card
              key={v.title}
              className="p-0 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
            >
              <div className="relative">
                <img src={v.thumbnail} alt={v.title} className="w-full h-40 object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition">
                  <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                    <Play className="w-5 h-5 text-primary fill-current ml-0.5" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                  {v.duration}
                </div>
              </div>
              <div className="p-4">
                <h3
                  className="font-bold text-sm text-foreground"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {v.title}
                </h3>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "faqs" && (
        <div className="max-w-2xl space-y-3">
          {faqs.map((f, i) => (
            <Card key={i}>
              <h3
                className="font-bold text-sm text-foreground mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                <Info className="w-4 h-4 inline mr-2 text-primary" />
                {f.q}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
