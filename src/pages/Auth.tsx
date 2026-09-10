import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Gavel, Loader2, UserRound } from "lucide-react";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/app/dashboard",
) {
  // Only allow same-app absolute paths (block open redirects like "//evil.com").
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

/**
 * /auth — the canonical sign-in gate. RequireAuth redirects unauthenticated
 * users here with `?returnTo=…`, so successful auth must land them back on
 * their intended destination, not the landing page.
 *
 * Uses the app's Supabase auth (SupabaseAuthProvider) — NOT Convex auth:
 * no Convex provider is mounted, so Convex auth hooks crash at runtime.
 */
export default function AuthPage({ redirectAfterAuth }: AuthProps) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useSupabaseAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in → go straight to the destination.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(
        signInError.message.includes("Invalid login")
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
          : signInError.message,
      );
      setIsLoading(false);
      return;
    }

    navigate(redirect, { replace: true });
  };

  // Guest access: Supabase anonymous sign-in. The session arrives through
  // SupabaseAuthProvider's onAuthStateChange, so protected routes open up
  // immediately without any extra wiring.
  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);

    const { error: guestError } = await supabase.auth.signInAnonymously();

    if (guestError) {
      setError(
        guestError.message.includes("anonymous")
          ? "الدخول كزائر غير مُفعّل حالياً — يرجى تسجيل الدخول بحسابك"
          : guestError.message,
      );
      setIsLoading(false);
      return;
    }

    navigate(redirect, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 font-arabic">
      {/* Decorative blobs */}
      <div className="absolute top-20 start-20 w-72 h-72 bg-clay-blue/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 end-20 w-72 h-72 bg-clay-rose/20 rounded-full blur-3xl" />
      <div className="absolute top-1/2 start-1/3 w-48 h-48 bg-clay-teal/15 rounded-full blur-2xl" />

      <div className="relative w-full max-w-md">
        {/* Logo card */}
        <div className="text-center mb-8">
          <div className="clay-card inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4">
            <Gavel className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            CRIM-SYS 2026
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            نظام إدارة القضايا الجنائية
          </p>
        </div>

        {/* Auth form */}
        <div className="clay-card p-8">
          <h2 className="text-lg font-bold text-foreground mb-1">
            تسجيل الدخول
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            أدخل بياناتك للوصول إلى النظام
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="auth-email"
                className="block text-sm font-medium text-foreground mb-2"
              >
                البريد الإلكتروني
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@crimsys.com"
                className="clay-input w-full px-4 py-3 text-sm bg-background"
                dir="ltr"
                style={{ textAlign: "right" }}
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-sm font-medium text-foreground mb-2"
              >
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="clay-input w-full px-4 py-3 ps-10 pe-10 text-sm bg-background"
                  dir="ltr"
                  style={{ textAlign: "right" }}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="clay-button w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-xs text-muted-foreground">
                أو
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={isLoading}
            className="w-full py-3 rounded-xl border border-border/60 bg-background/60 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors flex items-center justify-center gap-2"
          >
            <UserRound className="w-4 h-4" />
            الدخول كزائر
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2026 CRIM-SYS — جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
