ALTER TABLE public.products ADD COLUMN affiliate_url text;
ALTER TABLE public.products ADD COLUMN retailer text;
ALTER TABLE public.products ADD COLUMN retailer_product_id text;
UPDATE public.products
SET affiliate_url = amazon_url,
    retailer = CASE WHEN amazon_url IS NOT NULL THEN 'Amazon' ELSE NULL END,
    retailer_product_id = amazon_asin
WHERE affiliate_url IS NULL;
COMMENT ON COLUMN public.products.amazon_url IS 'DEPRECATED: replaced by affiliate_url';
COMMENT ON COLUMN public.products.amazon_asin IS 'DEPRECATED: replaced by retailer_product_id';
COMMENT ON COLUMN public.products.amazon_marketplace IS 'DEPRECATED: retailer-neutral links use retailer';