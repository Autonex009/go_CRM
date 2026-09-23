-- Carries existing Actions into the Implementation tab that replaces them.
--
-- A copy, never a move: follow_ups keeps every row, and retiring it is a later
-- decision. The table was empty when this was written, so today this is a no-op;
-- it exists because rows added before deploy would otherwise be orphaned.
-- Idempotent — an ask already carrying a follow-up's id is skipped.
INSERT INTO implementation_asks (
    id, org_id, deal_id, lead_id, account_id,
    title, type, priority, status, assigned_to,
    due_at, delivered_at, created_at, updated_at
)
SELECT
    f.id,
    f.org_id,
    f.deal_id,
    f.lead_id,
    f.account_id,
    f.title,
    -- follow_ups had no type; naming the origin keeps these identifiable.
    'Follow-up',
    CASE f.priority
        WHEN 'high'   THEN 'p0'
        WHEN 'medium' THEN 'p1'
        ELSE               'p2'
    END,
    CASE f.status
        WHEN 'in_progress' THEN 'in_progress'
        -- 'verified' would claim a sign-off that never happened.
        WHEN 'done'        THEN 'delivered'
        ELSE                    'requested'
    END,
    f.assigned_to,
    f.due_at,
    f.completed_at,
    f.created_at,
    f.updated_at
FROM follow_ups f
-- An action with no deal and no lead cannot satisfy the parent CHECK. It stays
-- in follow_ups rather than being dropped or given a parent it never had.
WHERE (f.deal_id IS NOT NULL OR f.lead_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM implementation_asks a WHERE a.id = f.id);
