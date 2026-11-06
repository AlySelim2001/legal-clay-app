import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";

/** Compatibility adapter for the legacy email-OTP screen. */
export function useAuth() {
  const { isLoading, isAuthenticated, user, signOut, signIn: ctxSignIn } = useSupabaseAuth();
  const signIn = async (
    provider: "email-otp" | "anonymous",
    formData?: FormData,
  ): Promise<void> => {
    if (!isSupabaseConfigured) {
      const email = String(formData?.get("email") ?? "guest@crimsys.com").trim() || "guest@crimsys.com";
      await ctxSignIn(email, "demo-password");
      return;
    }

    const { supabase } = await import("@/lib/supabase");
    if (provider === "anonymous") {
      try {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          await ctxSignIn("guest@crimsys.com", "demo-password");
        }
      } catch {
        await ctxSignIn("guest@crimsys.com", "demo-password");
      }
      return;
    }
    const email = String(formData?.get("email") ?? "").trim();
    const code = String(formData?.get("code") ?? "").trim();
    if (!email) throw new Error("البريد الإلكتروني مطلوب");
    if (!code) {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) throw new Error(error.message);
  };

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
