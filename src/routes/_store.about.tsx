import { createFileRoute } from "@tanstack/react-router";
import { meta, StaticPage } from "@/components/store/StaticPage";

export const Route = createFileRoute("/_store/about")({
  head: () =>
    meta(
      "About the Store",
      "The Our Visible Universe Store curates astronomy and space products for curious minds.",
    ),
  component: () => (
    <StaticPage
      eyebrow="Our story"
      title="About the store"
      intro="A curated extension of the Our Visible Universe journey."
    >
      <p>
        Our Visible Universe exists to make the cosmos feel closer. This store gathers
        astronomy-inspired products — telescopes, space décor, apparel, educational kits and gifts —
        that we believe help people explore, learn and wonder.
      </p>
      <h2>How it works</h2>
      <p>
        We don't sell products directly. Each item links to a partner retailer such as Amazon or
        Flipkart, where the retailer handles checkout, payment, delivery and returns. When you buy
        through our links we may earn a small commission, at no extra cost to you.
      </p>
      <h2>What we promise</h2>
      <ul>
        <li>Products are hand-selected, never auto-scraped.</li>
        <li>We never invent prices or claim "lowest price" deals.</li>
        <li>We clearly disclose our affiliate relationship.</li>
      </ul>
    </StaticPage>
  ),
});
