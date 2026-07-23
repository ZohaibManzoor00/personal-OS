"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchLink,
  httpBatchStreamLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import superjson from "superjson";
import { env } from "@/lib/env";
import { makeQueryClient } from "./query-client";
import type { AppRouter } from "./routers/_app";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
let browserQueryClient: QueryClient;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();

  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

function getUrl() {
  const base = (() => {
    if (typeof window !== "undefined") return "";
    if (env.APP_URL) return `https://${env.APP_URL}`;
    return "http://localhost:3000";
  })();
  return `${base}/api/trpc`;
}

export function TRPCReactProvider(
  props: Readonly<{ children: React.ReactNode }>,
) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: getUrl(),
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}

/**
 * A vanilla (non-React-Query) tRPC client wired with the streaming batch link.
 * React Query resolves a mutation once, so it can't surface a procedure that
 * yields values over time — use this client to `for await` over procedures that
 * return an async iterable (e.g. `chat.send` streaming tokens as they arrive).
 *
 * Browser-only singleton: streaming chat is an owner action that never runs
 * during SSR, so we lazily create one instance and reuse it across sends.
 */
let streamingClient: ReturnType<typeof createStreamingClient> | undefined;

function createStreamingClient() {
  return createTRPCClient<AppRouter>({
    links: [httpBatchStreamLink({ transformer: superjson, url: getUrl() })],
  });
}

export function getStreamingTRPCClient() {
  if (!streamingClient) streamingClient = createStreamingClient();
  return streamingClient;
}
