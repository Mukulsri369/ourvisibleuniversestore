import { Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Instagram, Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { categoriesQuery, settingsQuery } from "@/lib/store";

function Logo({ logo }: { logo?: string | null | undefined }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      {logo ? (
        <img src={logo} alt="" className="size-8 rounded-full object-cover" />
      ) : (
        <span className="relative flex size-8 items-center justify-center rounded-full border border-primary/50">
          <span className="size-2 rounded-full bg-primary shadow-glow" />
          <span className="absolute inset-[-4px] rounded-full border border-accent/20" />
        </span>
      )}
      <span className="leading-none">
        <span className="block font-display text-lg text-foreground">Our Visible Universe</span>
        <span className="block font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
          Store
        </span>
      </span>
    </Link>
  );
}

export function SearchBox({
  autoFocus,
  onDone,
  defaultValue,
}: {
  autoFocus?: boolean | undefined;
  onDone?: (() => void) | undefined;
  defaultValue?: string | undefined;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState(defaultValue ?? "");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        navigate({ to: "/search", search: { q: q.trim() } });
        onDone?.();
      }}
      className="relative w-full"
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search telescopes, galaxy, Saturn…"
        aria-label="Search products"
        className="h-11 w-full rounded-full border border-input bg-secondary/60 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
      />
    </form>
  );
}

const NAV = [
  { to: "/shop", label: "Shop" },
  { to: "/search", label: "Categories", hash: true },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function StoreHeader() {
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo logo={settings?.logo_url} />
        <nav className="ml-8 hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
          <Link
            to="/shop"
            className="hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Shop
          </Link>
          <div className="group relative">
            <button className="hover:text-foreground">Categories</button>
            <div className="invisible absolute left-0 top-full z-50 w-72 pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
              <div className="glass rounded-xl p-2">
                {cats?.map((c) => (
                  <Link
                    key={c.id}
                    to="/category/$slug"
                    params={{ slug: c.slug }}
                    className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Link
            to="/about"
            className="hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            About
          </Link>
          <Link
            to="/contact"
            className="hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Contact
          </Link>
        </nav>
        <div className="ml-auto hidden w-72 md:block">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-0 lg:hidden">
          <button
            aria-label="Search"
            onClick={() => setSearchOpen((s) => !s)}
            className="flex size-11 items-center justify-center rounded-full hover:bg-secondary md:hidden"
          >
            <Search className="size-5" />
          </button>
          <button
            aria-label="Menu"
            onClick={() => setOpen(true)}
            className="flex size-11 items-center justify-center rounded-full hover:bg-secondary"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>
      {searchOpen && (
        <div className="border-t border-border px-4 py-3 md:hidden">
          <SearchBox autoFocus onDone={() => setSearchOpen(false)} />
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <Logo logo={settings?.logo_url} />
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="flex size-11 items-center justify-center rounded-full hover:bg-secondary"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="h-[calc(100vh-4rem)] overflow-y-auto px-5 py-6">
            <SearchBox onDone={() => setOpen(false)} />
            <nav className="mt-6 flex flex-col">
              {NAV.filter((n) => !("hash" in n)).map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="border-b border-border py-4 font-display text-2xl"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <p className="eyebrow mt-8">Categories</p>
            <div className="mt-3 grid grid-cols-1 gap-1">
              {cats?.map((c) => (
                <Link
                  key={c.id}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  onClick={() => setOpen(false)}
                  className="rounded-lg py-3 text-base text-muted-foreground hover:text-foreground"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function StoreFooter() {
  const { data: s } = useSuspenseQuery(settingsQuery);
  const social = (s?.social_links ?? {}) as Record<string, string>;
  return (
    <footer className="relative mt-24 border-t border-border">
      <div className="nebula absolute inset-0 opacity-40" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-5">
        <div className="md:col-span-2">
          <p className="font-sans text-sm font-bold uppercase tracking-[0.25em]">
            Our Visible Universe
          </p>
          <p className="mt-3 max-w-xs font-display text-2xl italic text-muted-foreground">
            {s?.footer_text ?? "Explore the universe. Discover something extraordinary."}
          </p>
          <p className="mt-6 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {s?.affiliate_disclosure}
          </p>
        </div>
        <FooterCol
          title="Explore"
          links={[
            { to: "/shop", l: "Shop" },
            { to: "/search", l: "Categories" },
            { to: "/about", l: "About" },
          ]}
        />
        <FooterCol
          title="Information"
          links={[
            { to: "/contact", l: "Contact" },
            { to: "/faq", l: "FAQ" },
          ]}
        />
        <div>
          <FooterCol
            title="Legal"
            links={[
              { to: "/privacy", l: "Privacy Policy" },
              { to: "/terms", l: "Terms & Conditions" },
              { to: "/affiliate-disclosure", l: "Affiliate Disclosure" },
            ]}
          />
          <p className="eyebrow mt-8">Social</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {s?.instagram_url && (
              <a
                href={s.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Instagram className="size-4" /> Instagram
              </a>
            )}
            {Object.entries(social)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <a
                  key={k}
                  href={v}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="capitalize text-muted-foreground hover:text-foreground"
                >
                  {k}
                </a>
              ))}
          </div>
        </div>
      </div>
      <div className="relative border-t border-border py-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        © {new Date().getFullYear()} Our Visible Universe
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; l: string }[] }) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="mt-3 space-y-2.5 text-sm">
        {links.map((x) => (
          <li key={x.to}>
            <Link to={x.to} className="text-muted-foreground hover:text-foreground">
              {x.l}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
