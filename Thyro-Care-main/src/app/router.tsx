import { Suspense, lazy } from "react";
import { createBrowserRouter, Outlet } from "react-router";
import {
  ScrollToTop,
  PageLoader,
  ProtectedRoute,
  RoleProtectedRoute,
  RouteErrorPage,
} from "@/components/common";
import { PublicLayout, AuthLayout, DashboardLayout } from "@/layouts";
import { ROUTES } from "@/constants/routes";

const LandingPage = lazy(() =>
  import("@/pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() =>
  import("@/pages/RegisterPage").then((m) => ({ default: m.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import("@/pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import("@/pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const VerifyEmailPage = lazy(() =>
  import("@/pages/VerifyEmailPage").then((m) => ({ default: m.VerifyEmailPage })),
);
const PrivacyPage = lazy(() =>
  import("@/pages/legal/PrivacyPage").then((m) => ({ default: m.PrivacyPage })),
);
const TermsPage = lazy(() =>
  import("@/pages/legal/TermsPage").then((m) => ({ default: m.TermsPage })),
);
const MedicalDisclaimerPage = lazy(() =>
  import("@/pages/legal/MedicalDisclaimerPage").then((m) => ({
    default: m.MedicalDisclaimerPage,
  })),
);
const EmergencyPage = lazy(() =>
  import("@/pages/EmergencyPage").then((m) => ({ default: m.EmergencyPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const ChatPage = lazy(() => import("@/pages/ChatPage").then((m) => ({ default: m.ChatPage })));
const MedicationPage = lazy(() =>
  import("@/pages/MedicationPage").then((m) => ({ default: m.MedicationPage })),
);
const DietPage = lazy(() => import("@/pages/DietPage").then((m) => ({ default: m.DietPage })));
const SymptomsPage = lazy(() =>
  import("@/pages/SymptomsPage").then((m) => ({ default: m.SymptomsPage })),
);
const FollowUpPage = lazy(() =>
  import("@/pages/FollowUpPage").then((m) => ({ default: m.FollowUpPage })),
);
const AnalyticsPage = lazy(() =>
  import("@/pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })),
);
const ResourcesPage = lazy(() =>
  import("@/pages/ResourcesPage").then((m) => ({ default: m.ResourcesPage })),
);
const ProfilePage = lazy(() =>
  import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const UnauthorizedPage = lazy(() =>
  import("@/pages/UnauthorizedPage").then((m) => ({ default: m.UnauthorizedPage })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);

const KnowledgeManagementPage = lazy(() =>
  import("@/pages/admin/KnowledgeManagementPage").then((m) => ({
    default: m.KnowledgeManagementPage,
  })),
);
const KnowledgeEditorPage = lazy(() =>
  import("@/pages/admin/KnowledgeEditorPage").then((m) => ({ default: m.KnowledgeEditorPage })),
);
const KnowledgeVersionPage = lazy(() =>
  import("@/pages/admin/KnowledgeVersionPage").then((m) => ({ default: m.KnowledgeVersionPage })),
);
const MedicalReviewQueuePage = lazy(() =>
  import("@/pages/medical/MedicalReviewQueuePage").then((m) => ({
    default: m.MedicalReviewQueuePage,
  })),
);
const MedicalReviewDetailPage = lazy(() =>
  import("@/pages/medical/MedicalReviewDetailPage").then((m) => ({
    default: m.MedicalReviewDetailPage,
  })),
);

function RootLayout() {
  return (
    <>
      <ScrollToTop />
      <div className="min-h-screen bg-background" style={{ fontFamily: "'Inter', sans-serif" }}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </div>
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: ROUTES.HOME, element: <LandingPage /> },
          { path: ROUTES.EMERGENCY, element: <EmergencyPage /> },
          { path: ROUTES.PRIVACY, element: <PrivacyPage /> },
          { path: ROUTES.TERMS, element: <TermsPage /> },
          { path: ROUTES.MEDICAL_DISCLAIMER, element: <MedicalDisclaimerPage /> },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          { path: ROUTES.LOGIN, element: <LoginPage /> },
          { path: ROUTES.REGISTER, element: <RegisterPage /> },
          { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
          { path: ROUTES.RESET_PASSWORD, element: <ResetPasswordPage /> },
          { path: ROUTES.VERIFY_EMAIL, element: <VerifyEmailPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
              { path: ROUTES.CHAT, element: <ChatPage /> },
              { path: ROUTES.MEDICATIONS, element: <MedicationPage /> },
              { path: ROUTES.DIET, element: <DietPage /> },
              { path: ROUTES.SYMPTOMS, element: <SymptomsPage /> },
              { path: ROUTES.FOLLOW_UPS, element: <FollowUpPage /> },
              { path: ROUTES.ANALYTICS, element: <AnalyticsPage /> },
              { path: ROUTES.RESOURCES, element: <ResourcesPage /> },
              { path: ROUTES.PROFILE, element: <ProfilePage /> },
            ],
          },
        ],
      },
      {
        element: <RoleProtectedRoute allowedRoles={["admin"]} />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              { path: ROUTES.ADMIN_KNOWLEDGE, element: <KnowledgeManagementPage /> },
              { path: ROUTES.ADMIN_KNOWLEDGE_NEW, element: <KnowledgeEditorPage /> },
              { path: ROUTES.ADMIN_KNOWLEDGE_DETAIL, element: <KnowledgeEditorPage /> },
              { path: ROUTES.ADMIN_KNOWLEDGE_VERSION, element: <KnowledgeVersionPage /> },
            ],
          },
        ],
      },
      {
        element: <RoleProtectedRoute allowedRoles={["medical_expert"]} />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              { path: ROUTES.MEDICAL_REVIEW, element: <MedicalReviewQueuePage /> },
              { path: ROUTES.MEDICAL_KNOWLEDGE, element: <KnowledgeManagementPage /> },
              { path: ROUTES.MEDICAL_KNOWLEDGE_VERSION, element: <KnowledgeVersionPage /> },
              { path: ROUTES.MEDICAL_REVIEW_DETAIL, element: <MedicalReviewDetailPage /> },
            ],
          },
        ],
      },
      { path: ROUTES.UNAUTHORIZED, element: <UnauthorizedPage /> },
      { path: ROUTES.NOT_FOUND, element: <NotFoundPage /> },
    ],
  },
]);
