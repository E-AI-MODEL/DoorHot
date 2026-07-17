CREATE TABLE IF NOT EXISTS memory_graph_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  node_type text NOT NULL,
  external_id text NOT NULL,
  label text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, node_type, external_id)
);

CREATE TABLE IF NOT EXISTS memory_graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_node_id uuid NOT NULL
    REFERENCES memory_graph_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL
    REFERENCES memory_graph_nodes(id) ON DELETE CASCADE,
  edge_type text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, from_node_id, to_node_id, edge_type)
);

CREATE INDEX IF NOT EXISTS graph_nodes_user_type_idx
  ON memory_graph_nodes(user_id, node_type, active);
CREATE INDEX IF NOT EXISTS graph_edges_user_from_idx
  ON memory_graph_edges(user_id, from_node_id, active);
CREATE INDEX IF NOT EXISTS graph_edges_user_to_idx
  ON memory_graph_edges(user_id, to_node_id, active);

CREATE TABLE IF NOT EXISTS execution_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  orchestration_run_id uuid
    REFERENCES orchestration_runs(id) ON DELETE SET NULL,
  tool_key text NOT NULL,
  status text NOT NULL CHECK (
    status IN (
      'pending_confirmation',
      'approved',
      'rejected',
      'executed',
      'failed',
      'expired'
    )
  ),
  payload jsonb NOT NULL,
  confirmation_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  approved_at timestamptz,
  executed_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS execution_requests_user_status_idx
  ON execution_requests(user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_request_id uuid NOT NULL UNIQUE
    REFERENCES execution_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (
    channel IN ('in_app', 'email', 'webhook')
  ),
  recipient text,
  subject text,
  body text NOT NULL,
  deliver_at timestamptz NOT NULL,
  status text NOT NULL CHECK (
    status IN ('queued', 'delivered', 'failed', 'cancelled')
  ),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

CREATE INDEX IF NOT EXISTS notification_outbox_delivery_idx
  ON notification_outbox(status, deliver_at);
