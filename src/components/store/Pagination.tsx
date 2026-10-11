import { Link } from "@tanstack/react-router";

export function Pager({
  page,
  total,
  pageSize,
  to,
  search,
}: {
  page: number;
  total: number;
  pageSize: number;
  to: string;
  search: Record<string, unknown>;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <nav className="mt-12 flex items-center justify-center gap-3" aria-label="Pagination">
      {page > 1 && (
        <Link
          to={to}
          search={{ ...search, page: page - 1 }}
          className="inline-flex h-11 items-center rounded-full border border-input px-5 text-sm hover:bg-secondary"
        >
          ← Previous
        </Link>
      )}
      <span className="font-mono text-xs text-muted-foreground">
        {page} / {pages}
      </span>
      {page < pages && (
        <Link
          to={to}
          search={{ ...search, page: page + 1 }}
          className="inline-flex h-11 items-center rounded-full border border-input px-5 text-sm hover:bg-secondary"
        >
          Next →
        </Link>
      )}
    </nav>
  );
}

export function EmptyState({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass mx-auto max-w-lg rounded-3xl px-6 py-14 text-center">
      <h3 className="text-3xl">{title}</h3>
      {text && <p className="mt-2 text-sm text-muted-foreground">{text}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  text,
}: {
  eyebrow?: string | undefined;
  title: string;
  text?: string | null | undefined;
}) {
  return (
    <div className="relative overflow-hidden border-b border-border">
      <div className="nebula starfield absolute inset-0 opacity-70" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-3 text-4xl sm:text-6xl">{title}</h1>
        {text && <p className="mt-4 max-w-2xl text-muted-foreground">{text}</p>}
      </div>
    </div>
  );
}
