import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { Loader2 } from 'lucide-react';
import { useCallback, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

/**
 * RequireAuth — protects routes behind authentication.
 *
 * Security features:
 * - Redirects unauthenticated users to /auth with return path
 * - Enforces 15-minute session timeout (auto-logout on inactivity)
 * - All legal data access routes must be wrapped with this component
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, signOut } = useSupabaseAuth();
  const location = useLocation();

  const handleSessionTimeout = useCallback(async () => {
    // Sign out user after 15 minutes of inactivity
    try {
      await signOut();
    } catch {
      // Sign out failed — clear local state as fallback
      localStorage.clear();
      window.location.href = '/auth';
    }
  }, [signOut]);

  // Enforce session timeout when authenticated
  useSessionTimeout({
    timeoutMs: 15 * 60 * 1000, // 15 minutes
    onTimeout: handleSessionTimeout,
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  return children;
}
