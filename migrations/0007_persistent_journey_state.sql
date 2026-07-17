-- Door010 3.0 persistent journey state support

ALTER TABLE journey_states
  ADD COLUMN IF NOT EXISTS selected_entities jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS events jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS journey_states_profile_unique_idx
  ON journey_states(profile_id);

CREATE INDEX IF NOT EXISTS phase_evaluations_profile_time_idx
  ON phase_evaluations(profile_id, evaluated_at DESC);
