import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Instagram, Mail } from "lucide-react";
import { meta, StaticPage } from "@/components/store/StaticPage";
import { settingsQuery } from "@/lib/store";

export const Route = createFileRoute("/_store/contact")({
  head: () => meta("Contact", "Get in touch with the Our Visible Universe Store team."),
  component: Contact,
});

function Contact() {
  const { data: s } = useQuery(settingsQuery);
  return (
    <StaticPage eyebrow="Open a channel" title="Contact" intro="Questions, product suggestions or partnerships — we'd love to hear from you.">
      <p>For order, payment, delivery or return questions, please contact the retailer shown on the linked product page.</p>
      <div className="not-prose mt-6 grid gap-3 sm:grid-cols-2">
        {s?.contact_email && (
          <a href={`mailto:${s.contact_email}`} className="glass flex items-center gap-3 rounded-2xl p-5 text-foreground hover:border-primary/40">
            <Mail className="size-5 text-primary" /> {s.contact_email}
          </a>
        )}
        {s?.instagram_url && (
          <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="glass flex items-center gap-3 rounded-2xl p-5 text-foreground hover:border-primary/40">
            <Instagram className="size-5 text-primary" /> Message us on Instagram
          </a>
        )}
        {!s?.contact_email && !s?.instagram_url && <p>Contact details will be published soon.</p>}
      </div>
    </StaticPage>
  );
}
