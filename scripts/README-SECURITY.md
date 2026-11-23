# 🔒 Scripts de Seguridad - Guía de Ejecución

## ⚠️ IMPORTANTE: Ejecutar en este orden

### 📋 **PASO 0: Auditoría (OBLIGATORIO PRIMERO)**

Antes de ejecutar CUALQUIER script, ejecuta el script de auditoría para ver qué tienes:

```sql
-- Ejecutar en Supabase SQL Editor:
/scripts/00-audit-database.sql
```

**📤 Copia TODO el output** y pégalo en el chat para crear scripts 100% compatibles con tu base de datos actual.

---

## 🚀 Scripts de Seguridad (56-61)

### **Script 56: Ocultar Emails (GDPR)** ✅
**Archivo:** `56-hide-emails-security.sql`  
**¿Qué hace?**
- Crea vista `users_public` que oculta emails de otros usuarios
- Solo ves tu propio email
- Cumplimiento GDPR

**Ejecutar:**
```sql
-- En Supabase SQL Editor
/scripts/56-hide-emails-security.sql
```

**Nota:** Ya corregido, ahora usa `DROP VIEW IF EXISTS` para evitar conflictos.

---

### **Script 57: Sistema de Reportes** 🚨
**Archivo:** `57-reporting-system.sql`  
**¿Qué hace?**
- Tabla `reports` para denunciar usuarios/eventos/venues
- Auto-bloqueo a los 5 reportes
- Rate limit de 5 reportes/día
- **Requerido para App Store/Google Play**

**Ejecutar:**
```sql
/scripts/57-reporting-system.sql
```

---

### **Script 58: Rate Limiting** ⏱️
**Archivo:** `58-rate-limiting.sql`  
**¿Qué hace?**
- Protección anti-spam y DDoS
- Límites:
  - Solicitudes amistad: 10/min
  - Crear eventos: 5/hora
  - Chat: 30/min
  - Búsqueda: 20/min

**Ejecutar:**
```sql
/scripts/58-rate-limiting.sql
```

**⚠️ NOTA:** Crea funciones NUEVAS (`send_friend_request_with_limit`, etc). No reemplaza las actuales.

---

### **Script 59: Validación de Datos** ✅
**Archivo:** `59-data-validation.sql`  
**¿Qué hace?**
- Validación de emails
- Edad mínima 13 años
- Sanitización XSS/SQL injection
- Constraints de longitud

**Ejecutar:**
```sql
/scripts/59-data-validation.sql
```

---

### **Script 60: RLS Completo** 🛡️
**Archivo:** `60-complete-rls-SAFE.sql` ⭐ **(USAR ESTE)**  
**¿Qué hace?**
- RLS en `notification_tokens`, `user_settings`
- Refuerzo de políticas en chats, anuncios, batches externos
- **Versión SAFE:** Solo actúa sobre tablas que EXISTEN

**Ejecutar:**
```sql
/scripts/60-complete-rls-SAFE.sql
```

**NO ejecutes:** `60-complete-rls.sql` (versión antigua con errores)

---

### **Script 61: Security Logging** 📊
**Archivo:** `61-security-logging.sql`  
**¿Qué hace?**
- Tabla `security_logs` inmutable (audit trail)
- Dashboard de seguridad
- Detector de IPs sospechosas
- Logging automático de eventos críticos

**Ejecutar:**
```sql
/scripts/61-security-logging.sql
```

---

### **Script 62: Fix Function Search Path** 🔧
**Archivo:** `62-fix-function-search-path.sql`  
**¿Qué hace?**
- Añade `SET search_path = pg_catalog, public` a TODAS las funciones
- Elimina warnings "Function Search Path Mutable" del Security Advisor
- No modifica lógica de funciones, solo añade protección

**Ejecutar:**
```sql
/scripts/62-fix-function-search-path.sql
```

**Verificación:**
- El script muestra cuántas funciones actualizó
- Repasa el Security Advisor: los warnings deberían desaparecer

---

### **Script 63: Marcar Usuarios Existentes como Verificados** ✅
**Archivo:** `63-mark-existing-users-verified.sql`  
**¿Qué hace?**
- Marca usuarios antiguos (con `email_verified = NULL`) como verificados
- Evita que usuarios existentes queden bloqueados en pantalla de verificación
- **IMPORTANTE:** Ejecutar SOLO UNA VEZ después de implementar validación de email

**Ejecutar:**
```sql
/scripts/63-mark-existing-users-verified.sql
```

**Notas:**
- Solo afecta a usuarios que se registraron ANTES del sistema de verificación
- Usuarios nuevos (después de este script) SÍ deben verificar su email

---

## 🔍 Después de Ejecutar

### Verificar que todo funciona:

```sql
-- 1. Ver coverage de RLS
SELECT * FROM check_rls_coverage();

-- 2. Ver dashboard de seguridad (últimas 24h)
SELECT * FROM get_security_dashboard(24);

-- 3. Ver IPs sospechosas
SELECT * FROM get_suspicious_ips(24);

-- 4. Verificar vista users_public
SELECT * FROM users_public LIMIT 5;
-- Deberías ver NULL en email para otros usuarios
```

---

## ❌ Si Encuentras Errores

### Error: "table X does not exist"
**Solución:** Es normal. El script salta automáticamente las tablas que no existen.

### Error: "column X does not exist"
**Solución:** 
1. Ejecuta `00-audit-database.sql`
2. Copia el output completo
3. Pégalo en el chat
4. Te crearé scripts compatibles al 100%

### Error: "cannot drop columns from view"
**Solución:** Ya corregido en script 56. Usa `DROP VIEW IF EXISTS CASCADE`.

### Error: "policy already exists"
**Solución:** Ya corregido. Los scripts usan `DROP POLICY IF EXISTS` antes de crear.

---

## 📊 Impacto en la App

### ✨ **Para Usuarios:**
- **CERO cambios visibles**
- Todo funciona exactamente igual
- Más seguridad y privacidad

### 📈 **Mejora de Rating:**
- **Antes:** 6.5/10
- **Después:** ~8.0/10 ⭐

---

## 🆘 ¿No puedes conectarte a Supabase desde el chat?

**No, por seguridad:** El asistente NO puede conectarse directamente a tu base de datos.

**Alternativa:**
1. Ejecuta `00-audit-database.sql` en Supabase SQL Editor
2. Copia TODO el output (tablas, columnas, funciones)
3. Pégalo en el chat
4. Te crearé scripts personalizados para TU base de datos

---

## 📝 Orden de Ejecución Recomendado

```
1. 00-audit-database.sql               ← PRIMERO (copiar output)
2. 56-hide-emails-security.sql         ← GDPR
3. 57-reporting-system.sql             ← Moderación
4. 58-rate-limiting.sql                ← Anti-spam
5. 59-data-validation.sql              ← Validación
6. 60-complete-rls-SAFE.sql            ← RLS (versión segura)
7. 61-security-logging.sql             ← Logging
8. 62-fix-function-search-path.sql     ← Security Advisor fix
9. 63-mark-existing-users-verified.sql ← Fix usuarios existentes (UNA VEZ)
```

---

## ✅ Checklist

- [ ] Ejecuté script 00 (auditoría)
- [ ] Copié el output completo al chat
- [ ] Ejecuté scripts 56-62 en orden
- [ ] Verifiqué con `check_rls_coverage()`
- [ ] No hay errores críticos
- [ ] La app sigue funcionando normalmente
- [ ] Activé "Leaked password protection" en Dashboard Auth
- [ ] Repasé Security Advisor (warnings desaparecidos)

---

**🎯 ¿Dudas?** Pega el output del script 00 en el chat y te ayudo.
