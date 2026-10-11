import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MousePointerClick, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AdminTitle, StatusBadge, Thumb } from "@/components/admin/ui";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_SELECT, firstImage, type AdminRow } from "@/lib/admin-queries";

export const Route = createFileRoute("/_admin/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard | OVU Admin" },
      { name: "description", content: "Administrator dashboard for Our Visible Universe Store." },
      { property: "og:title", content: "Dashboard | OVU Admin" },
      {
        property: "og:description",
        content: "Administrator dashboard for Our Visible Universe Store.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Dashboard,
});

async function count(build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) {
  const { count } = await build(base());
  return count ?? 0;
}
function base() {
  return supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
}

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const week = new Date(Date.now() - 7 * 864e5).toISOString();
      const [total, active, featured, recent, cats, clicks] = await Promise.all([
        count((q) => q),
        count((q) => q.eq("active", true)),
        count((q) => q.eq("featured", true)),
        count((q) => q.gte("created_at", week)),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("outbound_clicks").select("id", { count: "exact", head: true }),
      ]);
      return {
        total,
        active,
        inactive: total - active,
        featured,
        recent,
        cats: cats.count ?? 0,
        clicks: clicks.count ?? 0,
      };
    },
  });
  const { data: recent = [] } = useQuery({
    queryKey: ["admin", "recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(ADMIN_SELECT)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6);
      return (data ?? []) as unknown as AdminRow[];
    },
  });
  const { data: top = [] } = useQuery({
    queryKey: ["admin", "topclicks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("outbound_clicks")
        .select("product_id, products(name)")
        .order("created_at", { ascending: false })
        .limit(5000);
      const m = new Map<string, { name: string; n: number }>();
      for (const r of (data ?? []) as unknown as {
        product_id: string;
        products: { name: string } | null;
      }[]) {
        const e = m.get(r.product_id) ?? { name: r.products?.name ?? "Unknown", n: 0 };
        e.n++;
        m.set(r.product_id, e);
      }
      return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 5);
    },
  });

  const cards = [
    ["Total Products", stats?.total],
    ["Active", stats?.active],
    ["Inactive", stats?.inactive],
    ["Featured", stats?.featured],
    ["Categories", stats?.cats],
    ["Added (7 days)", stats?.recent],
    ["Affiliate Clicks", stats?.clicks],
  ] as const;

  return (
    <>
      <AdminTitle
        title="Dashboard"
        sub="Overview of your store"
        action={
          <Link
            to="/admin/products/new"
            className={buttonVariants({ variant: "affiliate", size: "lg" })}
          >
            <Plus /> ADD PRODUCT
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-border bg-card/60 p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="mt-2 text-3xl font-semibold">{v ?? "—"}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Clicks count visits sent to partner retailers. Sales and commissions remain available in
        each affiliate account.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card/60 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-sans text-sm font-semibold">Recent products</h2>
            <Link to="/admin/products" className="text-xs text-accent">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No products yet. Click “Add Product” to publish your first one.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 p-3">
                  <Thumb src={firstImage(r)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.categories?.name ?? "No category"} ·{" "}
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-1 flex gap-1.5">
                      <StatusBadge on={r.active} onLabel="Active" offLabel="Inactive" />
                      {r.featured && (
                        <StatusBadge on onLabel="Featured" offLabel="" tone="primary" />
                      )}
                    </div>
                  </div>
                  <Link
                    to="/admin/products/edit/$id"
                    params={{ id: r.id }}
                    className="text-xs text-accent"
                  >
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-4">
          <h2 className="flex items-center gap-2 font-sans text-sm font-semibold">
            <MousePointerClick className="size-4 text-primary" /> Most-clicked products
          </h2>
          {top.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No clicks recorded yet.</p>
          ) : (
            <ol className="mt-4 space-y-2 text-sm">
              {top.map((t, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{t.name}</span>
                  <span className="font-mono text-muted-foreground">{t.n}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
