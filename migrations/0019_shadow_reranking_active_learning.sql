CREATE TABLE IF NOT EXISTS reranker_shadow_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash text NOT NULL,
  provider_key text NOT NULL,
  candidate_ids uuid[] NOT NULL,
  baseline_order uuid[] NOT NULL,
  shadow_order uuid[] NOT NULL,
  baseline_top_id uuid,
  shadow_top_id uuid,
  score_delta double precision NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL,
  status text NOT NULL
    CHECK (status IN ('completed', 'failed', 'skipped')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reranker_shadow_created_idx
  ON reranker_shadow_evaluations(created_at DESC);

CREATE INDEX IF NOT EXISTS reranker_shadow_provider_idx
  ON reranker_shadow_evaluations(provider_key, created_at DESC);

CREATE TABLE IF NOT EXISTS retrieval_label_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash text NOT NULL,
  encrypted_query text,
  candidate_ids uuid[] NOT NULL,
  candidate_titles text[] NOT NULL,
  predicted_top_id uuid,
  confidence double precision NOT NULL
    CHECK (confidence >= 0 AND confidence <= 1),
  uncertainty_reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'labeled', 'discarded')),
  claimed_by uuid,
  claimed_at timestamptz,
  labeled_by uuid,
  relevant_ids uuid[],
  irrelevant_ids uuid[],
  label_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  labeled_at timestamptz
);

CREATE INDEX IF NOT EXISTS retrieval_label_queue_status_idx
  ON retrieval_label_queue(status, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS retrieval_label_queue_open_query_idx
  ON retrieval_label_queue(query_hash)
  WHERE status IN ('pending', 'claimed');

CREATE TABLE IF NOT EXISTS retrieval_training_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id uuid NOT NULL
    REFERENCES retrieval_label_queue(id) ON DELETE CASCADE,
  query_hash text NOT NULL,
  candidate_id uuid NOT NULL,
  relevance smallint NOT NULL CHECK (relevance IN (0, 1, 2)),
  labeled_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(queue_item_id, candidate_id)
);
