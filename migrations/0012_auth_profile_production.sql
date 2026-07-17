-- Door010 3.0 authentication, authorization and profile CRUD

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
  ON users(lower(email));

INSERT INTO roles (key, name, description)
VALUES
  ('candidate', 'Kandidaat', 'Persoonlijke Door010-gebruiker'),
  ('advisor', 'Adviseur', 'Begeleidt kandidaten'),
  ('administrator', 'Beheerder', 'Beheert content en gebruikers'),
  ('superuser', 'Superuser', 'Volledige beheertoegang')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS preferred_sector text;

CREATE TABLE IF NOT EXISTS user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notes_user_updated_idx
  ON user_notes(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS auth_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  success boolean NOT NULL,
  ip_hash text,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_audit_events_user_time_idx
  ON auth_audit_events(user_id, created_at DESC);
