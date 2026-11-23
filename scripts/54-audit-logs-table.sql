-- 54-audit-logs-table.sql
-- Auditoría de acciones sensibles

BEGIN;

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,  -- 'approve_venue', 'delete_event', etc
  table_name text,
  record_id uuid,
  metadata jsonb,
  ip_address inet,
  created_at timestamptz DEFAULT now()
);

-- Ejemplo de uso:
-- INSERT INTO audit_logs (user_id, action, table_name, record_id, metadata, ip_address)
-- VALUES ('<user_id>', 'delete_event', 'events', '<event_id>', '{"reason": "spam"}', '192.168.1.1');

COMMIT;
