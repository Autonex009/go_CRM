-- Intentionally non-destructive: rolling back must not drop comment data.
-- The new tables and column are unused by older code and safe to leave in place.
SELECT 1;
