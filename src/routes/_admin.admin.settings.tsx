import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, ImagePlus, Loader2, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [revokingEmail, setRevokingEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setCurrentUserEmail(data.user.email);
    });
  }, []);

  const {
    data: adminUsers = [],
    refetch: refetchAdmins,
    isLoading: loadingAdmins,
  } = useQuery({
    queryKey: ["admin", "admins-management"],
    queryFn: async () => {
      const emailMap = new Map<string, { email: string; created_at?: string }>();
      const DEFAULT_ADMINS = ["mukul.srivastava.025@gmail.com", "mukul.sri.25@gmail.com"];

      for (const def of DEFAULT_ADMINS) {
        emailMap.set(def.toLowerCase(), { email: def.toLowerCase() });
      }

      try {
        const { data: dbAdmins, error } = await supabase
          .from("admins")
          .select("email, created_at")
          .order("created_at", { ascending: true });
        if (!error && dbAdmins) {
          for (const a of dbAdmins) {
            emailMap.set(a.email.toLowerCase(), {
              email: a.email.toLowerCase(),
              created_at: a.created_at,
            });
          }
        }
      } catch {
        // Continue if table read is restricted
      }

      try {
        const { data: sRes } = await supabase
          .from("site_settings")
          .select("social_links")
          .eq("id", 1)
          .maybeSingle();
        const fromSettings =
          ((sRes?.social_links as Record<string, unknown>)?.approved_admins as string[]) || [];
        for (const e of fromSettings) {
          const lower = e.toLowerCase();
          if (!emailMap.has(lower)) {
            emailMap.set(lower, { email: lower });
          }
        }
      } catch {
        // Continue
      }

      return Array.from(emailMap.values());
    },
  });

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

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    const clean = newAdminEmail.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setAddingAdmin(true);
    try {
      // 1. Insert into public.admins
      try {
        await supabase.from("admins").insert({ email: clean });
      } catch {
        // Table insert may be handled by settings
      }

      // 2. Add to site_settings.social_links.approved_admins
      const { data: curSettings } = await supabase
        .from("site_settings")
        .select("social_links")
        .eq("id", 1)
        .maybeSingle();
      const currentLinks = (curSettings?.social_links as Record<string, unknown>) || {};
      const currentApproved = Array.isArray(currentLinks.approved_admins)
        ? [...(currentLinks.approved_admins as string[])]
        : [];
      if (!currentApproved.some((a) => a.toLowerCase() === clean)) {
        currentApproved.push(clean);
        await supabase
          .from("site_settings")
          .update({
            social_links: {
              ...currentLinks,
              approved_admins: currentApproved,
            },
          })
          .eq("id", 1);
      }

      toast.success(
        `Admin account approved for "${clean}". They can now set up their credentials.`,
      );
      setNewAdminEmail("");
      refetchAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pre-approve admin.");
    } finally {
      setAddingAdmin(false);
    }
  }

  async function handleRevokeAdmin(emailToRevoke: string) {
    if (currentUserEmail && currentUserEmail.toLowerCase() === emailToRevoke.toLowerCase()) {
      toast.error("You cannot revoke your own administrator account.");
      return;
    }
    if (adminUsers.length <= 1) {
      toast.error("Cannot revoke the only remaining administrator.");
      return;
    }
    setRevokingEmail(emailToRevoke);
    try {
      try {
        await supabase.from("admins").delete().eq("email", emailToRevoke);
      } catch {
        // Handled
      }

      const { data: curSettings } = await supabase
        .from("site_settings")
        .select("social_links")
        .eq("id", 1)
        .maybeSingle();
      const currentLinks = (curSettings?.social_links as Record<string, unknown>) || {};
      const currentApproved = Array.isArray(currentLinks.approved_admins)
        ? [...(currentLinks.approved_admins as string[])]
        : [];
      const updatedApproved = currentApproved.filter(
        (e) => e.toLowerCase() !== emailToRevoke.toLowerCase(),
      );
      await supabase
        .from("site_settings")
        .update({
          social_links: {
            ...currentLinks,
            approved_admins: updatedApproved,
          },
        })
        .eq("id", 1);

      toast.success(`Revoked administrator access for "${emailToRevoke}".`);
      refetchAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke admin.");
    } finally {
      setRevokingEmail(null);
    }
  }

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
      <Section title="Admin Team & Approvals">
        <p className="text-xs text-muted-foreground">
          Only pre-approved email addresses can create an administrator account. Uninvited visitors
          cannot set up admin access without approval.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="email"
            placeholder="new.admin@example.com"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            className={`${inputCls} flex-1`}
          />
          <Button
            type="button"
            variant="outline"
            disabled={addingAdmin || !newAdminEmail.trim()}
            onClick={handleAddAdmin}
            className="gap-2 shrink-0"
          >
            {addingAdmin ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4 text-primary" />
            )}
            Pre-approve Admin
          </Button>
        </div>
        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Authorized Administrators ({adminUsers.length})
          </p>
          {loadingAdmins ? (
            <p className="text-xs text-muted-foreground">Loading admin team…</p>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-secondary/30">
              {adminUsers.map((adm) => {
                const isMe =
                  currentUserEmail && currentUserEmail.toLowerCase() === adm.email.toLowerCase();
                const isRevoking = revokingEmail === adm.email;

                return (
                  <div
                    key={adm.email}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ShieldCheck className="size-4" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{adm.email}</span>
                        {isMe && (
                          <span className="ml-2 text-xs text-primary font-mono">
                            (Current Account)
                          </span>
                        )}
                      </div>
                    </div>
                    {!isMe && adminUsers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isRevoking}
                        onClick={() => handleRevokeAdmin(adm.email)}
                        className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        {isRevoking ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        Revoke
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
