CREATE TABLE IF NOT EXISTS journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  phase_key text NOT NULL,
  route_key text,
  status text NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
  progress numeric(5,4) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journey_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  target_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journey_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES journey_goals(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'skipped')),
  weight numeric(6,3) NOT NULL DEFAULT 1 CHECK (weight > 0),
  sort_order integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journey_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  blocker_key text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL CHECK (status IN ('open', 'mitigating', 'resolved', 'dismissed')),
  evidence_ids uuid[] NOT NULL DEFAULT '{}',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journey_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES journey_goals(id) ON DELETE SET NULL,
  blocker_id uuid REFERENCES journey_blockers(id) ON DELETE SET NULL,
  action_key text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL CHECK (status IN ('pending', 'doing', 'done', 'cancelled', 'expired')),
  priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journey_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  evidence_type text NOT NULL CHECK (evidence_type IN ('chat', 'profile', 'talent_test', 'route', 'document', 'advisor', 'rule')),
  source_id text,
  claim_key text NOT NULL,
  value jsonb NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journey_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  decision_key text NOT NULL,
  outcome text NOT NULL,
  reason text NOT NULL,
  evidence_ids uuid[] NOT NULL DEFAULT '{}',
  rule_version text NOT NULL,
  reversible boolean NOT NULL DEFAULT true,
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journey_goals_journey_idx
  ON journey_goals(journey_id, status, priority DESC);
CREATE INDEX IF NOT EXISTS journey_actions_journey_idx
  ON journey_actions(journey_id, status, priority DESC);
CREATE INDEX IF NOT EXISTS journey_blockers_journey_idx
  ON journey_blockers(journey_id, status, severity);
CREATE INDEX IF NOT EXISTS journey_evidence_journey_idx
  ON journey_evidence(journey_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS journey_decisions_journey_idx
  ON journey_decisions(journey_id, decided_at DESC);
