import type { ReactNode } from "react";
import { PageHeader } from "./Pagination";

export function StaticPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string | undefined; children: ReactNode }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} text={intro} />
      <div className="prose-cosmic mx-auto max-w-3xl px-4 py-12 sm:px-6">{children}</div>
    </>
  );
}

export function meta(title: string, description: string) {
  const t = `${title} | Our Visible Universe Store`;
  return {
    meta: [
      { title: t },
      { name: "description", content: description },
      { property: "og:title", content: t },
      { property: "og:description", content: description },
    ],
  };
}
