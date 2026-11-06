/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
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

const DEFAULT_DEMO_USER: AuthUser = {
  id: "demo-user-admin-01",
  email: "admin@crimsys.com",
  role: "admin",
  user_metadata: {
    role: "admin",
    full_name: "المستشار / رئيس الفريق القانوني",
  },
};

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
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (!isSupabaseConfigured) {
      try {
        const stored = localStorage.getItem("crimsys_auth_user");
        if (stored) return JSON.parse(stored);
        return DEFAULT_DEMO_USER;
      } catch {
        return DEFAULT_DEMO_USER;
      }
    }
    return null;
  });
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

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
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ? buildUser(s.user) : null);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn("[CRIM-SYS] Supabase session failed, using demo fallback:", err);
        setUser(DEFAULT_DEMO_USER);
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
    if (!isSupabaseConfigured) {
      const demoUser: AuthUser = {
        id: "demo-user-session",
        email: email || "admin@crimsys.com",
        role: "admin",
        user_metadata: {
          role: "admin",
          full_name: email.split("@")[0] || "المستشار القانوني",
        },
      };
      setUser(demoUser);
      try {
        localStorage.setItem("crimsys_auth_user", JSON.stringify(demoUser));
      } catch {
        // ignore
      }
      return {};
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error ?? undefined };
    } catch {
      // Offline fallback
      const demoUser: AuthUser = {
        id: "demo-user-fallback",
        email,
        role: "admin",
        user_metadata: { role: "admin" },
      };
      setUser(demoUser);
      return {};
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, role: UserRoleType = "assistant") => {
      if (!isSupabaseConfigured) {
        const demoUser: AuthUser = {
          id: "demo-user-signup",
          email,
          role,
          user_metadata: { role },
        };
        setUser(demoUser);
        try {
          localStorage.setItem("crimsys_auth_user", JSON.stringify(demoUser));
        } catch {
          // ignore
        }
        return {};
      }

      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        return { error: error ?? undefined };
      } catch {
        const demoUser: AuthUser = {
          id: "demo-user-fallback",
          email,
          role,
          user_metadata: { role },
        };
        setUser(demoUser);
        return {};
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch {
      // ignore
    }
    setUser(null);
    setSession(null);
    try {
      localStorage.removeItem("crimsys_auth_user");
    } catch {
      // ignore
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (u) setUser(buildUser(u));
    } catch {
      // ignore
    }
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
