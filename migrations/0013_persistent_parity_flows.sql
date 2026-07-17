-- Door010 3.0 persistent parity-flow repositories

CREATE TABLE IF NOT EXISTS saved_external_events (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_event_id uuid NOT NULL,
  event_snapshot jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, external_event_id)
);

CREATE INDEX IF NOT EXISTS saved_external_events_user_time_idx
  ON saved_external_events(user_id, saved_at DESC);

ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS source_name text;

CREATE INDEX IF NOT EXISTS vacancies_search_idx
  ON vacancies
  USING gin (
    to_tsvector(
      'dutch',
      coalesce(title, '') || ' ' ||
      coalesce(organization, '') || ' ' ||
      coalesce(description, '')
    )
  );

CREATE INDEX IF NOT EXISTS route_sessions_user_updated_idx
  ON route_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS talent_test_results_user_completed_idx
  ON talent_test_results(user_id, completed_at DESC);
