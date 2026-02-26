interface PageProps {
  searchParams: Promise<{ calcom_linked?: string; error?: string }>;
}

export default async function CalcomOAuthCompletePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const success = !!params.calcom_linked;
  const message = params.calcom_linked ?? params.error ?? "";

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.icon}>{success ? "✓" : "✕"}</div>
        <h1 style={styles.title}>
          {success ? "Account Connected" : "Connection Failed"}
        </h1>
        <p style={styles.message}>{message}</p>
        {success && (
          <p style={styles.hint}>
            Head back to Slack and try <code style={styles.code}>@Cal</code> or{" "}
            <code style={styles.code}>/cal</code> to get started.
          </p>
        )}
        {!success && (
          <p style={styles.hint}>
            Go back to Slack and run <code style={styles.code}>/cal link</code> to try again.
          </p>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)",
    color: "#ededed",
  },
  card: {
    maxWidth: 480,
    width: "100%",
    textAlign: "center",
    padding: "3rem 2rem",
    background: "#111",
    borderRadius: "1rem",
    border: "1px solid #222",
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.5rem",
    fontWeight: 700,
    marginBottom: "1.5rem",
    background: "rgba(46, 182, 125, 0.15)",
    color: "#2eb67d",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    marginBottom: "0.75rem",
  },
  message: {
    fontSize: "1rem",
    color: "#999",
    lineHeight: 1.6,
    marginBottom: "1rem",
  },
  hint: {
    fontSize: "0.875rem",
    color: "#666",
    lineHeight: 1.5,
  },
  code: {
    fontFamily: "monospace",
    background: "rgba(255,255,255,0.08)",
    padding: "0.1rem 0.4rem",
    borderRadius: "0.25rem",
    fontSize: "0.85em",
  },
};
