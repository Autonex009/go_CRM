-- Migration 000031: Add role and manager to invitations, plus onboarded_at to profiles
-- ====================================================================================
-- DATA SAFETY GUARANTEES:
--   - Fully additive & non-destructive: NO data is deleted or altered.
--   - 'invitations.role' has DEFAULT 'sales', exactly preserving existing behavior for all rows.
--   - 'invitations.manager_id' is nullable (DEFAULT NULL), preserving existing rows.
--   - 'profiles.onboarded_at' is nullable (DEFAULT NULL), preserving existing rows.
--   - All ADD COLUMN statements use IF NOT EXISTS.
--   - Constraints use DROP CONSTRAINT IF EXISTS before ADD CONSTRAINT to prevent conflicts.
-- ====================================================================================

-- 1. Add 'role' to invitations so invited teammates join with their designated role.
--    Existing pending/historical invitations receive 'sales' (the legacy default).
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'sales';

ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_role_check
    CHECK (role IN ('owner', 'admin', 'sales', 'account_manager', 'client', 'engineer', 'manager'));

-- 2. Add 'manager_id' to invitations so engineers can have their manager pre-assigned upon accepting.
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_manager ON invitations(manager_id);

-- 3. Add 'onboarded_at' to profiles for tracking role-specific guided onboarding completion.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
