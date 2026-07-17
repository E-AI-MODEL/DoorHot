CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE chatbot_key AS ENUM (
  'general-coach',
  'personal-journey-coach'
);

CREATE TYPE conversation_type AS ENUM (
  'general-ai',
  'personal-ai',
  'advisor'
);

CREATE TYPE message_role AS ENUM (
  'user',
  'assistant_general',
  'assistant_personal',
  'advisor',
  'system'
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_phase_key text,
  known_slots jsonb NOT NULL DEFAULT '{}'::jsonb,
  test_completed boolean NOT NULL DEFAULT false,
  test_results jsonb,
  avatar_object_key text,
  cv_object_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  chatbot_key chatbot_key,
  conversation_type conversation_type NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (conversation_type = 'advisor' AND chatbot_key IS NULL)
    OR
    (conversation_type <> 'advisor' AND chatbot_key IS NOT NULL)
  )
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role message_role NOT NULL,
  content text NOT NULL,
  artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_metadata jsonb,
  validation_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_created_idx
  ON messages(conversation_id, created_at);

CREATE TABLE profile_slot_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  source text NOT NULL,
  confidence numeric(5, 4),
  changed_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE phase_transition_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_phase_key text,
  to_phase_key text NOT NULL,
  reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  proposed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  mode text NOT NULL,
  status text NOT NULL,
  cursor_before text,
  cursor_after text,
  records_seen integer NOT NULL DEFAULT 0,
  records_imported integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  report jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE external_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  external_id text NOT NULL,
  entity_type text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_payload jsonb,
  retrieved_at timestamptz NOT NULL,
  valid_from timestamptz,
  valid_until timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_key, external_id, entity_type)
);
