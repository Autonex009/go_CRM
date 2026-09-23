-- A managed list of ask types, per workspace.
--
-- Types used to be inferred from whatever asks happened to exist, which meant a
-- type could not be created before its first ask or removed without deleting
-- every ask using it. This makes the list a thing of its own.
--
-- implementation_asks.type stays free TEXT and is deliberately not a foreign
-- key: removing a type from the list must not rewrite the history of asks that
-- already carry it.
CREATE TABLE IF NOT EXISTS ask_types (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name   TEXT NOT NULL CHECK (btrim(name) <> ''),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive, so "Client demand" and "client demand" cannot both exist.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ask_types_org_name
    ON ask_types(org_id, lower(btrim(name)));

ALTER TABLE ask_types ENABLE ROW LEVEL SECURITY;

-- Seed from the types already in use, so nothing an org has typed disappears
-- the moment the list becomes explicit.
INSERT INTO ask_types (org_id, name)
SELECT DISTINCT a.org_id, btrim(a.type)
  FROM implementation_asks a
 WHERE btrim(a.type) <> ''
   AND NOT EXISTS (
       SELECT 1 FROM ask_types t
        WHERE t.org_id = a.org_id
          AND lower(btrim(t.name)) = lower(btrim(a.type))
   );
