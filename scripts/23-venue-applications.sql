-- Tabla para solicitudes de cuentas profesionales (locales)
CREATE TABLE IF NOT EXISTS venue_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_name TEXT NOT NULL,
  business_address TEXT NOT NULL,
  city TEXT NOT NULL,
  cif_number TEXT,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  description TEXT,
  instagram_handle TEXT,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_venue_applications_user_id ON venue_applications(user_id);
CREATE INDEX idx_venue_applications_status ON venue_applications(status);
CREATE INDEX idx_venue_applications_created_at ON venue_applications(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE venue_applications ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver solo sus propias solicitudes
CREATE POLICY "Users can view their own applications"
  ON venue_applications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios pueden crear solicitudes
CREATE POLICY "Users can create applications"
  ON venue_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Solo admins pueden actualizar solicitudes (aprobar/rechazar)
-- Nota: necesitarás una tabla de admins o un campo is_admin en users
-- Por ahora, comentado:
-- CREATE POLICY "Admins can update applications"
--   ON venue_applications
--   FOR UPDATE
--   USING (
--     EXISTS (
--       SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
--     )
--   );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_venue_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER venue_applications_updated_at
  BEFORE UPDATE ON venue_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_venue_applications_updated_at();

-- Comentarios
COMMENT ON TABLE venue_applications IS 'Solicitudes de cuentas profesionales para locales/venues';
COMMENT ON COLUMN venue_applications.status IS 'Estado: pending (pendiente), approved (aprobada), rejected (rechazada)';
COMMENT ON COLUMN venue_applications.cif_number IS 'CIF/NIF del negocio (opcional, para verificación)';
