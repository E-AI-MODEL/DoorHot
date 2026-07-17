CREATE TABLE IF NOT EXISTS planner_shadow_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL
    REFERENCES orchestration_runs(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  deterministic_plan jsonb NOT NULL,
  shadow_plan jsonb,
  agreement_score numeric(5,4),
  added_tools text[] NOT NULL DEFAULT '{}',
  removed_tools text[] NOT NULL DEFAULT '{}',
  latency_ms integer NOT NULL,
  status text NOT NULL
    CHECK (status IN ('completed', 'failed', 'skipped')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planner_shadow_run_idx
  ON planner_shadow_evaluations(run_id, created_at DESC);

ALTER TABLE orchestration_events
  ADD COLUMN IF NOT EXISTS execution_group integer NOT NULL DEFAULT 1;
