-- Migration 000030: Add 'engineer' and 'manager' roles
-- =====================================================
-- SAFETY: This migration is fully additive & non-destructive.
--   - No data is deleted, no columns are dropped, no rows are altered.
--   - Only CHECK constraints are replaced (wider set of allowed values).
--   - New columns use IF NOT EXISTS and have NULL defaults, so existing rows
--     are untouched.
--   - ON DELETE SET NULL / CASCADE behaviours match existing FK patterns.
-- =====================================================

-- 1. Widen the profiles.role CHECK to accept 'manager' and 'engineer'.
--    The original constraint was defined inline in 000001_init.up.sql as:
--      CHECK (role IN ('owner', 'admin', 'sales', 'account_manager', 'client'))
--    PostgreSQL auto-names that "profiles_role_check". We drop it by name.
--    IF EXISTS ensures this is safe even if the constraint was already modified.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('owner', 'admin', 'sales', 'account_manager', 'client', 'engineer', 'manager'));

-- 2. Allow engineers to have a reporting manager (org hierarchy).
--    NULL means "no manager assigned yet", which is safe for existing rows.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_manager ON profiles(manager_id);

-- 3. Add parent_ask_id to implementation_asks to support sub-tasks.
--    NULL means "this is a top-level ask", which is safe for all existing rows.
--    ON DELETE CASCADE: deleting a parent ask removes its sub-tasks.
ALTER TABLE implementation_asks ADD COLUMN IF NOT EXISTS parent_ask_id UUID REFERENCES implementation_asks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_impl_asks_parent ON implementation_asks(parent_ask_id);

-- 4. Widen the implementation_asks_has_parent constraint to allow sub-tasks
--    that have neither a deal nor a lead but DO have a parent_ask_id.
--    Existing rows all satisfy (deal_id IS NOT NULL OR lead_id IS NOT NULL)
--    which is a subset of the new constraint, so no rows are invalidated.
ALTER TABLE implementation_asks DROP CONSTRAINT IF EXISTS implementation_asks_has_parent;
ALTER TABLE implementation_asks ADD CONSTRAINT implementation_asks_has_parent
    CHECK (deal_id IS NOT NULL OR lead_id IS NOT NULL OR parent_ask_id IS NOT NULL);
