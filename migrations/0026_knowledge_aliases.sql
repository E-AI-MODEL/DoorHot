-- Knowledge aliases: alternative phrasings of a knowledge item's
-- canonical question, indexed at title weight so users find the same
-- answer through different wording.

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

-- Extend the trigger-maintained search vector from 0017 with aliases
-- at title weight, keeping tags at weight B.
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
      to_tsvector(
        'dutch',
        coalesce(array_to_string(NEW.aliases, ' '), '')
      ),
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
BEFORE INSERT OR UPDATE OF title, body, category, tags, aliases
ON knowledge_items
FOR EACH ROW
EXECUTE FUNCTION update_knowledge_search_vector();

-- Include aliases in the fuzzy trigram fields from 0018.
CREATE OR REPLACE FUNCTION update_knowledge_fuzzy_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_search_text := door010_normalize_text(
    coalesce(NEW.title, '') || ' ' ||
    coalesce(array_to_string(NEW.aliases, ' '), '') || ' ' ||
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
BEFORE INSERT OR UPDATE OF title, body, category, tags, aliases
ON knowledge_items
FOR EACH ROW
EXECUTE FUNCTION update_knowledge_fuzzy_fields();

-- Refresh derived search fields for existing rows.
UPDATE knowledge_items SET title = title;
