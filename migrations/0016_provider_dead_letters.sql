-- Door010 provider resilience dead-letter queue

CREATE TABLE IF NOT EXISTS provider_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  operation text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS provider_dead_letters_open_idx
  ON provider_dead_letters(provider_key, created_at DESC)
  WHERE resolved_at IS NULL;
