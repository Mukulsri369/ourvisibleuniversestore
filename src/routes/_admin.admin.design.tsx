import React, { lazy, Suspense } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { StudioLoadingState } from "@/components/visual-editor/StudioLoadingState";

const LazyStudioShell = lazy(() => import("@/components/visual-editor/StudioShell"));

export const Route = createFileRoute("/_admin/admin/design")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Store Design Studio — OVU Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDesignStudioPage,
});

function AdminDesignStudioPage() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();

  return (
    <Suspense
      fallback={
        <StudioLoadingState
          message="Opening Store Design Studio…"
          subMessage="Loading visual editor workspace and storefront canvas."
        />
      }
    >
      <LazyStudioShell
        userScope={user.id}
        onNavigateToAdmin={() => void navigate({ to: "/admin" })}
      />
    </Suspense>
  );
}
