import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { meta, StaticPage } from "@/components/store/StaticPage";
import { settingsQuery } from "@/lib/store";

export const Route = createFileRoute("/_store/affiliate-disclosure")({
  head: () => meta("Affiliate Disclosure", "How Our Visible Universe uses retailer affiliate links."),
  component: Page,
});

function Page() {
  const { data: s } = useQuery(settingsQuery);
  return (
    <StaticPage eyebrow="Transparency" title="Affiliate disclosure">
      <p><strong>{s?.affiliate_disclosure}</strong></p>
      <p>Our Visible Universe participates in affiliate programs offered by Amazon, Flipkart and other retailers. These programs allow us to earn advertising fees by linking to products on participating retailer websites.</p>
      <p>When you click a “Buy now” button, you are taken to the linked retailer. If you make a qualifying purchase, we may earn a commission at no extra cost to you.</p>
      <p>We are independent from the retailers featured on this site and are not responsible for their products or services. Retailer names and logos belong to their respective owners.</p>
      <p>Prices and availability are set by each retailer and may change at any time. Any price shown here is for reference; the price displayed by the retailer at checkout applies.</p>
      <p>We do not process payments, ship products or handle returns. The retailer and its sellers handle those services.</p>
    </StaticPage>
  );
}
