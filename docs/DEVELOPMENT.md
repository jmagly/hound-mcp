# Hound MCP Development Guide

This guide covers building, testing, deploying, and troubleshooting Hound MCP.

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm 9+
- Access to a Hound code search instance
- Git
- (Optional) Docker for containerized deployment

## Quick Start

```bash
# Clone repository
git clone https://github.com/jmagly/hound-mcp.git
cd mcp-hound

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Hound and Gitea/GitHub URLs

# Build
npm run build

# Run in development mode (with hot reload)
npm run dev

# Run tests
npm test
```

## Build Process

### Development Build

```bash
# TypeScript compilation with watch mode
npm run dev
```

This uses `tsx` for fast TypeScript execution with hot reload.

### Production Build

```bash
# Clean build
rm -rf dist/
npm run build

# Verify build output
ls -la dist/
# Should contain: index.js, cli.js, and supporting files
```

### Quality Checks

```bash
# Run all checks before committing
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run test:run     # Unit tests (single run)
npm test             # Unit tests (watch mode)
npm run test:coverage # Coverage report
```

## Local Testing

### stdio Mode (Local Claude Code)

```bash
# Run directly
node dist/index.js

# Or with environment variables
HOUND_URL=http://localhost:6080 node dist/index.js
```

Configure in `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "hound": {
      "command": "node",
      "args": ["/path/to/mcp-hound/dist/index.js"],
      "env": {
        "HOUND_URL": "http://localhost:6080"
      }
    }
  }
}
```

### HTTP Mode (Remote/Service)

```bash
# Start in HTTP mode
node dist/index.js --http --port 3100

# Test endpoints
curl http://localhost:3100/health
curl http://localhost:3100/.well-known/oauth-authorization-server
```

## Deployment

### Manual Deployment

```bash
# 1. Build
npm run build

# 2. Copy to deployment directory
sudo mkdir -p /opt/mcp-hound /etc/mcp-hound
sudo cp -r dist package.json package-lock.json /opt/mcp-hound/
sudo cp -r node_modules /opt/mcp-hound/

# 3. Create environment file
sudo cp .env.example /etc/mcp-hound/env
sudo chmod 600 /etc/mcp-hound/env
# Edit /etc/mcp-hound/env with production values

# 4. Create empty clients file
echo '[]' | sudo tee /etc/mcp-hound/clients.json
sudo chmod 600 /etc/mcp-hound/clients.json

# 5. Install systemd service
sudo cp deploy/mcp-hound.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mcp-hound
sudo systemctl start mcp-hound
```

### Update Deployment

```bash
# From project directory after changes
npm run build
sudo cp -r dist/* /opt/mcp-hound/dist/
sudo cp package.json /opt/mcp-hound/
sudo systemctl restart mcp-hound

# Verify
sudo systemctl status mcp-hound
curl http://localhost:3100/health
```

### Docker Deployment

```bash
# Build production image
docker compose build mcp-hound

# Run
docker compose up -d mcp-hound

# View logs
docker compose logs -f mcp-hound

# Development with hot reload
docker compose --profile dev up dev
```

## Service Management

```bash
# Status
sudo systemctl status mcp-hound

# Logs (live)
sudo journalctl -u mcp-hound -f

# Logs (recent)
sudo journalctl -u mcp-hound --since "10 minutes ago"

# Restart
sudo systemctl restart mcp-hound

# Stop
sudo systemctl stop mcp-hound
```

## API Testing

### Health Check

```bash
curl -s http://localhost:3100/health | jq .
# Expected: {"status":"ok","mode":"http","port":3100}
```

### OAuth Flow

```bash
# 1. Register a client
curl -s -X POST http://localhost:3100/oauth/register \
  -H "Content-Type: application/json" \
  -d '{"client_name": "test-client"}' | jq .

# 2. Get access token (use client_id and client_secret from step 1)
curl -s -X POST http://localhost:3100/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=CLIENT_ID&client_secret=CLIENT_SECRET" | jq .

# 3. Test authenticated endpoint
curl -s http://localhost:3100/.well-known/oauth-protected-resource \
  -H "Authorization: Bearer ACCESS_TOKEN" | jq .
```

### MCP Protocol Testing

```bash
# Initialize session (required before tool calls)
curl -s -X POST http://localhost:3100/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0"}
    }
  }'
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOUND_URL` | Yes | `http://localhost:6080` | Hound server URL |
| `HOUND_TIMEOUT` | No | `30000` | Hound request timeout (ms) |
| `GITEA_URL` | One of Gitea/GitHub | - | Gitea server URL |
| `GITEA_TOKEN` | For private repos | - | Gitea API token |
| `GITEA_TIMEOUT` | No | `10000` | Gitea API timeout (ms) |
| `GITHUB_URL` | One of Gitea/GitHub | `https://github.com` | GitHub URL |
| `GITHUB_TOKEN` | For private repos | - | GitHub PAT |
| `GITHUB_TIMEOUT` | No | `10000` | GitHub API timeout (ms) |
| `MCP_PORT` | No | `3000` | HTTP server port |
| `MCP_CREDENTIALS_FILE` | No | `/etc/mcp-hound/clients.json` | OAuth clients file |
| `HOUND_CONFIG_DIR` | For webhooks | - | Hound config directory |
| `HOUND_WEBHOOK_SECRET` | For webhooks | - | Webhook signature secret |

## Project Structure

```
mcp-hound/
├── src/
│   ├── index.ts          # Main entry, MCP server, HTTP server
│   ├── auth.ts           # OAuth2 authentication
│   ├── cli.ts            # Client management CLI
│   ├── webhook.ts        # Gitea webhook handler
│   ├── types.ts          # Shared types
│   ├── clients/
│   │   └── hound.ts      # Hound API client
│   └── tools/
│       ├── search.ts     # hound_search tool
│       ├── repos.ts      # hound_repos tool
│       └── context.ts    # hound_file_context tool
├── dist/                 # Compiled output
├── deploy/               # Deployment files
│   └── mcp-hound.service # Systemd service
├── docs/                 # Documentation
└── .gitea/workflows/     # CI/CD
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs for errors
sudo journalctl -u mcp-hound -n 50

# Verify environment file
sudo cat /etc/mcp-hound/env

# Test manually
sudo -u mcp-hound node /opt/mcp-hound/dist/index.js --http --port 3100
```

### Connection Refused

```bash
# Check if service is listening
ss -tlnp | grep 3100

# Check firewall
sudo iptables -L -n | grep 3100
```

### OAuth Errors

```bash
# Check clients file exists and is readable
ls -la /etc/mcp-hound/clients.json

# View registered clients (excludes secrets)
cat /etc/mcp-hound/clients.json | jq '.[].clientId'
```

### Hound API Errors

```bash
# Test Hound connectivity
curl -s "$HOUND_URL/api/v1/repos" | jq 'keys[:3]'

# Check for timeout issues
time curl -s "$HOUND_URL/api/v1/search?q=test&repos=*"
```

### Gitea/GitHub API Errors

```bash
# Test Gitea API
curl -s -H "Authorization: token $GITEA_TOKEN" \
  "$GITEA_URL/api/v1/user" | jq .login

# Test GitHub API
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/user" | jq .login
```

## CI/CD Pipeline

The Gitea Actions workflow (`.gitea/workflows/ci.yml`) runs:

1. **test** - TypeScript, lint, unit tests, build (all pushes)
2. **docker-build** - Build Docker images (after test)
3. **docker-publish** - Push to Gitea registry (on tags)
4. **npm-publish** - Publish to Gitea npm (on tags)
5. **release** - Create Gitea release (on tags)

### Creating a Release

```bash
# Tag a version
git tag v0.1.1
git push origin v0.1.1

# This triggers the full publish pipeline
```

### Required Secrets

Configure in Gitea repo settings → Actions → Secrets:

| Secret | Purpose |
|--------|---------|
| `REGISTRY_USERNAME` | Docker registry username |
| `REGISTRY_PASSWORD` | Docker registry password |
| `GITEA_TOKEN` | npm publish + release creation |
