import "@vly-ai/integrations";
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { SupabaseAuthProvider } from "@/contexts/SupabaseAuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// App pages
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

import { AppLayout } from "@/components/AppLayout";

// Loading fallback
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground font-arabic">جاري التحميل...</div>
    </div>
  );
}

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
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
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

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <SupabaseAuthProvider>
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
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="cases" element={<Cases />} />
                <Route path="cases/:caseCode" element={<CaseDetail />} />
                <Route path="clients" element={<Clients />} />
                <Route path="clients/:clientCode" element={<ClientDetail />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="deadlines" element={<Deadlines />} />
                <Route path="defenses" element={<Defenses />} />
                <Route path="archive" element={<Archive />} />
                <Route path="legal-framework" element={<LegalFramework />} />
                <Route path="settings" element={<Settings />} />
                <Route path="ai-agent" element={<AIAgent />} />
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
      </SupabaseAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
