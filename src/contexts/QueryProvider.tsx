import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState, type ReactNode } from "react";

// Create persister that uses localStorage as a fallback
// (IndexedDB persister requires the idb adapter which is heavier)
const localStoragePersister = typeof window !== "undefined"
  ? createSyncStoragePersister({ storage: localStorage })
  : undefined;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute — data is fresh for 60s
        gcTime: 5 * 60 * 1000, // 5 minutes — garbage collect unused cache
        refetchOnWindowFocus: false,
        retry: 2,
        refetchOnReconnect: true,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: make a new query client if we don't already have one
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
          maxAge: 5 * 60 * 1000, // persist cache for 5 minutes
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              // Only persist successful queries, not mutations or errors
              return query.state.status === "success";
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
