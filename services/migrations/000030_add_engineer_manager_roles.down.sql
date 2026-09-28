-- Rollback for Migration 000030
-- ==============================
-- WARNING: This rollback will FAIL if any rows exist with:
--   - role = 'engineer' or role = 'manager' (violates restored CHECK)
--   - parent_ask_id IS NOT NULL and both deal_id IS NULL and lead_id IS NULL
--     (violates restored CHECK)
-- Before running this rollback, manually reassign those rows or delete them.
-- ==============================

-- 4. Restore the original implementation_asks_has_parent constraint.
ALTER TABLE implementation_asks DROP CONSTRAINT IF EXISTS implementation_asks_has_parent;
ALTER TABLE implementation_asks ADD CONSTRAINT implementation_asks_has_parent
    CHECK (deal_id IS NOT NULL OR lead_id IS NOT NULL);

-- 3. Drop the parent_ask_id column (cascading sub-task FKs).
DROP INDEX IF EXISTS idx_impl_asks_parent;
ALTER TABLE implementation_asks DROP COLUMN IF EXISTS parent_ask_id;

-- 2. Drop the manager_id column.
DROP INDEX IF EXISTS idx_profiles_manager;
ALTER TABLE profiles DROP COLUMN IF EXISTS manager_id;

-- 1. Restore the original profiles.role CHECK constraint.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('owner', 'admin', 'sales', 'account_manager', 'client'));
