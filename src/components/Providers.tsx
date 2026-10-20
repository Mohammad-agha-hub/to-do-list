"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { watchSystemTheme } from "@/lib/client/theme";
import { ToastProvider } from "./Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1, networkMode: "offlineFirst" },
          mutations: { networkMode: "offlineFirst" },
        },
      }),
  );
  useEffect(() => watchSystemTheme(), []);
  useEffect(() => {
    // Only in production: a service worker would fight with dev hot reloading.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    }
  }, []);
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
