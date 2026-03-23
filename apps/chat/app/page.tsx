// The install route generates a per-request state token (CSRF protection),
// stamps it in an HttpOnly cookie, then redirects to Slack OAuth.
const SLACK_INSTALL_URL = "/api/auth/slack/install";

interface PageProps {
  searchParams: Promise<{ installed?: string; error?: string; team?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME;
  const telegramUrl = telegramBotUsername ? `https://t.me/${telegramBotUsername}` : null;

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              aria-label="Cal.com logo"
              role="img"
            >
              <rect width="32" height="32" rx="8" fill="#101010" />
              <path d="M8 16a8 8 0 1 1 16 0 8 8 0 0 1-16 0Z" fill="white" />
              <path d="M16 8v8l5.66 5.66" stroke="#101010" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span style={styles.logoText}>Cal.com</span>
        </div>

        {/* Hero */}
        <div style={styles.hero}>
          <h1 style={styles.h1}>
            Your scheduling workflow,
            <br />
            everywhere you work
          </h1>
          <p style={styles.subtitle}>
            Get booking notifications, check availability, and book meetings with teammates —
            directly in Slack or Telegram.
          </p>
        </div>

        {/* Status banners */}
        {params.installed && (
          <div style={{ ...styles.banner, ...styles.bannerSuccess }}>
            Cal.com was successfully installed to your Slack workspace! Run{" "}
            <code style={styles.code}>/cal link</code> to connect your Cal.com account.
          </div>
        )}
        {params.error && (
          <div style={{ ...styles.banner, ...styles.bannerError }}>
            Installation failed: {decodeURIComponent(params.error)}
          </div>
        )}

        {/* CTAs */}
        <div style={styles.cta}>
          <div style={styles.ctaButtons}>
            <a href={SLACK_INSTALL_URL} style={styles.installButton}>
              <SlackIcon />
              Add to Slack
            </a>
            {telegramUrl && (
              <a href={telegramUrl} target="_blank" rel="noopener noreferrer" style={styles.telegramButton}>
                <TelegramIcon color="#fff" />
                Open in Telegram
              </a>
            )}
          </div>
          <p style={styles.ctaNote}>Free to use · Requires a Cal.com account</p>
        </div>

        {/* Features */}
        <div style={styles.features}>
          {features.map((f) => (
            <div key={f.title} style={styles.feature}>
              <div style={styles.featureIcon}>{f.icon}</div>
              <div>
                <h3 style={styles.featureTitle}>{f.title}</h3>
                <p style={styles.featureDesc}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Commands */}
        <div style={styles.commands}>
          <h2 style={styles.h2}>Available commands</h2>
          <div style={styles.commandColumns}>
            <div style={styles.commandColumn}>
              <p style={styles.platformLabel}>
                <SlackIcon />
                Slack
              </p>
              <div style={styles.commandList}>
                {slackCommands.map((c) => (
                  <div key={c.cmd} style={styles.command}>
                    <code style={styles.cmdCode}>{c.cmd}</code>
                    <span style={styles.cmdDesc}>{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.commandColumn}>
              <p style={styles.platformLabel}>
                <TelegramIcon />
                Telegram
              </p>
              <div style={styles.commandList}>
                {telegramCommands.map((c) => (
                  <div key={c.cmd} style={styles.command}>
                    <code style={styles.cmdCode}>{c.cmd}</code>
                    <span style={styles.cmdDesc}>{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={styles.footer}>
          <a
            href="https://cal.com"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.footerLink}
          >
            Cal.com
          </a>
          <span style={styles.footerSep}>·</span>
          <a
            href="https://cal.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.footerLink}
          >
            Docs
          </a>
          <span style={styles.footerSep}>·</span>
          <a
            href="https://github.com/calcom/companion"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.footerLink}
          >
            GitHub
          </a>
        </footer>
      </div>
    </main>
  );
}

function SlackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 54 54" fill="none" aria-label="Slack" role="img">
      <path d="M19.7 33.5a4.7 4.7 0 1 1-9.4 0V19.7a4.7 4.7 0 0 1 9.4 0v13.8Z" fill="#36C5F0" />
      <path d="M33.5 19.7a4.7 4.7 0 1 1 0-9.4h13.8a4.7 4.7 0 0 1 0 9.4H33.5Z" fill="#2EB67D" />
      <path d="M34.3 33.5a4.7 4.7 0 1 1 9.4 0V47.3a4.7 4.7 0 0 1-9.4 0V33.5Z" fill="#ECB22E" />
      <path d="M20.5 34.3a4.7 4.7 0 1 1 0 9.4H6.7a4.7 4.7 0 0 1 0-9.4h13.8Z" fill="#E01E5A" />
    </svg>
  );
}

function TelegramIcon({ color = "#229ED9" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="Telegram" role="img">
      <path
        d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.857l-2.95-.924c-.64-.203-.658-.64.135-.954l11.57-4.461c.537-.194 1.006.131.97.703Z"
        fill={color}
      />
    </svg>
  );
}

const features = [
  {
    icon: "🔔",
    title: "Instant Notifications",
    desc: "Get notified in Slack when someone books, reschedules, or cancels a meeting with you.",
  },
  {
    icon: "📅",
    title: "Check Availability",
    desc: "Use /cal availability @teammate to see when they're free — right in your conversation.",
  },
  {
    icon: "✅",
    title: "Book Meetings",
    desc: "Run /cal book @teammate to select a time and confirm a booking without leaving Slack.",
  },
  {
    icon: "🗓️",
    title: "View Your Schedule",
    desc: "See all upcoming bookings with /cal bookings or in the App Home tab.",
  },
];

const slackCommands = [
  { cmd: "/cal link", desc: "Connect your Cal.com account" },
  { cmd: "/cal availability [@user]", desc: "Check availability" },
  { cmd: "/cal book @user", desc: "Book a meeting" },
  { cmd: "/cal bookings", desc: "View upcoming bookings" },
  { cmd: "/cal unlink", desc: "Disconnect your Cal.com account" },
  { cmd: "/cal help", desc: "Show all commands" },
];

const telegramCommands = [
  { cmd: "/link", desc: "Connect your Cal.com account" },
  { cmd: "/availability", desc: "Check your availability" },
  { cmd: "/bookings", desc: "View upcoming bookings" },
  { cmd: "/unlink", desc: "Disconnect your Cal.com account" },
  { cmd: "/help", desc: "Show all commands" },
  { cmd: "@mention", desc: "Ask anything in natural language" },
];

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)",
  },
  container: {
    maxWidth: 680,
    width: "100%",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "3rem",
  },
  logo: {
    display: "flex",
  },
  logoText: {
    fontWeight: 600,
    fontSize: "1.1rem",
    letterSpacing: "-0.02em",
  },
  hero: {
    marginBottom: "2rem",
  },
  h1: {
    fontSize: "clamp(2rem, 5vw, 3rem)",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1.15,
    marginBottom: "1rem",
  },
  subtitle: {
    fontSize: "1.125rem",
    color: "#888",
    lineHeight: 1.6,
    maxWidth: 520,
  },
  banner: {
    padding: "1rem 1.25rem",
    borderRadius: "0.5rem",
    marginBottom: "1.5rem",
    fontSize: "0.9rem",
    lineHeight: 1.5,
  },
  bannerSuccess: {
    background: "rgba(46, 182, 125, 0.1)",
    border: "1px solid rgba(46, 182, 125, 0.3)",
    color: "#2eb67d",
  },
  bannerError: {
    background: "rgba(224, 30, 90, 0.1)",
    border: "1px solid rgba(224, 30, 90, 0.3)",
    color: "#e01e5a",
  },
  code: {
    fontFamily: "monospace",
    background: "rgba(255,255,255,0.08)",
    padding: "0.1rem 0.4rem",
    borderRadius: "0.25rem",
    fontSize: "0.875em",
  },
  cta: {
    marginBottom: "3rem",
  },
  ctaButtons: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.75rem",
    marginBottom: "0.75rem",
  },
  installButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.6rem",
    background: "#fff",
    color: "#000",
    fontWeight: 600,
    fontSize: "1rem",
    padding: "0.75rem 1.5rem",
    borderRadius: "0.5rem",
    transition: "opacity 0.15s",
    textDecoration: "none",
  },
  telegramButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.6rem",
    background: "#229ED9",
    color: "#fff",
    fontWeight: 600,
    fontSize: "1rem",
    padding: "0.75rem 1.5rem",
    borderRadius: "0.5rem",
    transition: "opacity 0.15s",
    textDecoration: "none",
  },
  ctaNote: {
    fontSize: "0.85rem",
    color: "#555",
  },
  features: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1.25rem",
    marginBottom: "3rem",
  },
  feature: {
    display: "flex",
    gap: "0.75rem",
    padding: "1.25rem",
    background: "#111",
    borderRadius: "0.75rem",
    border: "1px solid #222",
  },
  featureIcon: {
    fontSize: "1.5rem",
    lineHeight: 1,
    flexShrink: 0,
  },
  featureTitle: {
    fontWeight: 600,
    fontSize: "0.95rem",
    marginBottom: "0.25rem",
    letterSpacing: "-0.01em",
  },
  featureDesc: {
    fontSize: "0.85rem",
    color: "#777",
    lineHeight: 1.5,
  },
  commands: {
    marginBottom: "3rem",
  },
  commandColumns: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1.5rem",
  },
  commandColumn: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  platformLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#aaa",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: "0.25rem",
  },
  h2: {
    fontWeight: 600,
    marginBottom: "1rem",
    color: "#aaa",
    textTransform: "uppercase",
    fontSize: "0.75rem",
    letterSpacing: "0.1em",
  },
  commandList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  command: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "0.625rem 1rem",
    background: "#111",
    borderRadius: "0.5rem",
    border: "1px solid #1e1e1e",
  },
  cmdCode: {
    fontFamily: "monospace",
    fontSize: "0.875rem",
    color: "#ededed",
    minWidth: 120,
    flexShrink: 0,
  },
  cmdDesc: {
    fontSize: "0.875rem",
    color: "#666",
  },
  footer: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
    fontSize: "0.85rem",
    color: "#444",
  },
  footerLink: {
    color: "#555",
    transition: "color 0.15s",
  },
  footerSep: {
    color: "#333",
  },
};
