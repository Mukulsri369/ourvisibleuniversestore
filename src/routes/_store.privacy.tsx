import { createFileRoute } from "@tanstack/react-router";
import { meta, StaticPage } from "@/components/store/StaticPage";

export const Route = createFileRoute("/_store/privacy")({
  head: () =>
    meta("Privacy Policy", "How the Our Visible Universe Store handles your information."),
  component: () => (
    <StaticPage eyebrow="Legal" title="Privacy policy">
      <p>
        We respect your privacy. This store does not require an account and does not collect payment
        information.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          Anonymous counts of clicks on “Buy now” buttons (product and time only — no personal
          data).
        </li>
        <li>Standard technical logs from our hosting provider.</li>
      </ul>
      <h2>Partner retailers</h2>
      <p>
        When you follow an affiliate link, the retailer may set cookies to attribute purchases to
        our affiliate account. That retailer's privacy notice applies on its website.
      </p>
      <h2>Contact</h2>
      <p>For privacy questions, please use the details on our Contact page.</p>
    </StaticPage>
  ),
});
