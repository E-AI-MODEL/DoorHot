-- Door010 3.0 trusted sources, FAQ ingestion and hybrid retrieval

CREATE TABLE IF NOT EXISTS trusted_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  label text NOT NULL,
  base_url text,
  authority numeric(4, 3) NOT NULL DEFAULT 0.5
    CHECK (authority >= 0 AND authority <= 1),
  active boolean NOT NULL DEFAULT true,
  allowed_domains text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS source_key text
    REFERENCES trusted_sources(source_key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS time_sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_citation boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS knowledge_items_source_key_idx
  ON knowledge_items(source_key);

CREATE INDEX IF NOT EXISTS knowledge_items_review_category_idx
  ON knowledge_items(review_status, category, updated_at DESC);

CREATE INDEX IF NOT EXISTS trusted_sources_active_authority_idx
  ON trusted_sources(active, authority DESC);

ALTER TABLE knowledge_ingest_runs
  ADD COLUMN IF NOT EXISTS source_key text,
  ADD COLUMN IF NOT EXISTS checksum_sha256 text;
