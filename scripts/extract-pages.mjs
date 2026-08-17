import fs from "fs";

const lines = fs.readFileSync("src/app/App.tsx", "utf8").split(/\r?\n/);

// 1-based line starts from inspection; end = next start - 1
const ranges = [
  ["LandingScreen", "LandingPage", "LandingPage.tsx", 58, 188],
  ["LoginScreen", "LoginPage", "LoginPage.tsx", 189, 265],
  ["RegisterScreen", "RegisterPage", "RegisterPage.tsx", 266, 349],
  ["DashboardScreen", "DashboardPage", "DashboardPage.tsx", 350, 444],
  ["ChatScreen", "ChatPage", "ChatPage.tsx", 445, 592],
  ["MedicationScreen", "MedicationPage", "MedicationPage.tsx", 593, 687],
  ["DietScreen", "DietPage", "DietPage.tsx", 688, 788],
  ["SymptomsScreen", "SymptomsPage", "SymptomsPage.tsx", 789, 889],
  ["FollowupScreen", "FollowUpPage", "FollowUpPage.tsx", 890, 967],
  ["ProgressScreen", "AnalyticsPage", "AnalyticsPage.tsx", 968, 1056],
  ["EducationScreen", "ResourcesPage", "ResourcesPage.tsx", 1057, 1137],
  ["ProfileScreen", "ProfilePage", "ProfilePage.tsx", 1138, 1246],
  ["EmergencyScreen", "EmergencyPage", "EmergencyPage.tsx", 1247, 1352],
];

const pageImports = {
  LandingPage: `import {
  Phone, Heart, ArrowRight, MessageCircle, Shield,
} from "lucide-react";
import { Card, Badge, Btn, BrandLogo } from "@/components/common";
import { BLUE, TEAL } from "@/constants/colors";
import type { SetScreen } from "@/types";
import { mockLandingFeatures, mockLandingStats } from "@/data/mock";
`,
  LoginPage: `import { useState } from "react";
import { User, Star } from "lucide-react";
import { Btn, Input, BrandLogo } from "@/components/common";
import { BLUE, TEAL } from "@/constants/colors";
import type { SetScreen } from "@/types";
import { mockUser } from "@/data/mock";
`,
  RegisterPage: `import { useState } from "react";
import { ChevronLeft, ArrowRight } from "lucide-react";
import { Card, Btn, Input, BrandLogo } from "@/components/common";
import { BLUE, TEAL } from "@/constants/colors";
import type { SetScreen } from "@/types";
`,
  DashboardPage: `import { CheckCircle, Clock } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, Badge } from "@/components/common";
import { DashboardLayout } from "@/layouts";
import { BLUE, GRAY } from "@/constants/colors";
import type { Screen, SetScreen } from "@/types";
import {
  mockDashboardCards,
  mockDashboardQuickStats,
  mockDashboardWeekData,
  mockDashboardReminders,
} from "@/data/mock";
`,
  ChatPage: `import { useState, useRef, useEffect } from "react";
import {
  AlertTriangle, Send, Mic, Paperclip, Heart, Plus,
} from "lucide-react";
import { Card, Btn, Avatar, BrandLogo } from "@/components/common";
import { DashboardLayout } from "@/layouts";
import { BLUE, TEAL } from "@/constants/colors";
import type { ChatMsg, SetScreen } from "@/types";
import {
  mockUser,
  mockInitialMessages,
  mockQuickActions,
  mockSuggestions,
  mockRecentChats,
  mockChatReply,
} from "@/data/mock";
`,
  MedicationPage: `import { useState } from "react";
import { AlertTriangle, CheckCircle, Plus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, Badge, Btn } from "@/components/common";
import { DashboardLayout } from "@/layouts";
import { TEAL, GREEN } from "@/constants/colors";
import type { SetScreen } from "@/types";
import {
  mockMedications,
  mockAdherenceData,
  mockPrescriptionInfo,
  mockInitialTaken,
} from "@/data/mock";
`,
  DietPage: `import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { Card, Badge } from "@/components/common";
import { DashboardLayout } from "@/layouts";
import { BLUE, TEAL, GREEN } from "@/constants/colors";
import { iodineSeverityLabels } from "@/constants/status";
import type { SetScreen } from "@/types";
import {
  mockFoodsToEat,
  mockFoodsToAvoid,
  mockMeals,
  mockDietStatus,
} from "@/data/mock";
`,
  SymptomsPage: `import { useState } from "react";
import { AlertTriangle, Stethoscope, Heart, CheckCircle } from "lucide-react";
import { Card, Btn } from "@/components/common";
import { DashboardLayout } from "@/layouts";
import { BLUE, TEAL, GREEN, AMBER, RED } from "@/constants/colors";
import { severityLabels } from "@/constants/status";
import type { SetScreen } from "@/types";
import { mockSymptoms, mockSymptomRecommendations } from "@/data/mock";
`,
  FollowUpPage: `import { Plus, CheckCircle, Calendar, AlertTriangle } from "lucide-react";
import { Card, Badge, Btn } from "@/components/common";
import { DashboardLayout } from "@/layouts";
import { BLUE, TEAL } from "@/constants/colors";
import type { SetScreen } from "@/types";
import {
  mockAppointments,
  mockTshHistory,
  mockNextAppointment,
} from "@/data/mock";
`,
  AnalyticsPage: `import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Card } from "@/components/common";
import { DashboardLayout } from "@/layouts";
import { BLUE, TEAL, GRAY } from "@/constants/colors";
import { moodLabels } from "@/constants/status";
import type { SetScreen } from "@/types";
import {
  mockWeeklyHealthData,
  mockWellnessBreakdown,
  mockMoodEmojis,
  mockProgressStats,
  mockHealthScore,
} from "@/data/mock";
`,
  ResourcesPage: `import { useState } from "react";
import { Clock, Play, Info } from "lucide-react";
import { Card, Badge } from "@/components/common";
import { DashboardLayout } from "@/layouts";
import { BLUE, TEAL } from "@/constants/colors";
import type { SetScreen } from "@/types";
import { mockArticles, mockFaqs, mockVideos } from "@/data/mock";
`,
  ProfilePage: `import { useState } from "react";
import { Camera, Edit2 } from "lucide-react";
import { Card, Badge, Btn } from "@/components/common";
import { DashboardLayout } from "@/layouts";
import { BLUE, TEAL } from "@/constants/colors";
import type { SetScreen } from "@/types";
import { mockUser } from "@/data/mock";
`,
  EmergencyPage: `import {
  AlertTriangle, Phone, ChevronLeft, MessageCircle, Shield,
} from "lucide-react";
import { Avatar } from "@/components/common";
import type { SetScreen } from "@/types";
import {
  mockEmergencyCallOptions,
  mockEmergencyWarningSigns,
  mockEmergencyContacts,
} from "@/data/mock";
`,
};

for (const [oldName, newName, file, start, end] of ranges) {
  let body = lines
    .slice(start - 1, end)
    .join("\n")
    .trimEnd();
  // Drop trailing blank / comment separators
  body = body.replace(/\n\/\/ ─+.*$/s, "").trimEnd();
  body = body.replace("function " + oldName, "export function " + newName);
  body = body.replace(
    /\{ setScreen \}: \{ setScreen: \(s: Screen\) => void \}/g,
    "{ setScreen }: { setScreen: SetScreen }",
  );

  body = body.replace(
    /<div className="w-8 h-8 rounded-xl flex items-center justify-center(?: flex-shrink-0)?" style=\{\{ background: `linear-gradient\(135deg, \$\{BLUE\}, \$\{TEAL\}\)` \}\}>\s*<Heart className="w-4 h-4 text-white" \/>\s*<\/div>/g,
    '<BrandLogo size="sm" />',
  );
  body = body.replace(
    /<div className="w-9 h-9 rounded-xl flex items-center justify-center" style=\{\{ background: `linear-gradient\(135deg, \$\{BLUE\}, \$\{TEAL\}\)` \}\}>\s*<Heart className="w-5 h-5 text-white" \/>\s*<\/div>/g,
    '<BrandLogo size="md" />',
  );
  body = body.replace(
    /<div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style=\{\{ background: `linear-gradient\(135deg, \$\{BLUE\}, \$\{TEAL\}\)` \}\}>\s*<Heart className="w-6 h-6 text-white" \/>\s*<\/div>/g,
    '<BrandLogo size="lg" className="mx-auto mb-4" />',
  );

  const out = pageImports[newName] + "\n" + body + "\n";
  fs.writeFileSync("src/pages/" + file, out, "utf8");
  const lineCount = out.split("\n").length;
  console.log(
    `Wrote ${file} (${lineCount} lines) endsWith: ${body.slice(-40).replace(/\n/g, "\\n")}`,
  );
}

fs.writeFileSync(
  "src/pages/index.ts",
  ranges.map(([, name]) => `export { ${name} } from "./${name}";`).join("\n") + "\n",
  "utf8",
);
console.log("Done");
