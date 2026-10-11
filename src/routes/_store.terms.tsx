import { createFileRoute } from "@tanstack/react-router";
import { meta, StaticPage } from "@/components/store/StaticPage";

export const Route = createFileRoute("/_store/terms")({
  head: () => meta("Terms & Conditions", "Terms for using the Our Visible Universe Store."),
  component: () => (
    <StaticPage eyebrow="Legal" title="Terms & conditions">
      <p>By using this website you agree to these terms.</p>
      <h2>Product information</h2>
      <p>
        We work to keep product details accurate, but the linked retailer's product page is the
        authoritative source for price, availability, specifications and seller information.
      </p>
      <h2>Purchases</h2>
      <p>
        All purchases are made on the linked retailer's website and governed by that retailer's
        terms. We are not a party to your transaction and do not handle payments, shipping or
        returns.
      </p>
      <h2>Affiliate links</h2>
      <p>
        Product links may be affiliate links to Amazon, Flipkart or other retailers. See our
        Affiliate Disclosure for details.
      </p>
      <h2>Liability</h2>
      <p>
        This site is provided "as is". To the extent permitted by law, we are not liable for any
        loss arising from use of the site or products purchased from third parties.
      </p>
    </StaticPage>
  ),
});
