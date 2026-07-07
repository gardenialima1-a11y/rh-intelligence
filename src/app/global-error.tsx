"use client";

import * as React from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("Erro global da plataforma:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            background: "#10192E",
            color: "#F6F1E7",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>A plataforma encontrou um erro inesperado</h1>
            <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 20 }}>
              Tente recarregar a página. Se o problema persistir, contate o administrador.
            </p>
            <button
              onClick={() => reset()}
              style={{
                background: "#B8935A",
                color: "#10192E",
                fontWeight: 600,
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
              }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
