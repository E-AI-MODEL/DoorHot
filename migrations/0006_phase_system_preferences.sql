-- Door010 3.0 phase-system preferences

CREATE TABLE phase_system_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL
    CHECK (scope IN ('organization', 'user', 'conversation')),
  scope_id text NOT NULL,
  phase_system_key text NOT NULL
    CHECK (phase_system_key IN ('phase-4', 'phase-5', 'phase-9')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, scope_id)
);

CREATE INDEX phase_system_preferences_lookup_idx
  ON phase_system_preferences(scope, scope_id, enabled);

ALTER TABLE phase_evaluations
  ADD COLUMN resolved_phase_system_key text,
  ADD COLUMN phase_system_source text,
  ADD COLUMN mapped_detector_phase text,
  ADD COLUMN phase_transition_allowed boolean,
  ADD COLUMN phase_entry_satisfied boolean,
  ADD COLUMN phase_exit_satisfied boolean;
