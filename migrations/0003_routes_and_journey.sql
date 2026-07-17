-- Door010 3.0 route mapping and extended journey phases

CREATE TABLE journey_phase_definitions (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  color text NOT NULL,
  sort integer NOT NULL UNIQUE,
  status text NOT NULL,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE journey_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE
    REFERENCES profiles(id) ON DELETE CASCADE,
  current_phase_code text NOT NULL DEFAULT 'interesse',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE route_steps
  ADD COLUMN source_step_id uuid,
  ADD COLUMN slug text,
  ADD COLUMN unique_name text,
  ADD COLUMN short_title text,
  ADD COLUMN long_title text,
  ADD COLUMN duration_in_months integer,
  ADD COLUMN body jsonb,
  ADD COLUMN faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN articles jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE education_routes (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE education_route_required_answers (
  route_id uuid NOT NULL REFERENCES education_routes(id) ON DELETE CASCADE,
  route_answer_id uuid NOT NULL,
  source_relation_id bigint,
  PRIMARY KEY (route_id, route_answer_id)
);

CREATE INDEX education_route_required_answers_answer_idx
  ON education_route_required_answers(route_answer_id);

CREATE TABLE education_route_steps (
  route_id uuid NOT NULL REFERENCES education_routes(id) ON DELETE CASCADE,
  route_step_id uuid NOT NULL,
  sort integer NOT NULL,
  source_relation_id bigint,
  PRIMARY KEY (route_id, route_step_id)
);

CREATE INDEX education_route_steps_route_sort_idx
  ON education_route_steps(route_id, sort);
