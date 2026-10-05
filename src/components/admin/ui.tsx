import type { ReactNode } from "react";

export function AdminTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ on, onLabel, offLabel, tone = "success" }: { on: boolean; onLabel: string; offLabel: string; tone?: "success" | "primary" }) {
  const cls = on ? (tone === "primary" ? "bg-primary/15 text-primary" : "bg-success/15 text-success") : "bg-secondary text-muted-foreground";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{on ? onLabel : offLabel}</span>;
}

export const inputCls =
  "h-11 w-full rounded-lg border border-input bg-secondary/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none";
export const textareaCls =
  "w-full rounded-lg border border-input bg-secondary/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none";

export function Field({ label, required, error, hint, children }: { label: string; required?: boolean | undefined; error?: string | undefined; hint?: string | undefined; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5 sm:p-6">
      <h2 className="mb-5 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Thumb({ src }: { src: string | null }) {
  return src ? <img src={src} alt="" loading="lazy" className="size-12 rounded-lg object-cover" /> : <div className="nebula size-12 rounded-lg bg-secondary" />;
}
