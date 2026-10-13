GRANT INSERT, DELETE ON public.admins TO authenticated;

DROP POLICY IF EXISTS "Admins insert admins" ON public.admins;
CREATE POLICY "Admins insert admins" ON public.admins FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete admins" ON public.admins;
CREATE POLICY "Admins delete admins" ON public.admins FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.is_approved_admin_email(check_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins a
    WHERE lower(a.email) = lower(trim(check_email))
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_approved_admin_email(text) TO anon, authenticated;
