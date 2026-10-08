-- Intentionally non-destructive: rolling back must not drop request data, and
-- the stricter has_parent check would reject requests saved without a company.
SELECT 1;
