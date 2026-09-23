-- Removes only the asks that were copied from follow_ups, identified by their
-- shared id. Asks raised in the Implementation tab itself have ids of their own
-- and are left alone.
--
-- Safe because 000027 copied rather than moved: every row deleted here still
-- exists in follow_ups.
DELETE FROM implementation_asks a
 WHERE EXISTS (SELECT 1 FROM follow_ups f WHERE f.id = a.id);
