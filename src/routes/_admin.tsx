import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CopyCheck,
  ExternalLink,
  Flame,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  X,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Client-only gate for the admin UI. Real enforcement is database-side:
// every write is checked by Row Level Security using is_admin().
export const Route = createFileRoute("/_admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/admin/login", search: { denied: undefined } });
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      await supabase.auth.signOut();
      throw redirect({ to: "/admin/login", search: { denied: "1" } });
    }
    return { user: data.user };
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdminShell,
});

function AdminShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  async function logout() {
    await qc.cancelQueries();
    qc.removeQueries({ queryKey: ["admin"] });
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", search: { denied: undefined }, replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-4">
      <Link to="/admin" className="mb-6 flex items-center gap-2 px-2">
        <span className="size-2 rounded-full bg-primary shadow-glow" />
        <span className="font-display text-lg">OVU Admin</span>
      </Link>
      {[
        { to: "/admin" as const, label: "Dashboard", icon: LayoutDashboard, exact: true },
        { to: "/admin/products" as const, label: "Products", icon: Package, exact: false },
        { to: "/admin/duplicates" as const, label: "Duplicates", icon: CopyCheck, exact: false },
        { to: "/admin/festival" as const, label: "Festival Special", icon: Flame, exact: false },
        { to: "/admin/categories" as const, label: "Categories", icon: FolderTree, exact: false },
        { to: "/admin/settings" as const, label: "Settings", icon: Settings, exact: false },
      ].map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={() => setOpen(false)}
          activeOptions={{ exact: n.exact }}
          className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          activeProps={{ className: "!bg-sidebar-accent !text-sidebar-foreground font-semibold" }}
        >
          <n.icon className="size-4" /> {n.label}
        </Link>
      ))}
      <a
        href="/"
        target="_blank"
        rel="noopener"
        className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"
      >
        <ExternalLink className="size-4" /> View Store
      </a>
      <button
        onClick={logout}
        className="mt-auto flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"
      >
        <LogOut className="size-4" /> Logout
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-sidebar-border bg-sidebar lg:block">
        {sidebar}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/70" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border bg-sidebar">
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-3 flex size-10 items-center justify-center"
            >
              <X className="size-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="flex size-10 items-center justify-center"
          >
            <Menu className="size-5" />
          </button>
          <span className="ml-2 font-display text-lg">OVU Admin</span>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
