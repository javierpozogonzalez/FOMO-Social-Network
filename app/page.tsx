export default function Page() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#FFFFFF",
        color: "#111827",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: "600px", textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "1rem", color: "#7C3AED" }}>SalGo</h1>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "2rem", color: "#6B7280" }}>Aplicación Móvil React Native</h2>

        <div
          style={{
            backgroundColor: "#FFFFFF",
            padding: "2rem",
            borderRadius: "12px",
            marginBottom: "2rem",
            textAlign: "left",
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <p style={{ marginBottom: "1rem", lineHeight: "1.6" }}>
            Este es un proyecto <strong>React Native con Expo</strong> para dispositivos móviles Android e iOS.
          </p>
          <p style={{ marginBottom: "1rem", lineHeight: "1.6", color: "#6B7280" }}>
            No se puede previsualizar en el navegador porque está diseñado para ejecutarse en dispositivos móviles.
          </p>
        </div>

        <div
          style={{
            backgroundColor: "#7C3AED",
            padding: "1.5rem",
            borderRadius: "12px",
            marginBottom: "2rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#FFFFFF" }}>📦 Para usar esta aplicación:</h3>
          <ol
            style={{
              textAlign: "left",
              lineHeight: "1.8",
              color: "#FFFFFF",
              paddingLeft: "1.5rem",
            }}
          >
            <li>
              Haz clic en los <strong>tres puntos (⋮)</strong> arriba a la derecha
            </li>
            <li>
              Selecciona <strong>"Download ZIP"</strong>
            </li>
            <li>Descomprime el archivo en tu computadora</li>
            <li>Abre el proyecto en Visual Studio Code</li>
            <li>
              Sigue las instrucciones del <strong>README.md</strong>
            </li>
          </ol>
        </div>

        <div
          style={{
            backgroundColor: "#FFFFFF",
            padding: "1.5rem",
            borderRadius: "12px",
            fontSize: "0.9rem",
            color: "#6B7280",
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <p style={{ marginBottom: "0.5rem" }}>✅ Autenticación con Supabase</p>
          <p style={{ marginBottom: "0.5rem" }}>✅ Feed de eventos y evento destacado</p>
          <p style={{ marginBottom: "0.5rem" }}>✅ Sistema de amigos</p>
          <p style={{ marginBottom: "0.5rem" }}>✅ Chat por evento en tiempo real</p>
          <p style={{ marginBottom: "0.5rem" }}>✅ Modo visible/anónimo</p>
          <p>✅ Base de datos completa con RLS</p>
        </div>
      </div>
    </div>
  )
}
