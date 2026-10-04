import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { meta, StaticPage } from "@/components/store/StaticPage";
import { settingsQuery } from "@/lib/store";

export const Route = createFileRoute("/_store/affiliate-disclosure")({
  head: () => meta("Affiliate Disclosure", "How Our Visible Universe participates in the Amazon Associates affiliate program."),
  component: Page,
});

function Page() {
  const { data: s } = useQuery(settingsQuery);
  return (
    <StaticPage eyebrow="Transparency" title="Affiliate disclosure">
      <p><strong>{s?.affiliate_disclosure}</strong></p>
      <p>Our Visible Universe participates in the Amazon Services LLC Associates Program (and equivalent regional Amazon Associates programs), an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.</p>
      <p>When you click a "Buy on Amazon" button on this site, you are taken to Amazon. If you make a qualifying purchase, we may earn a commission. This does not change the price you pay.</p>
      <p>We are not owned by, operated by or endorsed by Amazon. Amazon and the Amazon logo are trademarks of Amazon.com, Inc. or its affiliates.</p>
      <p>Prices and availability are set by Amazon and may change at any time. Any price shown on this site is for reference only; the price displayed on Amazon at the time of purchase applies.</p>
      <p>We do not process payments, ship products or handle returns. All of this is handled by Amazon and its sellers.</p>
    </StaticPage>
  );
}
