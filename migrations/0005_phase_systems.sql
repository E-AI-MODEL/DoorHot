-- Door010 3.0 switchable phase systems

CREATE TABLE phase_system_definitions (
  system_key text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  schema_version text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE phase_system_phases (
  system_key text NOT NULL
    REFERENCES phase_system_definitions(system_key) ON DELETE CASCADE,
  phase_code text NOT NULL,
  title text NOT NULL,
  sort integer NOT NULL,
  canonical_range jsonb NOT NULL DEFAULT '[]'::jsonb,
  entry_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  exit_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  optional_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_previous_phases jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_next_phases jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_next_phase text,
  PRIMARY KEY (system_key, phase_code),
  UNIQUE (system_key, sort)
);

ALTER TABLE journey_states
  ADD COLUMN phase_system_key text NOT NULL DEFAULT 'phase-5',
  ADD COLUMN canonical_journey_position text,
  ADD COLUMN completed_phase_codes jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE phase_system_switches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_state_id uuid NOT NULL
    REFERENCES journey_states(id) ON DELETE CASCADE,
  source_system_key text NOT NULL,
  target_system_key text NOT NULL,
  source_phase_code text NOT NULL,
  target_phase_code text NOT NULL,
  canonical_position text NOT NULL,
  exact_mapping boolean NOT NULL,
  switched_at timestamptz NOT NULL DEFAULT now()
);
