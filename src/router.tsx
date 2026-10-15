import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    dehydrate: () => ({
      queryClientState: dehydrate(queryClient) as any,
    }),
    hydrate: (dehydrated: { queryClientState?: unknown }) => {
      if (dehydrated?.queryClientState) {
        hydrate(queryClient, dehydrated.queryClientState);
      }
    },
  });

  return router;
};
