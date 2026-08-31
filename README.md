# Hound MCP

Multi-modal code search MCP server combining [Hound](https://github.com/hound-search/hound) text search, tree-sitter symbol extraction, and future semantic search. Exposes powerful code search capabilities to Claude Code and other MCP-compatible AI agents.

> **Note**: This server provides multiple search modalities. Text search uses Hound's regex patterns, symbol search uses tree-sitter AST parsing, and semantic search (planned) will use embeddings.

## Features

### Text Search (Hound)
- **hound_search** - Search code across all indexed repositories with regex patterns and pagination
- **hound_repos** - List all repositories indexed by Hound
- **hound_file_context** - Get extended context around a code match with Gitea/GitHub deep links
- **hound_repo_stats** - Get repository statistics including file counts, line counts, and language breakdown

### Symbol Search (Tree-sitter)
- **hound_search_symbol** - Find functions, classes, methods, interfaces, and types by name with wildcards
- **hound_index_repos** - Manually trigger symbol indexing (auto-indexes on startup)
- Tree-sitter AST parsing for accurate symbol extraction
- Supported languages: TypeScript, JavaScript, Python, Go, Rust, Solidity, C#
- Symbol type filtering (function, class, method, interface, type)

### Documentation
- **hound_help** - Comprehensive documentation and usage guidance for AI agents

### Future: Semantic Search
- Embedding-based similarity search (tracked in [#17](https://github.com/jmagly/hound-mcp/issues/17))

### Infrastructure
- **Auto-indexing** - Webhook support for automatic Hound re-indexing when repos change

## Requirements

- Node.js 20+
- Running [Hound](https://github.com/hound-search/hound) instance
- Gitea or GitHub instance (Hound indexes repositories from these providers)
- (Optional) API token for file context lookups and private repository access

## Installation

```bash
# Install the command globally
npm install -g hound-search-mcp

# Or run it without a global install
npx -y hound-search-mcp

# From source
git clone https://github.com/jmagly/hound-mcp.git
cd hound-mcp
npm install
npm run build
```

For an AI-assisted installation, paste the installer prompt from
[docs/INSTALLATION.md](docs/INSTALLATION.md) into your provider. The prompt uses
the repository's reviewed [`setup.aiwg.yaml`](setup.aiwg.yaml) manifest to
inspect existing configuration, preserve it, register the server, and verify
the result.

AIWG currently provides native MCP registration for Claude Code, Factory,
Hermes, and OpenClaw. The installation guide also covers Codex, Copilot,
Cursor, OpenCode, Warp, Windsurf, and OpenHuman, including the required fallback
when AIWG cannot register MCP servers natively on that provider.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOUND_URL` | `http://localhost:6080` | Hound server URL |
| `HOUND_TIMEOUT` | `30000` | Request timeout (ms) |
| `GITEA_URL` | - | Gitea server URL (for file context) |
| `GITEA_TOKEN` | - | Gitea API token (for private repos) |
| `GITEA_TIMEOUT` | `10000` | Gitea API timeout (ms) |
| `GITHUB_URL` | `https://github.com` | GitHub URL (for Enterprise, otherwise defaults) |
| `GITHUB_TOKEN` | - | GitHub personal access token (for private repos) |
| `GITHUB_TIMEOUT` | `10000` | GitHub API timeout (ms) |
| `MCP_PORT` | `3000` | HTTP server port (HTTP mode only) |
| `CORS_ALLOWED_ORIGIN` | - | Allowed CORS origin (leave empty for permissive dev mode) |
| `HOUND_CONFIG_DIR` | - | Path to Hound config directory (for auto-indexing) |
| `HOUND_WEBHOOK_SECRET` | - | Secret for Gitea webhook signature verification |

> **Note**: Configure either Gitea OR GitHub (required - Hound indexes repos from these). If both are set, Gitea takes priority. Tokens are optional but required for private repos and the `hound_file_context` tool.

### Claude Code quick start

```bash
claude mcp add --transport stdio \
  --env HOUND_URL=http://localhost:6080 \
  hound-search -- npx -y hound-search-mcp
```

Run `claude mcp list` to verify the registration. For every other AIWG provider,
or to preserve and merge an existing configuration safely, follow the
[complete provider installation guide](docs/INSTALLATION.md).

### Manual Claude Code configuration

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "codehound": {
      "command": "node",
      "args": ["/path/to/hound-mcp/dist/index.js"],
      "env": {
        "HOUND_URL": "http://localhost:6080"
      }
    }
  }
}
```

Or using npx:

```json
{
  "mcpServers": {
    "codehound": {
      "command": "npx",
      "args": ["-y", "hound-search-mcp"],
      "env": {
        "HOUND_URL": "http://localhost:6080"
      }
    }
  }
}
```

## Usage

Once configured, the MCP tools are available in Claude Code. The AI agent translates user intent into regex queries:

### Search Code

```
User: Find where JWT tokens are validated in the codebase

Claude synthesizes regex and calls:
  hound_search({ query: "validateJWT|verifyToken|jwt\\.verify", files: "*.ts" })
```

### Paginate Through Results

```
User: Show me the next page of results

Claude uses offset from previous response:
  hound_search({ query: "TODO|FIXME", offset: 20, limit: 20 })
```

### List Repositories

```
User: What repositories are indexed?

Claude calls:
  hound_repos()
```

### Get File Context

```
User: Show me more context around that match

Claude calls:
  hound_file_context({ repo: "myorg/myrepo", file: "src/auth.ts", line: 42 })
```

## Tools Reference

### hound_search

Search code across repositories with pagination support.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | Regex pattern (e.g., `validateJWT\|verifyToken`, `func\s+\w+`) |
| `repos` | string | No | `*` | Comma-separated repo names (e.g., `owner/repo`) or `*` for all |
| `files` | string | No | - | Glob pattern filter (e.g., `*.ts`, `src/*.js`) |
| `ignore_case` | boolean | No | `false` | Case-insensitive search |
| `limit` | number | No | `20` | Results per page (1-100) |
| `offset` | number | No | `0` | Skip N results for pagination |

**Response includes pagination metadata:**
- `totalMatches` - Total matches found
- `count` - Results in this response
- `hasMore` - Whether more results exist
- `nextOffset` - Offset for next page (use with subsequent request)

### hound_repos

List all indexed repositories. No parameters required.

### hound_file_context

Get extended context around a specific line.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repo` | string | Yes | - | Repository name (e.g., `owner/repo`) |
| `file` | string | Yes | - | File path (e.g., `src/index.ts`) |
| `line` | number | Yes | - | Center line number |
| `context` | number | No | `10` | Lines before/after (max 50) |

### hound_repo_stats

Get repository statistics including file counts, line counts, and language breakdown.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repo` | string | No | `*` | Repository name or `*` for all |

### hound_search_symbol

Search for code symbols (functions, classes, methods, interfaces, types) using tree-sitter AST parsing.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | Yes | - | Symbol name pattern (supports `*` wildcards) |
| `kind` | string | No | - | Filter: `function`, `class`, `method`, `interface`, `type` |
| `language` | string | No | - | Filter: `typescript`, `javascript`, `python`, `go`, `rust`, `solidity`, `csharp` |
| `repo` | string | No | - | Filter by repository name |
| `limit` | number | No | `50` | Max results (1-500) |

**Wildcard patterns:**
- `validate*` - Starts with "validate"
- `*Handler` - Ends with "Handler"
- `*User*` - Contains "User"

**Symbol kinds by language:**

| Language | Kinds |
|----------|-------|
| TypeScript | function, class, method, interface, type |
| JavaScript | function, class, method |
| Python | function, class, method, variable |
| Go | function, method, type |
| Rust | function, struct, impl, trait |
| Solidity | function, contract, event |
| C# | class, method, interface |

### hound_index_repos

Manually trigger symbol indexing. Symbols are auto-indexed on server startup; use this for manual re-indexing.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repos` | string | No | - | Comma-separated repos or empty for all |
| `branch` | string | No | `main` | Branch to index |

### hound_help

Get comprehensive documentation and usage guidance for AI agents.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` | string | No | - | Topic: `overview`, `search`, `symbols`, `context`, `repos`, `stats`, `tips` |

Call with no arguments for full documentation.

## Deployment

### Transport Modes

CodeHound supports two transport modes:

- **stdio** (default): For local invocation by Claude Code
- **http**: For remote/service deployment with OAuth2 authentication

### Local Mode (stdio)

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "hound": {
      "command": "node",
      "args": ["/path/to/hound-mcp/dist/index.js"],
      "env": {
        "HOUND_URL": "http://localhost:6080"
      }
    }
  }
}
```

### Docker Deployment

CodeHound provides Docker images for containerized deployment:

```bash
# Build production image
docker compose build hound-mcp

# Run production container
docker compose up -d hound-mcp

# Run with environment variables
docker run -d \
  -p 3100:3000 \
  -e HOUND_URL=http://hound:6080 \
  -e GITHUB_TOKEN=your_token \
  jmagly/hound-mcp:latest

# Development with live reload
docker compose --profile dev up dev
```

See `docker-compose.yml` for full configuration options.

### Remote Mode (HTTP with OAuth2)

For remote deployment, CodeHound provides OAuth2 authentication with:
- Dynamic client registration (RFC 7591)
- Authorization code flow with PKCE
- Refresh token support

#### 1. System Service Setup

```bash
# Clone and build
git clone https://github.com/jmagly/hound-mcp.git
cd hound-mcp
npm install
npm run build

# Create directories
sudo mkdir -p /opt/hound-mcp /etc/hound-mcp

# Copy files
sudo cp -r dist package.json /opt/hound-mcp/
sudo cp -r node_modules /opt/hound-mcp/

# Create environment file
sudo tee /etc/hound-mcp/env << 'EOF'
HOUND_URL=https://your-hound-instance.example.com
GITEA_URL=https://your-gitea-instance.example.com
GITEA_TOKEN=your-gitea-api-token
MCP_CREDENTIALS_FILE=/etc/hound-mcp/clients.json

# Auto-indexing (optional)
HOUND_CONFIG_DIR=/path/to/hound/config
# HOUND_WEBHOOK_SECRET=optional-webhook-secret
EOF

# Create empty clients file
echo '[]' | sudo tee /etc/hound-mcp/clients.json
```

#### 2. Systemd Service

Create `/etc/systemd/system/hound-mcp.service`:

```ini
[Unit]
Description=CodeHound Code Search Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/hound-mcp
ExecStart=/usr/bin/node /opt/hound-mcp/dist/index.js --http --port 3100
Restart=always
RestartSec=10
EnvironmentFile=/etc/hound-mcp/env
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hound-mcp

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable hound-mcp
sudo systemctl start hound-mcp
```

#### 3. Nginx Reverse Proxy (HTTPS)

Create `/etc/nginx/sites-available/hound-mcp`:

```nginx
server {
    listen 443 ssl http2;
    server_name hound-mcp.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Required for SSE (Server-Sent Events)
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 4. Claude Code Configuration

Add to `~/.claude.json` on the client machine:

```json
{
  "mcpServers": {
    "hound": {
      "url": "https://hound-mcp.example.com/"
    }
  }
}
```

Then authenticate:

```bash
claude
> /mcp
# Select "Authenticate" for the Hound server
# Browser opens → Click "Authorize"
# Connection established
```

### Auto-Indexing with Webhooks

CodeHound can automatically update the Hound index when repositories are created or deleted in Gitea.

#### Setup

1. Configure environment variables:
   ```bash
   HOUND_CONFIG_DIR=/path/to/hound/deployments
   HOUND_WEBHOOK_SECRET=optional-secret  # For signature verification
   ```

2. Add a webhook in Gitea (Organization or Repository settings):
   - **URL**: `https://hound-mcp.example.com/webhook/gitea`
   - **Content Type**: `application/json`
   - **Events**: Repository (Created, Deleted)
   - **Secret**: Same as `HOUND_WEBHOOK_SECRET` (optional)

#### Manual Sync

Trigger a manual sync via authenticated API:

```bash
curl -X POST https://hound-mcp.example.com/admin/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### API Endpoints

#### OAuth2 Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/oauth-authorization-server` | GET | OAuth2 AS metadata (RFC 8414) |
| `/.well-known/oauth-protected-resource` | GET | Resource metadata (RFC 9728) |
| `/oauth/authorize` | GET | Authorization page |
| `/oauth/authorize` | POST | Approve authorization |
| `/oauth/token` | POST | Token exchange |
| `/oauth/register` | POST | Dynamic client registration (RFC 7591) |

#### MCP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` or `/sse` | GET | SSE transport (Accept: text/event-stream) |
| `/messages` | POST | Message endpoint for SSE transport |
| `/` | POST | Streamable HTTP transport |
| `/health` | GET | Health check (no auth required) |

#### Admin Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/webhook/gitea` | POST | Webhook secret | Gitea webhook receiver |
| `/admin/sync` | POST | Bearer token | Manual Hound sync trigger |

### Service Management

```bash
# Check status
sudo systemctl status hound-mcp

# View logs
sudo journalctl -u hound-mcp -f

# Restart after config changes
sudo systemctl restart hound-mcp
```

### Client Credentials CLI

For manual client management:

```bash
# Create a client
hound-mcp-auth create "My Client Name"

# List clients
hound-mcp-auth list

# Revoke a client
hound-mcp-auth revoke mcp_xxxxx
```

> **Note**: Tokens are stored in-memory. Server restarts require re-authentication.

## Error Messages

CodeHound provides helpful error messages for AI agents:

**Empty search results:**
```
No matches found. Try:
- A different regex pattern
- Removing the files filter
- Using ignore_case: true
- Checking repos with hound_repos()
```

**Timeout errors:**
```
Search timed out.

Try:
- A more specific regex pattern
- Limiting to specific repos: repos: "owner/repo"
- Adding a files filter: files: "*.ts"
```

**File not found:**
```
File not found: owner/repo/path/to/file.ts (branch: main)
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development guidelines.

## Project Status

This project is in active development. See the [issues](https://github.com/jmagly/hound-mcp/issues) for planned features and known issues.

## ❤️ Sponsors

**CodeHound is made possible by our sponsors.**

<table>
<tr>
<td width="33%" align="center">

### [Roko Network](https://roko.network)

**The Temporal Layer for Web3**

Building enterprise-grade timing infrastructure for blockchain applications. Roko Network enables developers to create decentralized systems with nanosecond-level precision.

</td>
<td width="33%" align="center">

### [Selfient](https://selfient.xyz)

**No-Code Smart Contracts for Everyone**

Democratizing Web3 by making blockchain-based agreements accessible to all. Selfient empowers creators, freelancers, and businesses to create enforceable smart contracts without writing code.

</td>
<td width="33%" align="center">

### [Integro Labs](https://integrolabs.io)

**AI-Powered Automation Solutions**

Harnessing the transformative potential of AI and blockchain to shape digital automation. Integro Labs delivers custom solutions for the age of intelligent systems.

</td>
</tr>
</table>

**Interested in sponsoring?** [Contact us](https://github.com/jmagly/hound-mcp/discussions) to learn how your organization can support open-source AI tooling.

## Acknowledgments

CodeHound is built on top of [Hound](https://github.com/hound-search/hound), the lightning-fast code search engine created by Etsy. Hound makes it possible to search across thousands of repositories in milliseconds using regular expressions.

## License

[MIT](LICENSE)
