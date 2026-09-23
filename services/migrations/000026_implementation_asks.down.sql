-- Drops only what 000026 created. follow_ups, deal_tasks and activities are
-- untouched by both directions of this migration.
DROP TABLE IF EXISTS ask_attachments;
DROP TABLE IF EXISTS ask_events;
DROP TABLE IF EXISTS implementation_asks;
