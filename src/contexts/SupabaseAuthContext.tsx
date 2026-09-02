/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import type { UserRoleType } from "@/types/enterprise";
import type { User, Session, AuthError } from "@supabase/supabase-js";

interface AuthUser {
  id: string;
  email: string;
  role: UserRoleType;
  user_metadata: Record<string, unknown>;
}

interface SupabaseAuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: AuthError }>;
  signUp: (
    email: string,
    password: string,
    role?: UserRoleType,
  ) => Promise<{ error?: AuthError }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | null>(null);

const VALID_ROLES: UserRoleType[] = ["admin", "lawyer", "assistant", "readonly"];

function extractRole(user: User): UserRoleType {
  const meta = user.user_metadata ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appMeta = (user as any).app_metadata as Record<string, unknown> | undefined;
  const raw =
    (meta.role as string | undefined) ??
    (appMeta?.role as string | undefined) ??
    "assistant";
  return VALID_ROLES.includes(raw as UserRoleType)
    ? (raw as UserRoleType)
    : "assistant";
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const buildUser = useCallback(
    (u: User): AuthUser => ({
      id: u.id,
      email: u.email ?? "",
      role: extractRole(u),
      user_metadata: u.user_metadata ?? {},
    }),
    [],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ? buildUser(s.user) : null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ? buildUser(s.user) : null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [buildUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ?? undefined };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, role: UserRoleType = "assistant") => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
      return { error: error ?? undefined };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (u) setUser(buildUser(u));
  }, [buildUser]);

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) {
    throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  }
  return ctx;
}
