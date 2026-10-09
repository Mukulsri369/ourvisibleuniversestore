import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ denied: s['denied'] === "1" || s['denied'] === 1 ? "1" : undefined }),
  head: () => ({
    meta: [
      { title: "Admin Sign In | Our Visible Universe Store" },
      { name: "description", content: "Administrator sign in." },
      { property: "og:title", content: "Admin Sign In" },
      { property: "og:description", content: "Administrator sign in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Login,
});

type Mode = "signin" | "forgot" | "setup";

function Login() {
  const navigate = useNavigate();
  const { denied } = Route.useSearch();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(denied ? "This account does not have administrator access." : null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          setError(error.message.toLowerCase().includes("confirm") ? "Please confirm your email first — check your inbox." : "Invalid email or password.");
          return;
        }
        const { data: isAdmin } = await supabase.rpc("is_admin");
        if (!isAdmin) {
          await supabase.auth.signOut();
          setError("This account does not have administrator access.");
          return;
        }
        toast.success("Welcome back, commander.");
        navigate({ to: "/admin" });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/admin/reset-password`,
        });
        if (error) throw error;
        setInfo("If that email is registered, a password reset link is on its way.");
      } else {
        if (password.length < 8) {
          setError("Password must be at least 8 characters.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin/login` },
        });
        if (error) throw error;
        setInfo("Check your inbox to confirm your email, then sign in here.");
        setMode("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const field = "h-12 w-full rounded-xl border border-input bg-secondary/60 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none";

  return (
    <div className="starfield relative flex min-h-screen items-center justify-center px-4">
      <div className="nebula absolute inset-0" />
      <div className="glass relative w-full max-w-sm rounded-3xl p-7 shadow-card">
        <div className="flex size-11 items-center justify-center rounded-full border border-primary/40">
          <Lock className="size-5 text-primary" />
        </div>
        <p className="eyebrow mt-6">Mission control</p>
        <h1 className="mt-2 text-3xl">
          {mode === "signin" ? "Admin sign in" : mode === "forgot" ? "Reset password" : "Set up admin account"}
        </h1>
        {mode === "setup" && (
          <p className="mt-2 text-xs text-muted-foreground">First time? Create a password for your authorised admin email. You'll confirm it by email.</p>
        )}
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted-foreground">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </label>
          {mode !== "forgot" && (
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Password</span>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  required
                  autoComplete={mode === "setup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${field} pr-12`}
                />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-1 top-1 flex size-10 items-center justify-center text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
          )}
          {error && <p role="alert" className="rounded-lg bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>}
          {info && <p className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">{info}</p>}
          <Button type="submit" variant="affiliate" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {mode === "signin" ? "Sign In" : mode === "forgot" ? "Send reset link" : "Create account"}
          </Button>
        </form>
        <div className="mt-5 flex flex-col gap-2 text-center text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>
              <button onClick={() => setMode("forgot")} className="hover:text-foreground">Forgot password?</button>
              <button onClick={() => setMode("setup")} className="hover:text-foreground">First time here? Set up your admin password</button>
            </>
          ) : (
            <button onClick={() => setMode("signin")} className="hover:text-foreground">← Back to sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}
