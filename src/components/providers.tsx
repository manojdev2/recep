"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "./theme";

function AppToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="bottom-right"
      offset={20}
      gap={10}
      duration={4200}
      visibleToasts={4}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group flex w-[min(calc(100vw-2rem),22rem)] items-start gap-3 rounded-xl bg-surface px-4 py-3.5 text-sm text-fg shadow-[var(--shadow-border)]",
          title: "font-medium tracking-tight text-fg",
          description: "mt-0.5 text-sm leading-relaxed text-muted",
          actionButton: "ml-auto shrink-0 rounded-lg bg-raised px-2.5 py-1 text-xs font-medium text-fg",
          cancelButton: "ml-auto shrink-0 rounded-lg px-2.5 py-1 text-xs text-muted",
          closeButton: "text-subtle hover:text-fg",
          success: "shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-live)_35%,transparent)]",
          error: "shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-danger)_45%,transparent)]",
          warning: "shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-warn)_40%,transparent)]",
        },
      }}
    />
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const qc: QueryClient = new QueryClient({
      mutationCache: new MutationCache({
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["setup"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
        },
      }),
      defaultOptions: { queries: { staleTime: 20_000, retry: 1 } },
    });
    return qc;
  });
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        {children}
        <AppToaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
