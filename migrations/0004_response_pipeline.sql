-- Door010 3.0 structured response pipeline and detector output

ALTER TABLE messages
  ADD COLUMN direct_answer text,
  ADD COLUMN supporting_detail text,
  ADD COLUMN response_mode text,
  ADD COLUMN answer_type text,
  ADD COLUMN verification_required boolean NOT NULL DEFAULT false,
  ADD COLUMN reflection_issues jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE intake_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  summary_template text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE intake_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_batch_id uuid NOT NULL REFERENCES intake_batches(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  slot_key text,
  question_text text NOT NULL,
  question_type text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  sort integer NOT NULL DEFAULT 0
);

ALTER TABLE phase_evaluations
  ADD COLUMN audience text,
  ADD COLUMN next_slot_key text,
  ADD COLUMN next_question_id text,
  ADD COLUMN next_question text,
  ADD COLUMN next_phase_target text,
  ADD COLUMN fallback_used boolean NOT NULL DEFAULT false,
  ADD COLUMN debug jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX messages_response_mode_idx
  ON messages(response_mode);

CREATE INDEX phase_evaluations_next_question_idx
  ON phase_evaluations(next_question_id);
