BEGIN;

-- One implementation pipeline per company: the Implementation tab groups its
-- asks into a kanban per company, and a pipeline names who manages it.
--
-- Additive only. No existing table is altered, updated or dropped: asks join a
-- pipeline through the (org_id, account_id) they already carry, so not a single
-- ask row is rewritten. Pipelines are archived, never deleted, and a company
-- cannot be hard-deleted out from under one (accounts are soft-deleted anyway).
CREATE TABLE IF NOT EXISTS implementation_pipelines (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id  UUID NOT NULL REFERENCES accounts(id)      ON DELETE RESTRICT,
    -- The engineering manager who runs this company's work. They see and move
    -- every ask in the pipeline, whoever it is assigned to.
    manager_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    description TEXT NOT NULL DEFAULT '',
    archived_at TIMESTAMPTZ,
    created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT implementation_pipelines_one_per_company UNIQUE (org_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_impl_pipelines_manager
    ON implementation_pipelines (org_id, manager_id);

-- Same posture as 000028: the gateway connects as the table owner and enforces
-- access itself; RLS keeps the table closed to Supabase's anon/authenticated
-- roles, which have no business reading it directly.
ALTER TABLE implementation_pipelines ENABLE ROW LEVEL SECURITY;

-- Backfill a pipeline for every company that already has asks, so the board
-- shows today's work under its company from the first load. Read-only on
-- implementation_asks; ON CONFLICT makes a re-run a no-op.
INSERT INTO implementation_pipelines (org_id, account_id, created_at)
SELECT a.org_id, a.account_id, min(a.created_at)
  FROM implementation_asks a
  JOIN accounts ac ON ac.id = a.account_id
 WHERE a.account_id IS NOT NULL
 GROUP BY a.org_id, a.account_id
ON CONFLICT (org_id, account_id) DO NOTHING;

COMMIT;
