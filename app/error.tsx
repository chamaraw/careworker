"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "50vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "28rem",
          padding: "1rem",
          border: "1px solid #fecaca",
          borderRadius: "0.5rem",
          background: "#fef2f2",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#991b1b" }}>
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
          border: "1px solid #e5e7eb",
          borderRadius: "0.5rem",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
