ALTER TABLE knowledge_connectors
  ADD COLUMN IF NOT EXISTS snapshot_mode boolean NOT NULL DEFAULT false;

ALTER TABLE knowledge_source_versions
  ADD COLUMN IF NOT EXISTS run_id uuid;

ALTER TABLE knowledge_source_versions
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS source_versions_active_external_idx
  ON knowledge_source_versions(
    connector_id,
    external_id,
    active,
    observed_at DESC
  );

CREATE TABLE IF NOT EXISTS knowledge_connector_leases (
  connector_id uuid PRIMARY KEY
    REFERENCES knowledge_connectors(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  acquired_at timestamptz NOT NULL,
  heartbeat_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS connector_leases_expiry_idx
  ON knowledge_connector_leases(expires_at);
