CREATE OR REPLACE FUNCTION public.prevent_duplicate_affiliate_publishing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate_url text;
BEGIN
  candidate_url := COALESCE(NULLIF(btrim(NEW.affiliate_url), ''), NULLIF(btrim(NEW.amazon_url), ''));
  IF candidate_url IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(candidate_url, 0));

  IF NEW.active AND NEW.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id IS DISTINCT FROM NEW.id
      AND COALESCE(NULLIF(btrim(p.affiliate_url), ''), NULLIF(btrim(p.amazon_url), '')) = candidate_url
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'This affiliate URL is already used by another product. Use a different URL before publishing.',
      CONSTRAINT = 'products_duplicate_affiliate_url';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.prevent_duplicate_affiliate_publishing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_duplicate_affiliate_publishing() TO authenticated, service_role;

CREATE TRIGGER prevent_duplicate_affiliate_publishing
BEFORE INSERT OR UPDATE OF affiliate_url, amazon_url, active, deleted_at ON public.products
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_affiliate_publishing();

CREATE INDEX products_effective_affiliate_url_lookup
ON public.products ((COALESCE(NULLIF(btrim(affiliate_url), ''), NULLIF(btrim(amazon_url), ''))));