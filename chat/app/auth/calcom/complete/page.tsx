"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function CompletePage() {
  const searchParams = useSearchParams();
  const success = !!searchParams.get("calcom_linked");
  const message = searchParams.get("calcom_linked") ?? searchParams.get("error") ?? "";
  const teamId = searchParams.get("team") ?? "";
  const platform = searchParams.get("platform") ?? "";
  const [showFallback, setShowFallback] = useState(false);

  const isSlack = platform === "slack";
  const isTelegram = platform === "telegram";
  const telegramBot = searchParams.get("telegram_bot");
  const slackWebUrl = `https://app.slack.com/client/${teamId}`;
  const tmeFallback = telegramBot ? `https://t.me/${telegramBot}?start=link_success` : "";

  useEffect(() => {
    if (!success || !isSlack || !teamId) return;

    window.location.href = `slack://open?team=${teamId}`;

    const timer = setTimeout(() => {
      setShowFallback(true);
      window.location.href = slackWebUrl;
    }, 2000);
    return () => clearTimeout(timer);
  }, [success, isSlack, teamId, slackWebUrl]);

  useEffect(() => {
    if (!success || !isTelegram || !telegramBot) return;

    window.location.href = `tg://resolve?domain=${telegramBot}&start=link_success`;

    const timer = setTimeout(() => setShowFallback(true), 2000);
    return () => clearTimeout(timer);
  }, [success, isTelegram, telegramBot]);

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div
          style={{
            ...styles.icon,
            ...(success ? {} : { background: "rgba(224, 30, 90, 0.15)", color: "#e01e5a" }),
          }}
        >
          {success ? "✓" : "✕"}
        </div>
        <h1 style={styles.title}>{success ? "Account Connected" : "Connection Failed"}</h1>
        <p style={styles.message}>{message}</p>
        {success && isSlack && (
          <>
            <p style={styles.hint}>Redirecting you back to Slack...</p>
            {showFallback && (
              <a href={slackWebUrl} style={styles.button}>
                Open Slack
              </a>
            )}
          </>
        )}
        {success && isTelegram && telegramBot && (
          <>
            <p style={styles.hint}>Redirecting you back to Telegram...</p>
            {showFallback && (
              <a href={tmeFallback} style={styles.button}>
                Open Telegram
              </a>
            )}
          </>
        )}
        {success && !isSlack && !(isTelegram && telegramBot) && (
          <p style={styles.hint}>
            You can close this tab and return to{" "}
            {platform.charAt(0).toUpperCase() + platform.slice(1)}.
          </p>
        )}
        {!success && isSlack && (
          <p style={styles.hint}>
            Go back to Slack and run <code style={styles.code}>/cal link</code> to try again.
          </p>
        )}
        {!success && isTelegram && (
          <p style={styles.hint}>
            Go back to Telegram and send <code style={styles.code}>/link</code> to try again.
          </p>
        )}
        {!success && !isSlack && !isTelegram && (
          <p style={styles.hint}>
            {platform
              ? `Go back to ${platform.charAt(0).toUpperCase() + platform.slice(1)} and use the link command to try again.`
              : "Return to your chat app and use the link command to try again."}
          </p>
        )}
      </div>
    </main>
  );
}

export default function CalcomOAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <main style={styles.main}>
          <div style={styles.card}>
            <p style={styles.message}>Loading...</p>
          </div>
        </main>
      }
    >
      <CompletePage />
    </Suspense>
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
    marginBottom: "1rem",
  },
  code: {
    fontFamily: "monospace",
    background: "rgba(255,255,255,0.08)",
    padding: "0.1rem 0.4rem",
    borderRadius: "0.25rem",
    fontSize: "0.85em",
  },
  button: {
    display: "inline-block",
    background: "#fff",
    color: "#000",
    fontWeight: 600,
    fontSize: "0.95rem",
    padding: "0.65rem 1.5rem",
    borderRadius: "0.5rem",
    textDecoration: "none",
    marginTop: "0.5rem",
    transition: "opacity 0.15s",
  },
};
