import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set New Password | Our Visible Universe Store" },
      { name: "description", content: "Set a new administrator password." },
      { property: "og:title", content: "Set New Password" },
      { property: "og:description", content: "Set a new administrator password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return setError(error.message);
    toast.success("Password updated.");
    navigate({ to: "/admin" });
  }

  return (
    <div className="starfield flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-4 rounded-3xl p-7">
        <h1 className="text-3xl">Set a new password</h1>
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="h-12 w-full rounded-xl border border-input bg-secondary/60 px-4 text-sm focus:outline-none" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" variant="affiliate" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />} Update password
        </Button>
      </form>
    </div>
  );
}
