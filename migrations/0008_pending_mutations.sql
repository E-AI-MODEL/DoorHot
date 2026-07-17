-- Door010 3.0 pending mutation confirmation

CREATE TABLE pending_mutations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  mutation_type text NOT NULL
    CHECK (mutation_type IN ('profile-slot', 'phase-transition')),
  payload jsonb NOT NULL,
  requires_confirmation boolean NOT NULL DEFAULT true,
  status confirmation_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid REFERENCES users(id),
  reason text
);

CREATE INDEX pending_mutations_user_status_idx
  ON pending_mutations(user_id, status, created_at DESC);

CREATE INDEX pending_mutations_conversation_status_idx
  ON pending_mutations(conversation_id, status, created_at DESC);
