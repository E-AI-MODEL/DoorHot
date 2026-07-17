CREATE TABLE IF NOT EXISTS knowledge_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_key text NOT NULL UNIQUE,
  connector_type text NOT NULL
    CHECK (connector_type IN ('json', 'csv', 'http-json')),
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  schedule_cron text,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_connector_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL
    REFERENCES knowledge_connectors(id) ON DELETE CASCADE,
  status text NOT NULL
    CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  fetched_count integer NOT NULL DEFAULT 0,
  normalized_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  unchanged_count integer NOT NULL DEFAULT 0,
  removed_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS connector_runs_connector_idx
  ON knowledge_connector_runs(connector_id, started_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_source_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL
    REFERENCES knowledge_connectors(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  content_hash text NOT NULL,
  normalized_payload jsonb NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  UNIQUE(connector_id, external_id, content_hash)
);

CREATE INDEX IF NOT EXISTS source_versions_active_idx
  ON knowledge_source_versions(connector_id, active, observed_at DESC);
