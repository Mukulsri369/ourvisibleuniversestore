-- Prompt 8: Secure Storefront Page Persistence, Draft Management, Immutable Version History & Atomic Publishing
-- Enforces strict Row Level Security (public visitors cannot read drafts or version history tables directly),
-- composite relational integrity between store_pages and store_page_versions, monotonic revision checks,
-- immutable published version snapshots, and atomic SECURITY DEFINER RPC primitives.

CREATE TABLE public.store_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_scope text NOT NULL DEFAULT 'default'
    CHECK (store_scope = 'default' AND btrim(store_scope) <> '' AND length(store_scope) <= 64 AND store_scope ~ '^[a-z0-9][a-z0-9_-]*$'),
  page_key text NOT NULL
    CHECK (btrim(page_key) <> '' AND length(page_key) <= 120 AND page_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  page_type text NOT NULL DEFAULT 'home'
    CHECK (page_type IN ('home', 'category', 'collection', 'landing', 'custom')),
  slug text NOT NULL
    CHECK (btrim(slug) <> '' AND length(slug) <= 200 AND left(slug, 1) = '/'),
  title text NOT NULL
    CHECK (btrim(title) <> '' AND length(title) <= 200),
  published_version_id uuid,
  published_revision int NOT NULL DEFAULT 0
    CHECK (published_revision >= 0),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_pages_store_scope_page_key_key UNIQUE (store_scope, page_key),
  CONSTRAINT store_pages_store_scope_slug_key UNIQUE (store_scope, slug)
);

CREATE TABLE public.store_page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.store_pages(id) ON DELETE CASCADE,
  store_scope text NOT NULL DEFAULT 'default'
    CHECK (store_scope = 'default' AND btrim(store_scope) <> '' AND length(store_scope) <= 64),
  version_number int NOT NULL
    CHECK (version_number >= 1),
  schema_version text NOT NULL
    CHECK (btrim(schema_version) <> '' AND length(schema_version) <= 32),
  document_snapshot jsonb NOT NULL
    CHECK (
      jsonb_typeof(document_snapshot) = 'object'
      AND (document_snapshot ? 'id')
      AND (document_snapshot ? 'schemaVersion')
      AND (document_snapshot ? 'root')
      AND jsonb_typeof(document_snapshot->'root') = 'array'
      AND pg_column_size(document_snapshot) <= 1048576
    ),
  checksum text NOT NULL
    CHECK (btrim(checksum) <> '' AND length(checksum) <= 128),
  source_draft_revision int
    CHECK (source_draft_revision IS NULL OR source_draft_revision >= 1),
  restored_from_version_id uuid REFERENCES public.store_page_versions(id) ON DELETE SET NULL,
  release_notes text
    CHECK (release_notes IS NULL OR length(release_notes) <= 1000),
  created_by text
    CHECK (created_by IS NULL OR length(created_by) <= 320),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_page_versions_page_id_version_number_key UNIQUE (page_id, version_number),
  CONSTRAINT store_page_versions_id_page_id_key UNIQUE (id, page_id)
);

-- Composite foreign key guaranteeing published_version_id belongs to the exact same store_pages.id
ALTER TABLE public.store_pages
  ADD CONSTRAINT store_pages_published_version_same_page_fkey
  FOREIGN KEY (published_version_id, id)
  REFERENCES public.store_page_versions(id, page_id)
  ON DELETE RESTRICT;

CREATE TABLE public.store_page_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL UNIQUE REFERENCES public.store_pages(id) ON DELETE CASCADE,
  store_scope text NOT NULL DEFAULT 'default'
    CHECK (store_scope = 'default' AND btrim(store_scope) <> '' AND length(store_scope) <= 64),
  schema_version text NOT NULL
    CHECK (btrim(schema_version) <> '' AND length(schema_version) <= 32),
  draft_document jsonb NOT NULL
    CHECK (
      jsonb_typeof(draft_document) = 'object'
      AND (draft_document ? 'id')
      AND (draft_document ? 'schemaVersion')
      AND (draft_document ? 'root')
      AND jsonb_typeof(draft_document->'root') = 'array'
      AND pg_column_size(draft_document) <= 1048576
    ),
  draft_revision int NOT NULL DEFAULT 1
    CHECK (draft_revision >= 1),
  base_published_version_id uuid,
  base_published_revision int NOT NULL DEFAULT 0
    CHECK (base_published_revision >= 0),
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'archived')),
  checksum text NOT NULL
    CHECK (btrim(checksum) <> '' AND length(checksum) <= 128),
  created_by text
    CHECK (created_by IS NULL OR length(created_by) <= 320),
  last_edited_by text
    CHECK (last_edited_by IS NULL OR length(last_edited_by) <= 320),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_page_drafts_base_version_same_page_fkey
    FOREIGN KEY (base_published_version_id, page_id)
    REFERENCES public.store_page_versions(id, page_id)
    ON DELETE SET NULL
);

CREATE TABLE public.store_page_publishing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.store_pages(id) ON DELETE CASCADE,
  store_scope text NOT NULL DEFAULT 'default'
    CHECK (store_scope = 'default' AND btrim(store_scope) <> '' AND length(store_scope) <= 64),
  action_type text NOT NULL
    CHECK (action_type IN ('publish', 'rollback')),
  published_version_id uuid NOT NULL,
  previous_version_id uuid,
  published_revision int NOT NULL
    CHECK (published_revision >= 1),
  draft_revision int
    CHECK (draft_revision IS NULL OR draft_revision >= 1),
  notes text
    CHECK (notes IS NULL OR length(notes) <= 1000),
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_page_publishing_events_published_version_same_page_fkey
    FOREIGN KEY (published_version_id, page_id)
    REFERENCES public.store_page_versions(id, page_id)
    ON DELETE RESTRICT,
  CONSTRAINT store_page_publishing_events_previous_version_same_page_fkey
    FOREIGN KEY (previous_version_id, page_id)
    REFERENCES public.store_page_versions(id, page_id)
    ON DELETE RESTRICT
);

-- Targeted B-tree indexes for actual access paths (no broad GIN index on JSONB payloads)
CREATE INDEX store_pages_scope_slug_idx ON public.store_pages (store_scope, slug);
CREATE INDEX store_pages_published_version_idx ON public.store_pages (published_version_id) WHERE published_version_id IS NOT NULL;
CREATE INDEX store_page_versions_page_version_desc_idx ON public.store_page_versions (page_id, version_number DESC);
CREATE INDEX store_page_versions_page_created_desc_idx ON public.store_page_versions (page_id, created_at DESC);
CREATE INDEX store_page_publishing_events_page_created_desc_idx ON public.store_page_publishing_events (page_id, created_at DESC);

-- Triggers for updated_at and monotonic revisions
CREATE TRIGGER store_pages_updated
  BEFORE UPDATE ON public.store_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_store_page_draft_invariants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.page_id IS DISTINCT FROM OLD.page_id OR NEW.store_scope IS DISTINCT FROM OLD.store_scope THEN
      RAISE EXCEPTION 'Draft page ownership and store_scope cannot be reassigned.'
        USING ERRCODE = '55000';
    END IF;
    IF NEW.draft_revision < OLD.draft_revision THEN
      RAISE EXCEPTION 'Draft revision must be monotonic (cannot decrease from % to %).', OLD.draft_revision, NEW.draft_revision
        USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_store_page_draft_invariants() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER store_page_drafts_invariants
  BEFORE INSERT OR UPDATE ON public.store_page_drafts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_store_page_draft_invariants();

-- Immutability trigger on store_page_versions and store_page_publishing_events
CREATE OR REPLACE FUNCTION public.prevent_immutable_page_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Historical page versions and publishing events are immutable and cannot be modified or deleted.'
    USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_immutable_page_version_mutation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER store_page_versions_immutable
  BEFORE UPDATE OR DELETE ON public.store_page_versions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_page_version_mutation();

CREATE TRIGGER store_page_publishing_events_immutable
  BEFORE UPDATE OR DELETE ON public.store_page_publishing_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_page_version_mutation();

-- Strict Privilege Revocation & Row Level Security
REVOKE ALL ON public.store_pages FROM PUBLIC, anon;
REVOKE ALL ON public.store_page_drafts FROM PUBLIC, anon;
REVOKE ALL ON public.store_page_versions FROM PUBLIC, anon;
REVOKE ALL ON public.store_page_publishing_events FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE ON public.store_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_page_drafts TO authenticated;
GRANT SELECT, INSERT ON public.store_page_versions TO authenticated;
GRANT SELECT, INSERT ON public.store_page_publishing_events TO authenticated;

GRANT ALL ON public.store_pages, public.store_page_drafts, public.store_page_versions, public.store_page_publishing_events TO service_role;

ALTER TABLE public.store_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_page_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_page_publishing_events ENABLE ROW LEVEL SECURITY;

-- Admin-only RLS policies on base tables (public visitors NEVER query base tables directly)
CREATE POLICY "Admins read store_pages"
  ON public.store_pages FOR SELECT TO authenticated
  USING (public.is_admin() AND store_scope = 'default');

CREATE POLICY "Admins insert store_pages"
  ON public.store_pages FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND store_scope = 'default');

CREATE POLICY "Admins update store_pages"
  ON public.store_pages FOR UPDATE TO authenticated
  USING (public.is_admin() AND store_scope = 'default')
  WITH CHECK (public.is_admin() AND store_scope = 'default');

CREATE POLICY "Admins manage store_page_drafts"
  ON public.store_page_drafts FOR ALL TO authenticated
  USING (public.is_admin() AND store_scope = 'default')
  WITH CHECK (public.is_admin() AND store_scope = 'default');

CREATE POLICY "Admins read store_page_versions"
  ON public.store_page_versions FOR SELECT TO authenticated
  USING (public.is_admin() AND store_scope = 'default');

CREATE POLICY "Admins insert store_page_versions"
  ON public.store_page_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND store_scope = 'default');

CREATE POLICY "Admins read store_page_publishing_events"
  ON public.store_page_publishing_events FOR SELECT TO authenticated
  USING (public.is_admin() AND store_scope = 'default');

CREATE POLICY "Admins insert store_page_publishing_events"
  ON public.store_page_publishing_events FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND store_scope = 'default');

-- Controlled Public-Read Function: returns ONLY the active published version snapshot for a page slug
CREATE OR REPLACE FUNCTION public.get_published_store_page(
  _slug text,
  _store_scope text DEFAULT 'default'
)
RETURNS TABLE (
  page_id uuid,
  page_key text,
  page_type text,
  slug text,
  store_scope text,
  version_id uuid,
  version_number int,
  published_revision int,
  schema_version text,
  document_snapshot jsonb,
  checksum text,
  published_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS page_id,
    p.page_key,
    p.page_type,
    p.slug,
    p.store_scope,
    v.id AS version_id,
    v.version_number,
    p.published_revision,
    v.schema_version,
    v.document_snapshot,
    v.checksum,
    p.published_at
  FROM public.store_pages p
  INNER JOIN public.store_page_versions v
    ON v.id = p.published_version_id
   AND v.page_id = p.id
  WHERE p.store_scope = 'default'
    AND _store_scope = 'default'
    AND p.slug = btrim(_slug)
    AND p.published_version_id IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_published_store_page(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_store_page(text, text) TO anon, authenticated, service_role;

-- Atomic Admin Draft Save with Optimistic Concurrency Check
CREATE OR REPLACE FUNCTION public.save_store_page_draft(
  _page_key text,
  _page_type text,
  _slug text,
  _title text,
  _schema_version text,
  _draft_document jsonb,
  _checksum text,
  _expected_draft_revision int DEFAULT NULL,
  _store_scope text DEFAULT 'default'
)
RETURNS TABLE (
  draft_id uuid,
  page_id uuid,
  store_scope text,
  schema_version text,
  draft_revision int,
  base_published_version_id uuid,
  base_published_revision int,
  state text,
  checksum text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page public.store_pages%ROWTYPE;
  v_draft public.store_page_drafts%ROWTYPE;
  v_actor_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: administrator privileges required to save page drafts.'
      USING ERRCODE = '42501';
  END IF;

  IF _store_scope IS DISTINCT FROM 'default' THEN
    RAISE EXCEPTION 'Invalid store_scope: only default scope is permitted.'
      USING ERRCODE = '22023';
  END IF;

  IF _schema_version IS DISTINCT FROM '1.0.0' THEN
    RAISE EXCEPTION 'Unsupported PageDocument schema_version: %.', _schema_version
      USING ERRCODE = '22023';
  END IF;

  IF _draft_document IS NULL
     OR jsonb_typeof(_draft_document) <> 'object'
     OR (_draft_document->>'schemaVersion') IS DISTINCT FROM _schema_version
     OR jsonb_typeof(_draft_document->'root') <> 'array'
     OR pg_column_size(_draft_document) > 1048576 THEN
    RAISE EXCEPTION 'Invalid PageDocument structure or size limit exceeded.'
      USING ERRCODE = '22023';
  END IF;

  SELECT u.email INTO v_actor_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  INSERT INTO public.store_pages (store_scope, page_key, page_type, slug, title)
  VALUES ('default', btrim(_page_key), COALESCE(NULLIF(btrim(_page_type), ''), 'home'), btrim(_slug), btrim(_title))
  ON CONFLICT (store_scope, page_key) DO UPDATE
    SET title = EXCLUDED.title,
        updated_at = now()
  RETURNING * INTO v_page;

  SELECT * INTO v_draft
  FROM public.store_page_drafts d
  WHERE d.page_id = v_page.id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF _expected_draft_revision IS NOT NULL AND _expected_draft_revision <> 0 THEN
      RAISE EXCEPTION 'Draft revision conflict: expected revision %, but no draft exists yet (actual revision 0).', _expected_draft_revision
        USING ERRCODE = '40001',
              DETAIL = 'actual_revision=0';
    END IF;

    INSERT INTO public.store_page_drafts (
      page_id,
      store_scope,
      schema_version,
      draft_document,
      draft_revision,
      base_published_version_id,
      base_published_revision,
      state,
      checksum,
      created_by,
      last_edited_by
    )
    VALUES (
      v_page.id,
      'default',
      _schema_version,
      _draft_document,
      1,
      v_page.published_version_id,
      v_page.published_revision,
      'active',
      btrim(_checksum),
      v_actor_email,
      v_actor_email
    )
    RETURNING * INTO v_draft;
  ELSE
    IF _expected_draft_revision IS NULL OR v_draft.draft_revision <> _expected_draft_revision THEN
      RAISE EXCEPTION 'Draft revision conflict: expected revision %, actual revision is %.', COALESCE(_expected_draft_revision, -1), v_draft.draft_revision
        USING ERRCODE = '40001',
              DETAIL = format('actual_revision=%s', v_draft.draft_revision);
    END IF;

    UPDATE public.store_page_drafts d
    SET schema_version = _schema_version,
        draft_document = _draft_document,
        draft_revision = v_draft.draft_revision + 1,
        state = 'active',
        checksum = btrim(_checksum),
        last_edited_by = COALESCE(v_actor_email, d.last_edited_by),
        updated_at = now()
    WHERE d.id = v_draft.id
    RETURNING * INTO v_draft;
  END IF;

  RETURN QUERY SELECT
    v_draft.id,
    v_draft.page_id,
    v_draft.store_scope,
    v_draft.schema_version,
    v_draft.draft_revision,
    v_draft.base_published_version_id,
    v_draft.base_published_revision,
    v_draft.state,
    v_draft.checksum,
    v_draft.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.save_store_page_draft(text, text, text, text, text, jsonb, text, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_store_page_draft(text, text, text, text, text, jsonb, text, int, text) TO authenticated, service_role;

-- Atomic Publishing Primitive: validates draft revision, creates immutable version snapshot, updates published pointer, and records audit event
CREATE OR REPLACE FUNCTION public.publish_store_page_draft(
  _page_id uuid,
  _expected_draft_revision int,
  _expected_published_revision int DEFAULT NULL,
  _release_notes text DEFAULT NULL,
  _store_scope text DEFAULT 'default'
)
RETURNS TABLE (
  page_id uuid,
  published_version_id uuid,
  previous_version_id uuid,
  version_number int,
  published_revision int,
  draft_revision int,
  checksum text,
  published_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page public.store_pages%ROWTYPE;
  v_draft public.store_page_drafts%ROWTYPE;
  v_version public.store_page_versions%ROWTYPE;
  v_next_version_number int;
  v_prev_version_id uuid;
  v_actor_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: administrator privileges required to publish pages.'
      USING ERRCODE = '42501';
  END IF;

  IF _store_scope IS DISTINCT FROM 'default' THEN
    RAISE EXCEPTION 'Invalid store_scope: only default scope is permitted.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_page
  FROM public.store_pages p
  WHERE p.id = _page_id
    AND p.store_scope = 'default'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Page not found for publishing.'
      USING ERRCODE = 'P0002';
  END IF;

  IF _expected_published_revision IS NOT NULL AND v_page.published_revision <> _expected_published_revision THEN
    RAISE EXCEPTION 'Published revision conflict: expected %, actual %.', _expected_published_revision, v_page.published_revision
      USING ERRCODE = '40001',
            DETAIL = format('actual_published_revision=%s', v_page.published_revision);
  END IF;

  SELECT * INTO v_draft
  FROM public.store_page_drafts d
  WHERE d.page_id = v_page.id
    AND d.store_scope = 'default'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No draft exists for page %.', v_page.id
      USING ERRCODE = 'P0002';
  END IF;

  IF _expected_draft_revision IS NULL OR v_draft.draft_revision <> _expected_draft_revision THEN
    RAISE EXCEPTION 'Draft revision conflict during publish: expected %, actual %.', COALESCE(_expected_draft_revision, -1), v_draft.draft_revision
      USING ERRCODE = '40001',
            DETAIL = format('actual_draft_revision=%s', v_draft.draft_revision);
  END IF;

  IF v_draft.schema_version IS DISTINCT FROM '1.0.0'
     OR jsonb_typeof(v_draft.draft_document) <> 'object'
     OR jsonb_typeof(v_draft.draft_document->'root') <> 'array'
     OR jsonb_array_length(v_draft.draft_document->'root') < 1 THEN
    RAISE EXCEPTION 'Cannot publish incomplete or incompatible draft document.'
      USING ERRCODE = '22023';
  END IF;

  SELECT u.email INTO v_actor_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  SELECT COALESCE(MAX(v.version_number), 0) + 1
  INTO v_next_version_number
  FROM public.store_page_versions v
  WHERE v.page_id = v_page.id;

  v_prev_version_id := v_page.published_version_id;

  INSERT INTO public.store_page_versions (
    page_id,
    store_scope,
    version_number,
    schema_version,
    document_snapshot,
    checksum,
    source_draft_revision,
    release_notes,
    created_by
  )
  VALUES (
    v_page.id,
    'default',
    v_next_version_number,
    v_draft.schema_version,
    v_draft.draft_document,
    v_draft.checksum,
    v_draft.draft_revision,
    NULLIF(btrim(_release_notes), ''),
    v_actor_email
  )
  RETURNING * INTO v_version;

  UPDATE public.store_pages p
  SET published_version_id = v_version.id,
      published_revision = v_page.published_revision + 1,
      published_at = v_version.created_at,
      updated_at = v_version.created_at
  WHERE p.id = v_page.id
  RETURNING * INTO v_page;

  UPDATE public.store_page_drafts d
  SET base_published_version_id = v_version.id,
      base_published_revision = v_page.published_revision
  WHERE d.id = v_draft.id;

  INSERT INTO public.store_page_publishing_events (
    page_id,
    store_scope,
    action_type,
    published_version_id,
    previous_version_id,
    published_revision,
    draft_revision,
    notes,
    actor_id
  )
  VALUES (
    v_page.id,
    'default',
    'publish',
    v_version.id,
    v_prev_version_id,
    v_page.published_revision,
    v_draft.draft_revision,
    NULLIF(btrim(_release_notes), ''),
    auth.uid()
  );

  RETURN QUERY SELECT
    v_page.id,
    v_version.id,
    v_prev_version_id,
    v_version.version_number,
    v_page.published_revision,
    v_draft.draft_revision,
    v_version.checksum,
    v_page.published_at;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_store_page_draft(uuid, int, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_store_page_draft(uuid, int, int, text, text) TO authenticated, service_role;

-- Atomic Rollback / Restore Version Primitive: preserves immutable history by creating a new version snapshot referencing restored_from_version_id
CREATE OR REPLACE FUNCTION public.restore_store_page_version(
  _page_id uuid,
  _target_version_id uuid,
  _expected_published_revision int DEFAULT NULL,
  _sync_draft boolean DEFAULT true,
  _release_notes text DEFAULT NULL,
  _store_scope text DEFAULT 'default'
)
RETURNS TABLE (
  page_id uuid,
  published_version_id uuid,
  restored_from_version_id uuid,
  previous_version_id uuid,
  version_number int,
  published_revision int,
  checksum text,
  published_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page public.store_pages%ROWTYPE;
  v_target public.store_page_versions%ROWTYPE;
  v_new_version public.store_page_versions%ROWTYPE;
  v_next_version_number int;
  v_prev_version_id uuid;
  v_actor_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: administrator privileges required to restore page versions.'
      USING ERRCODE = '42501';
  END IF;

  IF _store_scope IS DISTINCT FROM 'default' THEN
    RAISE EXCEPTION 'Invalid store_scope: only default scope is permitted.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_page
  FROM public.store_pages p
  WHERE p.id = _page_id
    AND p.store_scope = 'default'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Page not found for version restore.'
      USING ERRCODE = 'P0002';
  END IF;

  IF _expected_published_revision IS NOT NULL AND v_page.published_revision <> _expected_published_revision THEN
    RAISE EXCEPTION 'Published revision conflict during restore: expected %, actual %.', _expected_published_revision, v_page.published_revision
      USING ERRCODE = '40001',
            DETAIL = format('actual_published_revision=%s', v_page.published_revision);
  END IF;

  SELECT * INTO v_target
  FROM public.store_page_versions v
  WHERE v.id = _target_version_id
    AND v.page_id = v_page.id
    AND v.store_scope = 'default';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target version does not exist or does not belong to page %.', v_page.id
      USING ERRCODE = '23503';
  END IF;

  IF v_target.schema_version IS DISTINCT FROM '1.0.0'
     OR jsonb_typeof(v_target.document_snapshot) <> 'object'
     OR jsonb_typeof(v_target.document_snapshot->'root') <> 'array'
     OR jsonb_array_length(v_target.document_snapshot->'root') < 1 THEN
    RAISE EXCEPTION 'Target version schema is incompatible and cannot be restored.'
      USING ERRCODE = '22023';
  END IF;

  SELECT u.email INTO v_actor_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  SELECT COALESCE(MAX(v.version_number), 0) + 1
  INTO v_next_version_number
  FROM public.store_page_versions v
  WHERE v.page_id = v_page.id;

  v_prev_version_id := v_page.published_version_id;

  INSERT INTO public.store_page_versions (
    page_id,
    store_scope,
    version_number,
    schema_version,
    document_snapshot,
    checksum,
    restored_from_version_id,
    release_notes,
    created_by
  )
  VALUES (
    v_page.id,
    'default',
    v_next_version_number,
    v_target.schema_version,
    v_target.document_snapshot,
    v_target.checksum,
    v_target.id,
    COALESCE(NULLIF(btrim(_release_notes), ''), format('Restored from version #%s', v_target.version_number)),
    v_actor_email
  )
  RETURNING * INTO v_new_version;

  UPDATE public.store_pages p
  SET published_version_id = v_new_version.id,
      published_revision = v_page.published_revision + 1,
      published_at = v_new_version.created_at,
      updated_at = v_new_version.created_at
  WHERE p.id = v_page.id
  RETURNING * INTO v_page;

  IF _sync_draft THEN
    UPDATE public.store_page_drafts d
    SET schema_version = v_new_version.schema_version,
        draft_document = v_new_version.document_snapshot,
        draft_revision = d.draft_revision + 1,
        base_published_version_id = v_new_version.id,
        base_published_revision = v_page.published_revision,
        checksum = v_new_version.checksum,
        last_edited_by = COALESCE(v_actor_email, d.last_edited_by),
        updated_at = v_new_version.created_at
    WHERE d.page_id = v_page.id;
  END IF;

  INSERT INTO public.store_page_publishing_events (
    page_id,
    store_scope,
    action_type,
    published_version_id,
    previous_version_id,
    published_revision,
    notes,
    actor_id
  )
  VALUES (
    v_page.id,
    'default',
    'rollback',
    v_new_version.id,
    v_prev_version_id,
    v_page.published_revision,
    COALESCE(NULLIF(btrim(_release_notes), ''), format('Restored from version #%s', v_target.version_number)),
    auth.uid()
  );

  RETURN QUERY SELECT
    v_page.id,
    v_new_version.id,
    v_target.id,
    v_prev_version_id,
    v_new_version.version_number,
    v_page.published_revision,
    v_new_version.checksum,
    v_page.published_at;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_store_page_version(uuid, uuid, int, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_store_page_version(uuid, uuid, int, boolean, text, text) TO authenticated, service_role;
