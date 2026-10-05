ALTER TABLE public.site_settings ALTER COLUMN affiliate_disclosure SET DEFAULT 'Our Visible Universe participates in affiliate programs from Amazon, Flipkart and other retailers. We may earn a commission from qualifying purchases made through our links, at no extra cost to you.';

CREATE OR REPLACE FUNCTION public.validate_product_affiliate_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.affiliate_url IS NOT NULL AND (
    length(NEW.affiliate_url) > 2048 OR
    NEW.affiliate_url !~ '^https://[^[:space:]]+$'
  ) THEN
    RAISE EXCEPTION 'Affiliate URL must be a valid secure URL.';
  END IF;
  IF NEW.retailer IS NOT NULL AND length(NEW.retailer) > 100 THEN
    RAISE EXCEPTION 'Retailer name is too long.';
  END IF;
  IF NEW.retailer_product_id IS NOT NULL AND length(NEW.retailer_product_id) > 200 THEN
    RAISE EXCEPTION 'Retailer product ID is too long.';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER validate_product_affiliate_fields
BEFORE INSERT OR UPDATE OF affiliate_url, retailer, retailer_product_id ON public.products
FOR EACH ROW EXECUTE FUNCTION public.validate_product_affiliate_fields();