-- Door010 3.0 parity flows 5 through 9

CREATE TABLE route_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  selected_answer_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE talent_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schema_version text NOT NULL,
  answers jsonb NOT NULL,
  scores jsonb NOT NULL,
  ranked_sectors jsonb NOT NULL,
  primary_sector text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX talent_test_results_user_time_idx
  ON talent_test_results(user_id, completed_at DESC);

CREATE TABLE scraped_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_url text NOT NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz,
  event_url text,
  retrieved_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  fingerprint text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scraped_events_expiry_start_idx
  ON scraped_events(expires_at, starts_at);

ALTER TABLE saved_events
  ADD COLUMN IF NOT EXISTS saved_event_snapshot jsonb;

CREATE INDEX IF NOT EXISTS advisor_notes_candidate_time_idx
  ON advisor_notes(candidate_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS appointments_advisor_time_idx
  ON appointments(advisor_user_id, starts_at DESC);
