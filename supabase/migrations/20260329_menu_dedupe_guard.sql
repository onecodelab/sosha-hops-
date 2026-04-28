-- BARO OS: Menu uniqueness guard
-- This migration adds a unique index so future imports update instead of duplicating.
-- Existing duplicates should be removed manually before applying this migration.

BEGIN;

-- Prevent future duplicates for the same organization + branch + normalized name.
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_unique_org_branch_name
  ON public.menu (
    organization_id,
    COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    LOWER(BTRIM(REGEXP_REPLACE(COALESCE(name, ''), '\s+', ' ', 'g')))
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
