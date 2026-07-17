-- Door010 3.0 parity restoration: conversations, advisor chat and snapshots

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS conversation_type text NOT NULL DEFAULT 'general-ai'
    CHECK (conversation_type IN ('general-ai', 'personal-ai', 'advisor'));


ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id);

UPDATE conversations
SET user_id = owner_user_id
WHERE user_id IS NULL;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS chatbot_key text
    CHECK (
      chatbot_key IS NULL OR
      chatbot_key IN ('general-coach', 'personal-journey-coach')
    ),
  ADD COLUMN IF NOT EXISTS advisor_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE detector_snapshots
  ADD COLUMN IF NOT EXISTS conversation_id uuid
    REFERENCES conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_conversation_time_idx
  ON messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS conversations_user_updated_idx
  ON conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS detector_snapshots_profile_time_idx
  ON detector_snapshots(profile_id, created_at DESC);
