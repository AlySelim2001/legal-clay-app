import "@vly-ai/integrations";
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { SupabaseAuthProvider } from "@/contexts/SupabaseAuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { QueryProvider } from "@/contexts/QueryProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import React, { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";

// Lazy load route components
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// App pages — Legacy
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Cases = lazy(() => import("./pages/Cases.tsx"));
const CaseDetail = lazy(() => import("./pages/CaseDetail.tsx"));
const Clients = lazy(() => import("./pages/Clients.tsx"));
const ClientDetail = lazy(() => import("./pages/ClientDetail.tsx"));
const CalendarPage = lazy(() => import("./pages/CalendarPage.tsx"));
const Deadlines = lazy(() => import("./pages/Deadlines.tsx"));
const Defenses = lazy(() => import("./pages/Defenses.tsx"));
const Archive = lazy(() => import("./pages/Archive.tsx"));
const LegalFramework = lazy(() => import("./pages/LegalFramework.tsx"));
const AdminTeam = lazy(() => import("./pages/AdminTeam.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const AIAgent = lazy(() => import("./pages/AIAgent.tsx"));
const AIAgents = lazy(() => import("./pages/AIAgents.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const ColomboAgent = lazy(() => import("./pages/ColomboAgent.tsx"));
const SocialSearch = lazy(() => import("./pages/SocialSearch.tsx"));
const OppositionGuide = lazy(() => import("./pages/OppositionGuide.tsx"));

// Enterprise pages
const EnterpriseDashboard = lazy(() => import("./pages/EnterpriseDashboard.tsx"));
const EnterpriseCases = lazy(() => import("./pages/EnterpriseCases.tsx"));
const EnterpriseCaseDetail = lazy(() => import("./pages/EnterpriseCaseDetail.tsx"));
const EnterprisePersons = lazy(() => import("./pages/EnterprisePersons.tsx"));
const EnterpriseActions = lazy(() => import("./pages/EnterpriseActions.tsx"));
const EnterpriseAuditLog = lazy(() => import("./pages/EnterpriseAuditLog.tsx"));
const EnterpriseExcelImport = lazy(() => import("./pages/EnterpriseExcelImport.tsx"));

import { AppLayout } from "@/components/AppLayout";
import { RouteLoading } from "@/components/RouteLoading";
import { RouteSyncer } from "@/components/RouteSyncer";

/** Silent error boundary for VlyToolbar */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard for runtime errors */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6 font-arabic" dir="rtl">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">خطأ في تحميل النظام</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-start text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>        <SupabaseAuthProvider>
        <QueryProvider>
        <ThemeProvider>
        <I18nProvider>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/app/dashboard" />}
              />

              {/* Protected app routes with AppLayout */}
              <Route
                path="/app"
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                {/* Enterprise routes (new data model) */}
                <Route path="dashboard" element={<EnterpriseDashboard />} />
                <Route path="cases" element={<EnterpriseCases />} />
                <Route path="cases/:caseCode" element={<EnterpriseCaseDetail />} />
                <Route path="persons" element={<EnterprisePersons />} />
                <Route path="actions" element={<EnterpriseActions />} />
                <Route path="audit" element={<EnterpriseAuditLog />} />
                <Route path="import" element={<EnterpriseExcelImport />} />
                {/* Legacy routes preserved */}
                <Route path="legacy/dashboard" element={<Dashboard />} />
                <Route path="legacy/cases" element={<Cases />} />
                <Route path="legacy/cases/:caseCode" element={<CaseDetail />} />
                <Route path="clients" element={<Clients />} />
                <Route path="clients/:clientCode" element={<ClientDetail />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="deadlines" element={<Deadlines />} />
                <Route path="defenses" element={<Defenses />} />
                <Route path="archive" element={<Archive />} />
                <Route path="legal-framework" element={<LegalFramework />} />
                <Route path="settings" element={<Settings />} />
                <Route path="ai-agent" element={<AIAgent />} />
                <Route path="ai-agents" element={<AIAgents />} />
                <Route path="about" element={<About />} />
                <Route path="ai-agent/colombo" element={<ColomboAgent />} />
                <Route path="social-search" element={<SocialSearch />} />
                <Route path="guides/opposition" element={<OppositionGuide />} />
              </Route>

              {/* Admin routes */}
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route path="team" element={<AdminTeam />} />
              </Route>

              {/* Legacy redirect */}
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<Dashboard />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
        </I18nProvider>
        </ThemeProvider>
        </QueryProvider>
      </SupabaseAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
