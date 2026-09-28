-- Migration 000031 Down: Revert invitation role/manager and profile onboarded_at
-- ==============================================================================
-- SAFETY NOTICE:
--   - Rolling back drops the new columns added in 000031.
--   - Core user and invitation data remains intact.
-- ==============================================================================

DROP INDEX IF EXISTS idx_invitations_manager;

ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE invitations DROP COLUMN IF EXISTS manager_id;
ALTER TABLE invitations DROP COLUMN IF EXISTS role;

ALTER TABLE profiles DROP COLUMN IF EXISTS onboarded_at;
