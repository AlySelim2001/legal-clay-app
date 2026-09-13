import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

/**
 * Convex client wiring for the legal knowledge platform.
 *
 * The web app keeps its Supabase session for the legacy case-management
 * product; the knowledge platform rides on Convex Auth's anonymous session
 * (auto-created on first use) so citizens never need an account to ask a
 * question. Both providers coexist in the provider tree.
 */

export const CONVEX_URL = (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? "";

const convexClient = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

export function ConvexProvider({ children }: { children: ReactNode }) {
  if (!convexClient) {
    // Deployment not configured — knowledge platform surfaces an honest
    // "unavailable" state instead of crashing the whole app.
    return <>{children}</>;
  }
  return <ConvexAuthProvider client={convexClient}>{children}</ConvexAuthProvider>;
}

/** True when the Convex deployment URL is configured for this build. */
export function useConvexAvailable(): boolean {
  return Boolean(CONVEX_URL);
}
