import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Offline-first persister using localStorage
// On Capacitor/Android this maps to the WebView's localStorage, which persists
// across app restarts.  maxAge controls how long cached data is served before
// a fresh network fetch is required.
// ---------------------------------------------------------------------------
const localStoragePersister =
  typeof window !== "undefined"
    ? createSyncStoragePersister({ storage: localStorage })
    : undefined;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays "fresh" for 2 minutes — court data does not change
        // frequently so a longer window avoids redundant fetches inside
        // courtrooms with poor connectivity.
        staleTime: 2 * 60 * 1000,
        // Garbage-collect unused cache entries after 10 minutes.
        gcTime: 10 * 60 * 1000,
        // Never refetch on tab focus — lawyers switching back from another
        // app should not trigger a flash of loading spinners.
        refetchOnWindowFocus: false,
        // Exponential backoff retry: 1st retry after 1 s, 2nd after 2 s.
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
        // Re-fetch when the device comes back online (Capacitor / mobile).
        refetchOnReconnect: true,
        // In offline-first mode we want queries to attempt even when
        // the network is known to be down — they will fall back to the
        // persisted cache automatically.
        networkMode: "always",
      },
      mutations: {
        // Mutations still need a real connection; use the default "online".
        networkMode: "online",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(getQueryClient);

  if (localStoragePersister) {
    return (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: localStoragePersister,
          // Persist cached data for 24 hours — sufficient for multi-day
          // court sessions without internet.
          maxAge: 24 * 60 * 60 * 1000,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              // Only persist successful queries.  Skip mutations, errors,
              // and any query that is currently fetching.
              return (
                query.state.status === "success" &&
                query.state.fetchStatus === "idle"
              );
            },
          },
        }}
      >
        {children}
      </PersistQueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
