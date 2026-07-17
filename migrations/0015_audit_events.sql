-- Door010 3.0 immutable audit trail

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  request_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_occurred_idx
  ON audit_events(occurred_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_actor_idx
  ON audit_events(actor_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_target_idx
  ON audit_events(target_type, target_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_action_idx
  ON audit_events(action, occurred_at DESC);
