import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Gavel, Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn } = useSupabaseAuth();

  const returnTo = searchParams.get("returnTo") || "/app/dashboard";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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

    navigate(returnTo);
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

        {/* Login form */}
        <div className="clay-card p-8">
          <h2 className="text-lg font-bold text-foreground mb-1">تسجيل الدخول</h2>
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
              <label className="block text-sm font-medium text-foreground mb-2">
                البريد الإلكتروني
              </label>
              <input
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
              <label className="block text-sm font-medium text-foreground mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="clay-input w-full px-4 py-3 ps-10 text-sm bg-background"
                  dir="ltr"
                  style={{ textAlign: "right" }}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded-lg accent-primary" />
                <span className="text-sm text-muted-foreground">تذكرني</span>
              </label>
              <a href="#" className="text-sm text-clay-blue hover:underline">
                نسيت كلمة المرور؟
              </a>
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
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2026 CRIM-SYS — جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
