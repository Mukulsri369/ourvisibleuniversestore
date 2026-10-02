CREATE TABLE public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admins (email) VALUES ('mukul.srivastava.025@gmail.com');

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins a
    JOIN auth.users u ON lower(u.email) = lower(a.email)
    WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
CREATE POLICY "Admins read admins" ON public.admins FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active categories" ON public.categories FOR SELECT TO anon, authenticated USING (active OR public.is_admin());
CREATE POLICY "Admins insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update categories" ON public.categories FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete categories" ON public.categories FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.categories (name, slug, description, sort_order) VALUES
('Astronomy & Telescopes','astronomy-telescopes','Tools for observing the night sky.',1),
('Space Gadgets','space-gadgets','Bring a little cosmos into everyday life.',2),
('Astronomy Apparel','astronomy-apparel','Wear your curiosity.',3),
('Galaxy & Nebula','galaxy-nebula','Cosmic-inspired objects and décor.',4),
('Solar System','solar-system','Planets, moons and our cosmic neighbourhood.',5),
('Space Décor','space-decor','Turn any room into an observatory.',6),
('Astronomy Gifts','astronomy-gifts','Thoughtful gifts for stargazers.',7),
('Educational & Science','educational-science','Learn how the universe works.',8),
('Kids & Learning','kids-learning','Spark curiosity in young explorers.',9),
('Space Accessories','space-accessories','Small cosmic touches for every day.',10);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  description text,
  brand text,
  subcategory text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  amazon_url text,
  amazon_asin text,
  amazon_marketplace text DEFAULT 'amazon.in',
  price numeric(12,2),
  currency text DEFAULT 'INR',
  price_updated_at timestamptz,
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_public_idx ON public.products (active, deleted_at, created_at DESC);
CREATE INDEX products_category_idx ON public.products (category_id);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads live products" ON public.products FOR SELECT TO anon, authenticated
  USING ((active AND deleted_at IS NULL) OR public.is_admin());
CREATE POLICY "Admins insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update products" ON public.products FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete products" ON public.products FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.product_is_live(_pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.products WHERE id = _pid AND active AND deleted_at IS NULL)
$$;
GRANT EXECUTE ON FUNCTION public.product_is_live(uuid) TO anon, authenticated;

CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  storage_path text,
  alt_text text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_images_pid ON public.product_images (product_id, sort_order);

CREATE TABLE public.product_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  feature text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
CREATE INDEX product_features_pid ON public.product_features (product_id, sort_order);

CREATE TABLE public.product_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag text NOT NULL
);
CREATE INDEX product_tags_pid ON public.product_tags (product_id);
CREATE INDEX product_tags_tag ON public.product_tags (lower(tag));

GRANT SELECT ON public.product_images, public.product_features, public.product_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images, public.product_features, public.product_tags TO authenticated;
GRANT ALL ON public.product_images, public.product_features, public.product_tags TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads images" ON public.product_images FOR SELECT TO anon, authenticated USING (public.product_is_live(product_id) OR public.is_admin());
CREATE POLICY "Admins write images" ON public.product_images FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Public reads features" ON public.product_features FOR SELECT TO anon, authenticated USING (public.product_is_live(product_id) OR public.is_admin());
CREATE POLICY "Admins write features" ON public.product_features FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Public reads tags" ON public.product_tags FOR SELECT TO anon, authenticated USING (public.product_is_live(product_id) OR public.is_admin());
CREATE POLICY "Admins write tags" ON public.product_tags FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.site_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name text NOT NULL DEFAULT 'Our Visible Universe',
  logo_url text,
  instagram_url text,
  contact_email text,
  affiliate_disclosure text NOT NULL DEFAULT 'As an Amazon Associate, Our Visible Universe earns from qualifying purchases. When you buy through links on this site, we may earn a commission at no extra cost to you.',
  footer_text text NOT NULL DEFAULT 'Explore the universe. Discover something extraordinary.',
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.site_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER settings_updated BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.site_settings (id) VALUES (1);

CREATE TABLE public.outbound_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbound_clicks_pid ON public.outbound_clicks (product_id);
GRANT INSERT ON public.outbound_clicks TO anon;
GRANT SELECT, INSERT ON public.outbound_clicks TO authenticated;
GRANT ALL ON public.outbound_clicks TO service_role;
ALTER TABLE public.outbound_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone logs clicks on live products" ON public.outbound_clicks FOR INSERT TO anon, authenticated WITH CHECK (public.product_is_live(product_id));
CREATE POLICY "Admins read clicks" ON public.outbound_clicks FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins read store images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'store-images' AND public.is_admin());
CREATE POLICY "Admins upload store images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'store-images' AND public.is_admin());
CREATE POLICY "Admins update store images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'store-images' AND public.is_admin());
CREATE POLICY "Admins delete store images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'store-images' AND public.is_admin());
