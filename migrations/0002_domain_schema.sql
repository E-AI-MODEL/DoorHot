-- Door010 3.0 domain schema
-- Depends on 0001_initial.sql

CREATE TYPE actor_type AS ENUM (
  'user',
  'advisor',
  'administrator',
  'system',
  'model',
  'provider'
);

CREATE TYPE confirmation_status AS ENUM (
  'pending',
  'accepted',
  'rejected',
  'expired',
  'cancelled'
);

CREATE TYPE sync_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE review_status AS ENUM (
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'archived'
);

CREATE TYPE appointment_status AS ENUM (
  'requested',
  'confirmed',
  'rescheduled',
  'completed',
  'cancelled',
  'no_show'
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by_user_id uuid REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_key text NOT NULL,
  granted boolean NOT NULL,
  policy_version text NOT NULL,
  source text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, consent_key, policy_version)
);

CREATE TABLE profile_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_key text NOT NULL,
  value jsonb,
  confidence numeric(5, 4) NOT NULL DEFAULT 1.0
    CHECK (confidence >= 0 AND confidence <= 1),
  source actor_type NOT NULL,
  source_reference text,
  confirmed_by_user boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, slot_key)
);

CREATE INDEX profile_slots_profile_idx
  ON profile_slots(profile_id);

CREATE TABLE profile_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  related_entity_type text,
  related_entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profile_timeline_profile_occurred_idx
  ON profile_timeline_events(profile_id, occurred_at DESC);

CREATE TABLE profile_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  object_key text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256 text,
  review_status review_status NOT NULL DEFAULT 'approved',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE phase_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_key text NOT NULL UNIQUE,
  ordinal integer NOT NULL UNIQUE CHECK (ordinal > 0),
  title text NOT NULL,
  description text,
  entry_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  exit_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE phase_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES phase_definitions(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  rule_type text NOT NULL,
  definition jsonb NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (phase_id, rule_key, version)
);

CREATE TABLE phase_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key text NOT NULL,
  phase_id uuid REFERENCES phase_definitions(id) ON DELETE SET NULL,
  slot_key text,
  question_text text NOT NULL,
  answer_type text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (question_key, version)
);

CREATE TABLE phase_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phase_id uuid NOT NULL REFERENCES phase_definitions(id),
  confidence numeric(5, 4) NOT NULL
    CHECK (confidence >= 0 AND confidence <= 1),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_question_key text,
  engine_version text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX phase_evaluations_profile_time_idx
  ON phase_evaluations(profile_id, evaluated_at DESC);

CREATE TABLE detector_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phase_evaluation_id uuid REFERENCES phase_evaluations(id) ON DELETE SET NULL,
  input_snapshot jsonb NOT NULL,
  output_snapshot jsonb NOT NULL,
  rules_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE phase_transition_proposals
  ADD COLUMN phase_evaluation_id uuid REFERENCES phase_evaluations(id) ON DELETE SET NULL,
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN created_by actor_type NOT NULL DEFAULT 'system';

ALTER TABLE phase_transition_proposals
  DROP COLUMN status;

ALTER TABLE phase_transition_proposals
  ADD COLUMN status confirmation_status NOT NULL DEFAULT 'pending';

CREATE TABLE phase_transition_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL UNIQUE
    REFERENCES phase_transition_proposals(id) ON DELETE CASCADE,
  status confirmation_status NOT NULL,
  resolved_by_user_id uuid REFERENCES users(id),
  reason text,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('accepted', 'rejected', 'cancelled', 'expired'))
);

CREATE TABLE route_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key text NOT NULL,
  question_text text NOT NULL,
  answer_type text NOT NULL,
  slot_key text,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (question_key, version)
);

CREATE TABLE route_answer_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_question_id uuid NOT NULL REFERENCES route_questions(id) ON DELETE CASCADE,
  option_key text NOT NULL,
  label text NOT NULL,
  value jsonb NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (route_question_id, option_key)
);

CREATE TABLE route_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_question_id uuid NOT NULL REFERENCES route_questions(id) ON DELETE CASCADE,
  depends_on_question_key text NOT NULL,
  operator text NOT NULL,
  expected_value jsonb NOT NULL
);

CREATE TABLE route_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_key text NOT NULL,
  title text NOT NULL,
  description text,
  target_role text,
  education_sector text,
  qualification_goal text,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (step_key, version)
);

CREATE TABLE route_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answers jsonb NOT NULL,
  matched_step_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation jsonb NOT NULL DEFAULT '[]'::jsonb,
  engine_version text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE route_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_evaluation_id uuid NOT NULL
    REFERENCES route_evaluations(id) ON DELETE CASCADE,
  route_key text NOT NULL,
  title text NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  step_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  programme_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_role text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE conversation_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  summary text NOT NULL,
  covered_through_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  model_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE message_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  artifact_type text NOT NULL,
  label text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE message_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  external_id text,
  source_url text,
  title text,
  excerpt text,
  retrieved_at timestamptz NOT NULL,
  valid_from timestamptz,
  valid_until timestamptz
);

CREATE TABLE message_validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  validator_key text NOT NULL,
  passed boolean NOT NULL,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  repaired_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  label text NOT NULL,
  source_type text NOT NULL,
  base_url text,
  trust_level integer NOT NULL DEFAULT 50 CHECK (trust_level BETWEEN 0 AND 100),
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES knowledge_sources(id) ON DELETE SET NULL,
  external_id text,
  item_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  source_url text,
  valid_from timestamptz,
  valid_until timestamptz,
  review_status review_status NOT NULL DEFAULT 'approved',
  version integer NOT NULL DEFAULT 1,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('dutch', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('dutch', coalesce(body, '')), 'B') ||
    setweight(to_tsvector('dutch', coalesce(category, '')), 'C')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_items_search_idx
  ON knowledge_items USING gin(search_vector);

CREATE TABLE knowledge_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id uuid NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by_user_id uuid REFERENCES users(id),
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (knowledge_item_id, version)
);

CREATE TABLE knowledge_ingest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES knowledge_sources(id) ON DELETE SET NULL,
  mode text NOT NULL,
  status sync_status NOT NULL DEFAULT 'pending',
  records_seen integer NOT NULL DEFAULT 0,
  records_imported integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE education_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_type text,
  description text,
  website_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE education_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  education_provider_id uuid REFERENCES education_providers(id) ON DELETE CASCADE,
  name text,
  address_line_1 text,
  address_line_2 text,
  postal_code text,
  city text,
  region text,
  country_code char(2) NOT NULL DEFAULT 'NL',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE education_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  education_provider_id uuid REFERENCES education_providers(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  education_level text,
  sectors text[] NOT NULL DEFAULT '{}',
  study_modes text[] NOT NULL DEFAULT '{}',
  qualification text,
  admission_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_status review_status NOT NULL DEFAULT 'approved',
  valid_from timestamptz,
  valid_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE programme_locations (
  programme_id uuid NOT NULL REFERENCES education_programmes(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES education_locations(id) ON DELETE CASCADE,
  PRIMARY KEY (programme_id, location_id)
);

CREATE TABLE external_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  provider_key text NOT NULL,
  external_id text NOT NULL,
  source_url text,
  retrieved_at timestamptz NOT NULL,
  version text,
  UNIQUE (entity_type, provider_key, external_id)
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  education_provider_id uuid REFERENCES education_providers(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  event_type text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text NOT NULL DEFAULT 'Europe/Amsterdam',
  location_id uuid REFERENCES education_locations(id) ON DELETE SET NULL,
  registration_url text,
  source_url text,
  valid_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  organization text NOT NULL,
  sector text,
  description text,
  location_text text,
  employment_type text,
  published_at timestamptz,
  expires_at timestamptz,
  source_url text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE saved_events (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  notes text,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE saved_vacancies (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vacancy_id uuid NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  notes text,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vacancy_id)
);

CREATE TABLE advisor_assignments (
  candidate_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  advisor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  PRIMARY KEY (candidate_user_id, advisor_user_id)
);

CREATE TABLE advisor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  advisor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  visibility text NOT NULL DEFAULT 'advisors',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  advisor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Amsterdam',
  status appointment_status NOT NULL DEFAULT 'requested',
  location text,
  meeting_url text,
  candidate_notes text,
  advisor_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX appointments_candidate_time_idx
  ON appointments(candidate_user_id, starts_at DESC);

CREATE TABLE prompt_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_key chatbot_key NOT NULL,
  config_key text NOT NULL,
  title text NOT NULL,
  active_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chatbot_key, config_key)
);

CREATE TABLE prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_config_id uuid NOT NULL REFERENCES prompt_configs(id) ON DELETE CASCADE,
  version integer NOT NULL,
  system_prompt text NOT NULL,
  notes text,
  status review_status NOT NULL DEFAULT 'draft',
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_config_id, version)
);

CREATE TABLE feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_configs (
  provider_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_reference text,
  updated_by_user_id uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pipeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  chatbot_key chatbot_key,
  stage text NOT NULL,
  severity text NOT NULL,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pipeline_events_conversation_time_idx
  ON pipeline_events(conversation_id, created_at DESC);

INSERT INTO roles (key, name) VALUES
  ('candidate', 'Kandidaat'),
  ('advisor', 'Adviseur'),
  ('administrator', 'Beheerder'),
  ('superuser', 'Superuser')
ON CONFLICT (key) DO NOTHING;
