-- Door010 v3.0: portable fuzzy and embedding retrieval

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS normalized_search_text text NOT NULL DEFAULT '';

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS search_trigrams text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION door010_normalize_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(
    regexp_replace(
      lower(coalesce(value, '')),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION door010_trigrams(value text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  WITH normalized AS (
    SELECT '  ' || door010_normalize_text(value) || '  ' AS text_value
  )
  SELECT coalesce(
    array_agg(DISTINCT substring(text_value FROM position FOR 3)),
    '{}'::text[]
  )
  FROM normalized,
       generate_series(
         1,
         greatest(length(text_value) - 2, 0)
       ) AS position;
$$;

CREATE OR REPLACE FUNCTION update_knowledge_fuzzy_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_search_text := door010_normalize_text(
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.body, '') || ' ' ||
    coalesce(NEW.category, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  NEW.search_trigrams := door010_trigrams(
    NEW.normalized_search_text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_items_fuzzy_fields_trigger
  ON knowledge_items;

CREATE TRIGGER knowledge_items_fuzzy_fields_trigger
BEFORE INSERT OR UPDATE OF title, body, category, tags
ON knowledge_items
FOR EACH ROW
EXECUTE FUNCTION update_knowledge_fuzzy_fields();

UPDATE knowledge_items
SET
  title = title,
  body = body,
  category = category,
  tags = tags;

CREATE INDEX IF NOT EXISTS knowledge_items_trigrams_idx
  ON knowledge_items USING gin(search_trigrams);

CREATE OR REPLACE FUNCTION door010_trigram_similarity(
  left_value text[],
  right_value text[]
)
RETURNS real
LANGUAGE sql
IMMUTABLE
AS $$
  WITH overlap AS (
    SELECT count(*)::real AS count
    FROM (
      SELECT unnest(left_value)
      INTERSECT
      SELECT unnest(right_value)
    ) AS shared
  ),
  sizes AS (
    SELECT greatest(
      cardinality(left_value),
      cardinality(right_value),
      1
    )::real AS denominator
  )
  SELECT overlap.count / sizes.denominator
  FROM overlap, sizes;
$$;

CREATE OR REPLACE FUNCTION search_knowledge_fuzzy(
  search_query text,
  max_results integer DEFAULT 20,
  minimum_similarity real DEFAULT 0.08,
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
  similarity real
)
LANGUAGE sql
STABLE
AS $$
  WITH query_data AS (
    SELECT door010_trigrams(search_query) AS trigrams
  )
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
    door010_trigram_similarity(
      item.search_trigrams,
      query_data.trigrams
    ) AS similarity
  FROM knowledge_items AS item
  CROSS JOIN query_data
  WHERE
    item.review_status = 'approved'
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
    AND door010_trigram_similarity(
      item.search_trigrams,
      query_data.trigrams
    ) >= minimum_similarity
  ORDER BY similarity DESC, item.updated_at DESC
  LIMIT least(greatest(max_results, 1), 100);
$$;

CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  knowledge_item_id uuid PRIMARY KEY
    REFERENCES knowledge_items(id) ON DELETE CASCADE,
  model_key text NOT NULL,
  dimensions integer NOT NULL CHECK (dimensions > 0),
  embedding double precision[] NOT NULL,
  content_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(embedding) = dimensions)
);

CREATE INDEX IF NOT EXISTS knowledge_embeddings_model_idx
  ON knowledge_embeddings(model_key, updated_at DESC);

CREATE OR REPLACE FUNCTION door010_cosine_similarity(
  left_vector double precision[],
  right_vector double precision[]
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  dot_product double precision := 0;
  left_norm double precision := 0;
  right_norm double precision := 0;
  index_value integer;
BEGIN
  IF cardinality(left_vector) <> cardinality(right_vector) THEN
    RETURN 0;
  END IF;

  FOR index_value IN 1..cardinality(left_vector) LOOP
    dot_product := dot_product +
      left_vector[index_value] * right_vector[index_value];
    left_norm := left_norm +
      left_vector[index_value] * left_vector[index_value];
    right_norm := right_norm +
      right_vector[index_value] * right_vector[index_value];
  END LOOP;

  IF left_norm = 0 OR right_norm = 0 THEN
    RETURN 0;
  END IF;

  RETURN dot_product / sqrt(left_norm * right_norm);
END;
$$;

CREATE OR REPLACE FUNCTION search_knowledge_embeddings(
  query_embedding double precision[],
  embedding_model_key text,
  max_results integer DEFAULT 20,
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
  similarity double precision
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
    door010_cosine_similarity(
      stored.embedding,
      query_embedding
    ) AS similarity
  FROM knowledge_embeddings AS stored
  JOIN knowledge_items AS item
    ON item.id = stored.knowledge_item_id
  WHERE
    stored.model_key = embedding_model_key
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
  ORDER BY similarity DESC, item.updated_at DESC
  LIMIT least(greatest(max_results, 1), 100);
$$;
