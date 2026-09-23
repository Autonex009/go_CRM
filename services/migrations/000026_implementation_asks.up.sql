-- The Implementation tab: engineering asks raised from a deal or a lead.
-- Additive only — follow_ups and deal_tasks are left exactly as they are.

CREATE TABLE IF NOT EXISTS implementation_asks (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NOT NULL, unlike deal_tasks, which has no org column and is therefore
    -- addressable across tenants by anyone holding an id.
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- What the ask hangs off; the CHECK below stops an orphan being created.
    deal_id    UUID REFERENCES deals(id)    ON DELETE CASCADE,
    lead_id    UUID REFERENCES leads(id)    ON DELETE CASCADE,
    -- Derived from the deal or lead, so it cannot disagree with them.
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,

    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    -- Free text: the dialog suggests types already used, but does not limit them.
    type   TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',

    priority TEXT NOT NULL DEFAULT 'p1' CHECK (priority IN ('p0', 'p1', 'p2')),
    -- The seven states from the spec, one kanban column each.
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
        'requested', 'acknowledged', 'in_progress', 'blocked',
        'delivered', 'verified', 'wont_do'
    )),
    -- Shown on the card as "Blocked · waiting on client".
    blocked_reason TEXT NOT NULL DEFAULT '',

    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- A timestamp, not a date, so a carried-over follow_ups.due_at keeps its time.
    due_at TIMESTAMPTZ,

    -- Manual ordering within a column, like deals.position.
    position DOUBLE PRECISION NOT NULL DEFAULT 0,

    delivered_at TIMESTAMPTZ,
    verified_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT implementation_asks_has_parent
        CHECK (deal_id IS NOT NULL OR lead_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_impl_asks_org_status ON implementation_asks(org_id, status);
CREATE INDEX IF NOT EXISTS idx_impl_asks_deal       ON implementation_asks(deal_id);
CREATE INDEX IF NOT EXISTS idx_impl_asks_lead       ON implementation_asks(lead_id);
CREATE INDEX IF NOT EXISTS idx_impl_asks_assignee   ON implementation_asks(org_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_impl_asks_due        ON implementation_asks(org_id, due_at);

-- Who changed what, and when.
--
-- Its own table rather than activities rows: that table's entity_type CHECK has
-- no ask type and no column to point at one, and from/to kept structured stays
-- queryable. The deal timeline still gets activities rows for the headlines.
CREATE TABLE IF NOT EXISTS ask_events (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ask_id UUID NOT NULL REFERENCES implementation_asks(id) ON DELETE CASCADE,
    org_id UUID NOT NULL,
    -- Nullable, so history survives a departing colleague's profile.
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    kind TEXT NOT NULL CHECK (kind IN (
        'created', 'status_changed', 'assigned', 'priority_changed',
        'due_changed', 'edited', 'blocked', 'attached', 'detached'
    )),
    -- Which field moved, for 'edited'.
    field      TEXT NOT NULL DEFAULT '',
    from_value TEXT NOT NULL DEFAULT '',
    to_value   TEXT NOT NULL DEFAULT '',
    note       TEXT NOT NULL DEFAULT '',

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ask_events_ask ON ask_events(ask_id, occurred_at DESC);

-- Files attached to an ask. The bytes live in Supabase Storage; this holds the
-- pointer and the metadata needed to list and authorise a download.
CREATE TABLE IF NOT EXISTS ask_attachments (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ask_id UUID NOT NULL REFERENCES implementation_asks(id) ON DELETE CASCADE,
    org_id UUID NOT NULL,

    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT '',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    -- {org_id}/{ask_id}/{uuid}-{file_name}. UNIQUE so a retry cannot double-register.
    storage_path TEXT NOT NULL UNIQUE,

    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ask_attachments_ask ON ask_attachments(ask_id);
