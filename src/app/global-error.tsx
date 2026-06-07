"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error);
    })
  }, [error]);

  const retry = unstable_retry ?? reset

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#f8fafc",
            padding: "24px",
          }}
        >
          <section
            style={{
              maxWidth: "560px",
              border: "1px solid #fecaca",
              borderRadius: "12px",
              background: "#fff",
              padding: "24px",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "20px", color: "#0f172a" }}>
              Sadhana Hostel could not finish loading
            </h1>
            <p style={{ color: "#475569", lineHeight: 1.6 }}>
              The error has been captured for review. Retry once; if it continues, sign in again
              or contact hostel support with the request time.
            </p>
            {error.digest ? (
              <p style={{ color: "#64748b", fontSize: "12px" }}>
                Error digest: {error.digest}
              </p>
            ) : null}
            {retry ? (
              <button
                type="button"
                onClick={() => retry()}
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: "8px",
                  background: "#0f172a",
                  color: "#fff",
                  cursor: "pointer",
                  padding: "10px 14px",
                }}
              >
                Retry
              </button>
            ) : null}
          </section>
        </main>
      </body>
    </html>
  );
}
