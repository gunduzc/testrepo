"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f9fafb",
            padding: "1rem",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontSize: "4rem",
                fontWeight: "bold",
                color: "#d1d5db",
                margin: 0,
              }}
            >
              500
            </h1>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: "600",
                color: "#111827",
                marginTop: "1rem",
              }}
            >
              Something went wrong
            </h2>
            <p style={{ color: "#6b7280", marginTop: "0.5rem" }}>
              A critical error occurred. Please refresh the page.
            </p>
            {error.digest && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                  marginTop: "0.5rem",
                }}
              >
                Error ID: {error.digest}
              </p>
            )}
            <div style={{ marginTop: "1.5rem" }}>
              <button
                onClick={reset}
                style={{
                  backgroundColor: "#3b82f6",
                  color: "white",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                  marginRight: "0.5rem",
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                style={{
                  backgroundColor: "#e5e7eb",
                  color: "#374151",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
