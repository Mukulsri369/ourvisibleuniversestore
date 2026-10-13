import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { AdminTitle, Field, inputCls, Section, textareaCls } from "@/components/admin/ui";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { pathFromUrl, removeStoragePaths, uploadImage } from "@/lib/admin";

export const Route = createFileRoute("/_admin/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings | OVU Admin" },
      { name: "description", content: "Administrator settings for Our Visible Universe Store." },
      { property: "og:title", content: "Settings | OVU Admin" },
      {
        property: "og:description",
        content: "Administrator settings for Our Visible Universe Store.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const r = await supabase.from("site_settings").select("*").eq("id", 1).single();
      if (r.error) throw r.error;
      return r.data;
    },
  });
  type SettingsRow = Database["public"]["Tables"]["site_settings"]["Row"];
  const [draft, setDraft] = useState<SettingsRow>();
  const [saving, setSaving] = useState(false);
  const s = draft ?? data;
  const set = (p: Partial<SettingsRow>) => {
    if (!s) return;
    setDraft({ ...s, ...p });
  };

  async function upload(file: File | undefined) {
    if (!file || !s) return;
    try {
      const r = await uploadImage(file, "branding");
      const old = pathFromUrl(s.logo_url);
      set({ logo_url: r.url });
      if (old) await removeStoragePaths([old]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({
        store_name: s.store_name,
        logo_url: s.logo_url,
        instagram_url: s.instagram_url,
        contact_email: s.contact_email,
        affiliate_disclosure: s.affiliate_disclosure,
        footer_text: s.footer_text,
        social_links: s.social_links,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Store settings saved.");
    qc.invalidateQueries();
  }

  if (isLoading || !s) return <p className="text-sm text-muted-foreground">Loading settings…</p>;
  return (
    <form onSubmit={save} className="space-y-5">
      <AdminTitle title="Store settings" sub="Public brand, contact and disclosure content." />
      <Section title="Brand">
        <Field label="Store name">
          <input
            className={inputCls}
            value={s.store_name}
            onChange={(e) => set({ store_name: e.target.value })}
          />
        </Field>
        <div className="flex items-center gap-4">
          {s.logo_url ? (
            <img
              src={s.logo_url}
              alt="Current logo"
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <div className="nebula size-16 rounded-full" />
          )}
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <ImagePlus /> Upload logo
          </Button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </div>
      </Section>
      <Section title="Contact & social">
        <Field label="Contact email">
          <input
            type="email"
            className={inputCls}
            value={s.contact_email ?? ""}
            onChange={(e) => set({ contact_email: e.target.value || null })}
          />
        </Field>
        <Field label="Instagram URL">
          <input
            type="url"
            className={inputCls}
            value={s.instagram_url ?? ""}
            onChange={(e) => set({ instagram_url: e.target.value || null })}
          />
        </Field>
      </Section>
      <Section title="Festival Special">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Diwali & Seasonal Festival Showcase
            </p>
            <p className="text-xs text-muted-foreground">
              Add, remove, and reorder products displayed in the featured Festival Special carousel
              on the homepage.
            </p>
          </div>
          <Link
            to="/admin/festival"
            className={buttonVariants({ variant: "outline", className: "gap-2 shrink-0" })}
          >
            <Flame className="size-4 text-primary" /> Curate Festival Products →
          </Link>
        </div>
      </Section>
      <Section title="Legal & footer">
        <Field label="Affiliate disclosure">
          <textarea
            rows={5}
            className={textareaCls}
            value={s.affiliate_disclosure}
            onChange={(e) => set({ affiliate_disclosure: e.target.value })}
          />
        </Field>
        <Field label="Footer text">
          <input
            className={inputCls}
            value={s.footer_text}
            onChange={(e) => set({ footer_text: e.target.value })}
          />
        </Field>
      </Section>
      <div className="flex justify-end">
        <Button type="submit" variant="affiliate" size="lg" disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}
