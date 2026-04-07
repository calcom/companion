# Deploying the Cal.com MCP Server (AWS EC2)

Single-instance deployment using Docker Compose with Caddy for automatic TLS.

## Prerequisites

- An AWS EC2 instance (t3.small or larger)
- A domain name with DNS A record pointing to the instance's public IP
- A Cal.com OAuth app created at [Cal.com Developer Settings](https://app.cal.com/settings/developer/oauth-clients) with callback URL set to `https://your-domain.com/oauth/callback`

## 1. Launch EC2 Instance

| Setting | Value |
|---------|-------|
| AMI | Amazon Linux 2023 or Ubuntu 24.04 |
| Instance type | `t3.small` (2 vCPU, 2GB RAM) |
| Storage | 20GB gp3 EBS |
| Security group inbound | 22 (SSH), 80 (HTTP), 443 (HTTPS) |
| Security group outbound | All traffic |

## 2. Install Docker

SSH into the instance:

```bash
# Amazon Linux 2023
sudo yum install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for group change to take effect
exit
```

For Ubuntu, replace `yum` with `apt` and `docker` with `docker.io`.

## 3. Clone and Configure

```bash
git clone https://github.com/calcom/companion.git
cd companion/apps/mcp-server

# Create persistent data directory for SQLite
mkdir -p data
```

Create a `.env` file:

```bash
# Required
SERVER_URL=https://mcp.yourdomain.com
CAL_OAUTH_CLIENT_ID=your_client_id
CAL_OAUTH_CLIENT_SECRET=your_client_secret
TOKEN_ENCRYPTION_KEY=          # Generate below

# Optional (defaults shown)
CAL_API_BASE_URL=https://api.cal.com
CAL_APP_BASE_URL=https://app.cal.com
CORS_ORIGIN=*
LOG_LEVEL=info

# Caddy domain
DOMAIN=mcp.yourdomain.com
```

Generate the encryption key:

```bash
openssl rand -hex 32
```

Update the `Caddyfile` domain (or rely on the `DOMAIN` env var):

```
mcp.yourdomain.com {
    reverse_proxy mcp-server:3100
}
```

## 4. Deploy

```bash
docker-compose up -d --build
```

Caddy automatically provisions a TLS certificate from Let's Encrypt on first request. No manual cert setup needed.

## 5. Verify

```bash
# Health check
curl https://mcp.yourdomain.com/health
# Expected: {"status":"ok","sessions":0,"db":"ok","uptime":...}

# OAuth metadata
curl https://mcp.yourdomain.com/.well-known/oauth-authorization-server

# Logs
docker-compose logs -f mcp-server
```

## 6. Updates

```bash
cd companion/apps/mcp-server
git pull
docker-compose up -d --build
```

The SQLite database in `./data/` is preserved across rebuilds.

## Architecture

```
Internet
  │
  ▼
┌──────────┐    ┌──────────────┐    ┌──────────────┐
│  Caddy   │───▶│  MCP Server  │───▶│  Cal.com API │
│ :80/:443 │    │    :3100     │    │              │
│ (TLS)    │    │  (Docker)    │    │              │
└──────────┘    └──────┬───────┘    └──────────────┘
                       │
                 ┌─────┴─────┐
                 │  SQLite   │
                 │ ./data/   │
                 └───────────┘
```

## Important Notes

### SQLite Persistence

The `./data/` directory contains the SQLite database with all OAuth tokens, registered clients, and session state. **If this is lost, all users must re-authenticate.**

- Back it up regularly: `cp data/mcp-server.db data/mcp-server.db.bak`
- For automated backups, set up a cron job to copy to S3:
  ```bash
  # Add to crontab -e
  0 */6 * * * aws s3 cp /opt/calcom-mcp/data/mcp-server.db s3://your-bucket/backups/mcp-server-$(date +\%Y\%m\%d-\%H\%M).db
  ```

### TLS

Caddy handles TLS automatically via Let's Encrypt. Requirements:
- Port 80 must be open (used for ACME HTTP-01 challenge)
- Port 443 must be open
- DNS must resolve to the instance's public IP before first deploy

### TRUST_PROXY

Set to `true` in docker-compose.yml so the MCP server reads the real client IP from `X-Forwarded-For` (set by Caddy). This ensures rate limiting works correctly per actual client, not per Caddy's internal IP.

### Scaling

This setup is single-instance. Sessions and rate limits are in-memory, tokens are in SQLite. To scale horizontally:
- Replace SQLite with PostgreSQL (RDS)
- Move sessions and rate limits to Redis (ElastiCache)
- Run multiple instances behind an ALB

### Monitoring

- Use `/health` endpoint with Route 53 health checks or an external uptime monitor
- Set up CloudWatch alarms on the EC2 instance (CPU, disk, network)
- Monitor `docker-compose logs mcp-server` for errors

### Security

- Never commit `.env` to version control
- Rotate `TOKEN_ENCRYPTION_KEY` only if you're willing to invalidate all existing tokens (users must re-auth)
- Keep the EC2 security group locked down to ports 22, 80, 443 only
- Consider restricting SSH (port 22) to your IP only
