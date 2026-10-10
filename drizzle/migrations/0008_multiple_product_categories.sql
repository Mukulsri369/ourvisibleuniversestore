ALTER TABLE public.products ADD COLUMN category_ids uuid[] NOT NULL DEFAULT '{}';
UPDATE public.products SET category_ids = ARRAY[category_id] WHERE category_id IS NOT NULL;
CREATE INDEX products_category_ids_idx ON public.products USING gin(category_ids);
CREATE OR REPLACE FUNCTION public.validate_product_categories() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF cardinality(NEW.category_ids) = 0 AND NEW.category_id IS NOT NULL THEN
      NEW.category_ids := ARRAY[NEW.category_id];
    END IF;
  ELSIF NEW.category_id IS DISTINCT FROM OLD.category_id AND NEW.category_ids IS NOT DISTINCT FROM OLD.category_ids THEN
    NEW.category_ids := array_remove(NEW.category_ids, OLD.category_id);
    IF NEW.category_id IS NOT NULL THEN NEW.category_ids := ARRAY[NEW.category_id] || array_remove(NEW.category_ids, NEW.category_id); END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW.category_ids) AS selected(id) WHERE id IS NULL OR NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = selected.id)) THEN
    RAISE EXCEPTION 'Please select valid product categories.' USING ERRCODE = '23503';
  END IF;
  IF cardinality(NEW.category_ids) <> (SELECT count(DISTINCT id) FROM unnest(NEW.category_ids) AS selected(id)) THEN
    RAISE EXCEPTION 'Product categories must not contain duplicates.' USING ERRCODE = '23514';
  END IF;
  NEW.category_id := NEW.category_ids[1];
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_product_categories BEFORE INSERT OR UPDATE OF category_id, category_ids ON public.products FOR EACH ROW EXECUTE FUNCTION public.validate_product_categories();
CREATE OR REPLACE FUNCTION public.remove_deleted_product_category() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products SET category_ids = array_remove(category_ids, OLD.id) WHERE category_ids @> ARRAY[OLD.id];
  RETURN OLD;
END;
$$;
CREATE TRIGGER remove_deleted_product_category BEFORE DELETE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.remove_deleted_product_category();
REVOKE ALL ON FUNCTION public.validate_product_categories() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_deleted_product_category() FROM PUBLIC, anon, authenticated;
COMMENT ON COLUMN public.products.category_ids IS 'All assigned categories in selection order; category_id mirrors the first category for backwards compatibility.';