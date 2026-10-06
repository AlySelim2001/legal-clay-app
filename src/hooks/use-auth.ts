import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

/** Compatibility adapter for the legacy email-OTP screen. */
export function useAuth() {
  const { isLoading, isAuthenticated, user, signOut } = useSupabaseAuth();
  const signIn = async (
    provider: "email-otp" | "anonymous",
    formData?: FormData,
  ): Promise<void> => {
    const { supabase } = await import("@/lib/supabase");
    if (provider === "anonymous") {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw new Error(error.message);
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
