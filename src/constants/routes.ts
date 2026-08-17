/**
 * Centralized route path constants.
 * Use these instead of duplicating path strings across the app.
 */

export const ROUTES = {
  // Public
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  VERIFY_EMAIL: "/verify-email",
  PRIVACY: "/privacy",
  TERMS: "/terms",
  MEDICAL_DISCLAIMER: "/medical-disclaimer",
  EMERGENCY: "/emergency",

  // Patient (protected)
  DASHBOARD: "/dashboard",
  CHAT: "/chat",
  MEDICATIONS: "/medications",
  DIET: "/diet",
  SYMPTOMS: "/symptoms",
  FOLLOW_UPS: "/follow-ups",
  ANALYTICS: "/analytics",
  RESOURCES: "/resources",
  PROFILE: "/profile",

  // System
  UNAUTHORIZED: "/unauthorized",
  NOT_FOUND: "*",

  // Admin — knowledge governance (Phase 12)
  ADMIN_ROOT: "/admin",
  ADMIN_KNOWLEDGE: "/admin/knowledge",
  ADMIN_KNOWLEDGE_NEW: "/admin/knowledge/new",
  ADMIN_KNOWLEDGE_DETAIL: "/admin/knowledge/:documentId",
  ADMIN_KNOWLEDGE_VERSION: "/admin/knowledge/:documentId/versions/:versionId",

  // Medical expert — knowledge review (Phase 12)
  MEDICAL_REVIEW: "/medical-review",
  MEDICAL_REVIEW_DETAIL: "/medical-review/:documentId/:versionId",
  MEDICAL_KNOWLEDGE: "/medical-review/library",
  MEDICAL_KNOWLEDGE_VERSION: "/medical-review/library/:documentId/versions/:versionId",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/** Builds a concrete admin knowledge document detail path. */
export function adminKnowledgeDetailPath(documentId: string): string {
  return `/admin/knowledge/${documentId}`;
}

/** Builds a concrete admin knowledge version detail path. */
export function adminKnowledgeVersionPath(documentId: string, versionId: string): string {
  return `/admin/knowledge/${documentId}/versions/${versionId}`;
}

/** Builds a concrete medical library version path (restore/retire). */
export function medicalKnowledgeVersionPath(documentId: string, versionId: string): string {
  return `/medical-review/library/${documentId}/versions/${versionId}`;
}

/** Builds a concrete medical review-queue item detail path. */
export function medicalReviewDetailPath(documentId: string, versionId: string): string {
  return `/medical-review/${documentId}/${versionId}`;
}

/** Maps legacy Phase 1 screen ids to URL paths (for mock card / nav migration). */
export const SCREEN_PATH: Record<string, string> = {
  landing: ROUTES.HOME,
  login: ROUTES.LOGIN,
  register: ROUTES.REGISTER,
  emergency: ROUTES.EMERGENCY,
  dashboard: ROUTES.DASHBOARD,
  chat: ROUTES.CHAT,
  medication: ROUTES.MEDICATIONS,
  diet: ROUTES.DIET,
  symptoms: ROUTES.SYMPTOMS,
  followup: ROUTES.FOLLOW_UPS,
  progress: ROUTES.ANALYTICS,
  education: ROUTES.RESOURCES,
  profile: ROUTES.PROFILE,
};

/** TopBar / DashboardLayout titles keyed by pathname. */
export const ROUTE_TITLES: Record<string, string> = {
  [ROUTES.DASHBOARD]: "Good morning, Sarah 👋",
  [ROUTES.CHAT]: "AI Health Assistant",
  [ROUTES.MEDICATIONS]: "Medication Management",
  [ROUTES.DIET]: "Low-Iodine Diet Guide",
  [ROUTES.SYMPTOMS]: "Symptom Checker",
  [ROUTES.FOLLOW_UPS]: "Follow-up Care",
  [ROUTES.ANALYTICS]: "Health Progress",
  [ROUTES.RESOURCES]: "Educational Resources",
  [ROUTES.PROFILE]: "My Profile",
  [ROUTES.ADMIN_KNOWLEDGE]: "Knowledge Management",
  [ROUTES.ADMIN_KNOWLEDGE_NEW]: "New Knowledge Draft",
  [ROUTES.MEDICAL_REVIEW]: "Medical Review Queue",
  [ROUTES.MEDICAL_KNOWLEDGE]: "Knowledge Library",
};

/**
 * Resolves a TopBar / DashboardLayout title for a pathname, falling back to
 * prefix matching for dynamic detail routes (document/version ids) that cannot
 * be represented as exact keys in ROUTE_TITLES.
 */
export function resolveRouteTitle(pathname: string): string {
  const exact = ROUTE_TITLES[pathname];
  if (exact) return exact;
  if (pathname.startsWith("/admin/knowledge/") && pathname.includes("/versions/")) {
    return "Knowledge Version Detail";
  }
  if (pathname.startsWith("/admin/knowledge/")) {
    return "Knowledge Document";
  }
  if (pathname.startsWith("/medical-review/library/")) {
    return "Knowledge Version Detail";
  }
  if (pathname.startsWith("/medical-review/")) {
    return "Review Knowledge Content";
  }
  return "ThyroCare AI";
}
