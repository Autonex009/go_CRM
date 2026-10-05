BEGIN;

-- Removes only what 000032 added. Asks never referenced this table, so no ask,
-- event or attachment is touched by rolling back.
DROP TABLE IF EXISTS implementation_pipelines;

COMMIT;
