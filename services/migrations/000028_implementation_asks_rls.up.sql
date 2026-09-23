-- These tables are reached only through the gateway, which connects as their
-- owner and so bypasses RLS. Enabling it with no policies closes the PostgREST
-- door that the anon and publishable keys come through — the same posture deals
-- and leads already have.
ALTER TABLE implementation_asks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ask_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ask_attachments     ENABLE ROW LEVEL SECURITY;
