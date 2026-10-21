import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { categoriesQuery, homeQuery, settingsQuery } from "@/lib/store";
import { HomepageRenderer } from "@/lib/visual-editor/homepage";

const TITLE = "Our Visible Universe Store — Astronomy Gifts, Space Gear & Cosmic Décor";
const DESC =
  "Discover astronomy-inspired products, space gear, cosmic décor, apparel and gifts curated for curious minds.";

export const Route = createFileRoute("/_store/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    try {
      const [home, cats, settings] = await Promise.all([
        context.queryClient.ensureQueryData(homeQuery),
        context.queryClient.ensureQueryData(categoriesQuery),
        context.queryClient.ensureQueryData(settingsQuery),
      ]);
      return { home, cats, settings };
    } catch {
      return {
        home: { featured: [], newest: [], festival: [], allProducts: [] },
        cats: [],
        settings: null,
      };
    }
  },
  component: Home,
});

function Home() {
  const { data: home } = useSuspenseQuery(homeQuery);
  const { data: cats = [] } = useSuspenseQuery(categoriesQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);

  return <HomepageRenderer home={home} categories={cats} settings={settings} />;
}
