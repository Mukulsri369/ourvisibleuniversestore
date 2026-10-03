import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StoreFooter, StoreHeader } from "@/components/store/StoreChrome";
import { categoriesQuery, settingsQuery } from "@/lib/store";

export const Route = createFileRoute("/_store")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(settingsQuery).catch(() => null),
      context.queryClient.ensureQueryData(categoriesQuery).catch(() => []),
    ]);
  },
  component: StoreLayout,
});

function StoreLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <StoreHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <StoreFooter />
    </div>
  );
}
