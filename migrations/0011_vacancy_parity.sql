-- Door010 3.0 vacancy parity and profile linkage

CREATE TABLE vacancy_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  label text NOT NULL,
  base_url text,
  active boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES vacancy_sources(id),
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS retrieved_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS vacancies_source_external_unique_idx
  ON vacancies(source_id, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE saved_vacancies
  ADD COLUMN IF NOT EXISTS saved_vacancy_snapshot jsonb;

CREATE INDEX IF NOT EXISTS saved_vacancies_user_time_idx
  ON saved_vacancies(user_id, saved_at DESC);
