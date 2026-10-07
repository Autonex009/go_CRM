-- Migration 000033: Allow implementation asks to belong directly to an account (company pipeline)
-- =========================================================================================
ALTER TABLE implementation_asks DROP CONSTRAINT IF EXISTS implementation_asks_has_parent;
ALTER TABLE implementation_asks ADD CONSTRAINT implementation_asks_has_parent
    CHECK (deal_id IS NOT NULL OR lead_id IS NOT NULL OR parent_ask_id IS NOT NULL OR account_id IS NOT NULL);
