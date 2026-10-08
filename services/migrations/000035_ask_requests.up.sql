-- Migration 000035: manager ask requests reviewed from the Deals page.
-- Additive only. Existing asks keep review_status NULL (no review needed).

ALTER TABLE implementation_asks
    ADD COLUMN IF NOT EXISTS review_status TEXT
        CHECK (review_status IN ('pending', 'approved', 'rejected')),
    ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_note  TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_implementation_asks_review
    ON implementation_asks(org_id, review_status, submitted_at DESC)
    WHERE review_status IS NOT NULL;

-- A request may be raised before its company or deal is known.
ALTER TABLE implementation_asks DROP CONSTRAINT IF EXISTS implementation_asks_has_parent;
ALTER TABLE implementation_asks ADD CONSTRAINT implementation_asks_has_parent
    CHECK (deal_id IS NOT NULL OR lead_id IS NOT NULL OR parent_ask_id IS NOT NULL
           OR account_id IS NOT NULL OR review_status IS NOT NULL);

ALTER TABLE ask_events DROP CONSTRAINT IF EXISTS ask_events_kind_check;
ALTER TABLE ask_events ADD CONSTRAINT ask_events_kind_check CHECK (kind IN (
    'created', 'status_changed', 'assigned', 'priority_changed',
    'due_changed', 'edited', 'blocked', 'attached', 'detached',
    'comment_deleted', 'submitted', 'approved', 'rejected', 'deal_linked'
));
