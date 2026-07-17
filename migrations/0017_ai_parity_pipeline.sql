-- Door010 AI parity: Dutch weighted FTS and pipeline observability

ALTER TABLE knowledge_items
  DROP COLUMN IF EXISTS search_vector;

ALTER TABLE knowledge_items
  ADD COLUMN search_vector tsvector;

CREATE OR REPLACE FUNCTION update_knowledge_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(
      to_tsvector('dutch', coalesce(NEW.title, '')),
      'A'
    ) ||
    setweight(
      to_tsvector('dutch', coalesce(NEW.body, '')),
      'B'
    ) ||
    setweight(
      to_tsvector('dutch', coalesce(NEW.category, '')),
      'C'
    ) ||
    setweight(
      to_tsvector(
        'dutch',
        coalesce(array_to_string(NEW.tags, ' '), '')
      ),
      'B'
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_items_search_vector_trigger
  ON knowledge_items;

CREATE TRIGGER knowledge_items_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, body, category, tags
ON knowledge_items
FOR EACH ROW
EXECUTE FUNCTION update_knowledge_search_vector();

UPDATE knowledge_items
SET
  title = title,
  body = body,
  category = category,
  tags = tags;

CREATE INDEX IF NOT EXISTS knowledge_items_search_idx
  ON knowledge_items USING gin(search_vector);

CREATE OR REPLACE FUNCTION search_knowledge_fts(
  search_query text,
  max_results integer DEFAULT 10,
  category_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  category text,
  tags text[],
  source_key text,
  source_url text,
  valid_from timestamptz,
  valid_until timestamptz,
  updated_at timestamptz,
  rank real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    item.id,
    item.title,
    item.body,
    item.category,
    item.tags,
    item.source_key,
    item.source_url,
    item.valid_from,
    item.valid_until,
    item.updated_at,
    ts_rank(
      item.search_vector,
      plainto_tsquery('dutch', search_query)
    ) AS rank
  FROM knowledge_items AS item
  WHERE
    item.search_vector @@ plainto_tsquery('dutch', search_query)
    AND item.review_status = 'approved'
    AND (
      category_filter IS NULL OR
      item.category = category_filter
    )
    AND (
      item.valid_from IS NULL OR
      item.valid_from <= now()
    )
    AND (
      item.valid_until IS NULL OR
      item.valid_until > now()
    )
  ORDER BY rank DESC, item.updated_at DESC
  LIMIT LEAST(GREATEST(max_results, 1), 100);
$$;

CREATE TABLE IF NOT EXISTS ai_pipeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_key text NOT NULL,
  stage text NOT NULL,
  level text NOT NULL
    CHECK (level IN ('info', 'warning', 'error')),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_pipeline_events_created_idx
  ON ai_pipeline_events(created_at DESC);

CREATE INDEX IF NOT EXISTS ai_pipeline_events_stage_idx
  ON ai_pipeline_events(pipeline_key, stage, created_at DESC);
