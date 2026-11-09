"use client";

// Last resort: only used if the root layout itself fails, so it brings its own <html>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, textAlign: "center", padding: 16 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>That didn&apos;t load</h1>
          <p style={{ color: "#737373" }}>Give it another try.</p>
          <button onClick={reset} style={{ minHeight: 44, padding: "12px 24px", borderRadius: 16, border: 0, background: "#7c3aed", color: "white", fontWeight: 600 }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
