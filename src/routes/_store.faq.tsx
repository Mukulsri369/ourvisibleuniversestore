import { createFileRoute } from "@tanstack/react-router";
import { meta, StaticPage } from "@/components/store/StaticPage";

const FAQ = [
  ["Do you sell products directly?", "No. Every product links to a partner retailer, where you complete your purchase."],
  ["Who handles shipping and returns?", "The linked retailer and its sellers handle payment, delivery, returns and customer service."],
  ["Does buying through your links cost more?", "No. We may earn a small commission from the retailer at no extra cost to you."],
  ["Why don't some products show a price?", "Retailer prices change often. If we can't show an accurate price, we ask you to check the latest price with the retailer."],
];

export const Route = createFileRoute("/_store/faq")({
  head: () => meta("FAQ", "Answers to common questions about shopping with Our Visible Universe."),
  component: () => (
    <StaticPage eyebrow="Help" title="Frequently asked questions">
      {FAQ.map(([q, a]) => (
        <div key={q}>
          <h2>{q}</h2>
          <p>{a}</p>
        </div>
      ))}
    </StaticPage>
  ),
});
