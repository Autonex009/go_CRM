-- Migration 000036: free-form notes on deal cards, autosaved.
-- Additive only. Kept apart from deals.notes, which the deal editor rewrites
-- on every save, so autosave and the editor can never overwrite each other.

ALTER TABLE deals
    ADD COLUMN IF NOT EXISTS card_notes            TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS card_notes_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS card_notes_updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Earlier versions of a deal's notes, so an overwrite never loses text.
CREATE TABLE IF NOT EXISTS deal_note_revisions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id    UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    edited_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    edited_at  TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_note_revisions_deal
    ON deal_note_revisions(deal_id, created_at DESC);

ALTER TABLE deal_note_revisions ENABLE ROW LEVEL SECURITY;
