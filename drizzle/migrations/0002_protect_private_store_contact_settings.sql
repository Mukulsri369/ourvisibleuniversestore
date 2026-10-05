REVOKE SELECT ON public.site_settings FROM anon;
DROP POLICY IF EXISTS "Public reads settings" ON public.site_settings;
CREATE POLICY "Admins read settings" ON public.site_settings FOR SELECT TO authenticated USING (public.is_admin());

CREATE VIEW public.public_site_settings
WITH (security_invoker = true)
AS
SELECT id, store_name, logo_url, instagram_url, affiliate_disclosure, footer_text, social_links, updated_at
FROM public.site_settings;

GRANT SELECT (id, store_name, logo_url, instagram_url, affiliate_disclosure, footer_text, social_links, updated_at) ON public.site_settings TO anon;
GRANT SELECT ON public.public_site_settings TO anon;

CREATE POLICY "Public reads singleton settings" ON public.site_settings FOR SELECT TO anon USING (id = 1);