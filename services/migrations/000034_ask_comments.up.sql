-- Migration 000034: discussion comments and @mentions on implementation asks.
-- Additive only.

CREATE TABLE IF NOT EXISTS ask_comments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ask_id            UUID NOT NULL REFERENCES implementation_asks(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES ask_comments(id) ON DELETE CASCADE,
    author_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content           TEXT NOT NULL CHECK (btrim(content) <> '' AND char_length(content) <= 5000),
    edited_at         TIMESTAMPTZ,
    -- Soft delete: the row and its text are kept, only hidden from readers.
    deleted_at        TIMESTAMPTZ,
    deleted_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ask_comments_ask
    ON ask_comments(ask_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_ask_comments_parent
    ON ask_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ask_comments_author_recent
    ON ask_comments(author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ask_comment_mentions (
    comment_id        UUID NOT NULL REFERENCES ask_comments(id) ON DELETE CASCADE,
    org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_ask_comment_mentions_user
    ON ask_comment_mentions(org_id, mentioned_user_id, created_at DESC);

-- When each person last read an ask's discussion; drives the unread badge.
CREATE TABLE IF NOT EXISTS ask_comment_reads (
    ask_id       UUID NOT NULL REFERENCES implementation_asks(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ask_id, user_id)
);

ALTER TABLE implementation_asks
    ADD COLUMN IF NOT EXISTS comment_count INT NOT NULL DEFAULT 0;

ALTER TABLE ask_events DROP CONSTRAINT IF EXISTS ask_events_kind_check;
ALTER TABLE ask_events ADD CONSTRAINT ask_events_kind_check CHECK (kind IN (
    'created', 'status_changed', 'assigned', 'priority_changed',
    'due_changed', 'edited', 'blocked', 'attached', 'detached',
    'comment_deleted'
));

ALTER TABLE ask_comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ask_comment_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ask_comment_reads    ENABLE ROW LEVEL SECURITY;
