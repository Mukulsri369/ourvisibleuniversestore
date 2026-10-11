import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logOutboundClick } from "@/lib/store";

/**
 * Opens the product's own stored retailer affiliate URL, untouched.
 * The URL is never rewritten — affiliate tracking parameters are preserved.
 */
export function BuyButton({
  productId,
  url,
  size = "lg",
  className,
  label = "Buy now",
  track = true,
}: {
  productId: string;
  url: string | null;
  size?: "sm" | "lg" | "xl";
  className?: string;
  label?: string;
  track?: boolean;
}) {
  if (!url) {
    return (
      <span
        className={cn(
          buttonVariants({ variant: "outline", size }),
          "pointer-events-none opacity-60",
          className,
        )}
      >
        Link unavailable
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      onClick={() => track && logOutboundClick(productId)}
      className={cn(buttonVariants({ variant: "affiliate", size }), className)}
    >
      {label}
      <ExternalLink />
    </a>
  );
}
