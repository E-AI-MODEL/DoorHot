CREATE TABLE IF NOT EXISTS orchestration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  user_id uuid,
  conversation_id uuid,
  intent text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  plan jsonb NOT NULL,
  answer text,
  latency_ms integer,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS orchestration_runs_user_idx
  ON orchestration_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orchestration_runs_status_idx
  ON orchestration_runs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS orchestration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL
    REFERENCES orchestration_runs(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  event_type text NOT NULL,
  capability text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
  tool_key text,
  input_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  latency_ms integer,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, sequence)
);

CREATE INDEX IF NOT EXISTS orchestration_events_run_idx
  ON orchestration_events(run_id, sequence);
