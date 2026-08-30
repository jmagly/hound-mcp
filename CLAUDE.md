# CLAUDE.md

This file provides guidance to Claude Code when working with this codebase.

## Repository Purpose

MCP server for Hound code search integration. Exposes Hound's regex-based code search to Claude Code and other MCP-compatible AI agents via the Model Context Protocol (MCP).

## Tech Stack

- **Language**: TypeScript (ES2022, strict mode)
- **Runtime**: Node.js 22+
- **Module System**: ESM (NodeNext)
- **Dependencies**:
  - `@modelcontextprotocol/sdk` - MCP protocol implementation
  - `zod` - Schema validation

## Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Development mode with watch
npm run dev

# Run tests
npm test              # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage report

# Code quality
npm run typecheck     # TypeScript validation
npm run lint          # ESLint
npm run format        # Prettier
```

## Testing

- **Framework**: Vitest with v8 coverage provider
- **Test Location**: `src/**/*.test.ts`
- **Coverage Thresholds**: 60% minimum (branches, functions, lines, statements)
- **Coverage Reports**: text, json, html

Run tests before committing: `npm run test:run`

## Architecture

```
src/
├── index.ts           # Main entry point, MCP server setup, HTTP/OAuth2 handlers
├── auth.ts            # OAuth2 authentication (RFC 7591, PKCE)
├── cli.ts             # Client credentials CLI (mcp-hound-auth)
├── types.ts           # TypeScript type definitions
├── webhook.ts         # Gitea webhook handlers for auto-indexing
├── clients/
│   └── hound.ts       # Hound API client
└── tools/
    ├── search.ts      # hound_search tool implementation
    ├── repos.ts       # hound_repos tool implementation
    └── context.ts     # hound_file_context tool implementation
```

## MCP Tools

This server exposes three tools:

| Tool | Description |
|------|-------------|
| `hound_search` | Search code with regex patterns, pagination support |
| `hound_repos` | List all indexed repositories |
| `hound_file_context` | Get extended context around a code match with deep links |

## Important Files

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration (strict mode)
- `vitest.config.ts` - Test configuration with coverage thresholds
- `.gitea/workflows/ci.yml` - CI/CD pipeline (test, Docker, npm publish)
- `docker-compose.yml` - Container deployment
- `Dockerfile` / `Dockerfile.dev` - Production and dev container builds

## CI/CD

Gitea Actions pipeline (`.gitea/workflows/ci.yml`):

- **On all pushes/PRs**: typecheck, lint, test, build
- **On main push**: Build and push dev Docker image, publish dev npm package
- **On tags (v*)**: Build release Docker image, publish release npm package, create Gitea release

Registry: `git.integrolabs.net/roctinam/hound-mcp`

## Configuration

Environment variables for runtime:

| Variable | Description |
|----------|-------------|
| `HOUND_URL` | Hound server URL (default: `http://localhost:6080`) |
| `GITEA_URL` / `GITHUB_URL` | Git provider URL |
| `GITEA_TOKEN` / `GITHUB_TOKEN` | API token for private repos |
| `MCP_PORT` | HTTP server port (HTTP mode, default: 3000) |
| `HOUND_CONFIG_DIR` | Hound config directory (for auto-indexing) |

---

## Team Directives & Standards

<!-- PRESERVED SECTION - Content maintained across regeneration -->

<!-- Add team conventions, coding standards, and project-specific rules here -->

<!-- /PRESERVED SECTION -->

---

## AIWG Framework Integration

This project uses the AI Writing Guide (AIWG) framework for orchestrated development.

### Installed Frameworks

| Framework | Version | Status |
|-----------|---------|--------|
| sdlc-complete | 1.0.0 | healthy |

### Available Agents

58 specialized agents deployed in `.claude/agents/` covering:
- Architecture design and documentation
- Requirements analysis and validation
- Test engineering and quality assurance
- Security review and compliance
- DevOps and deployment automation
- Project management and planning

### Available Commands

74 slash commands deployed in `.claude/commands/` for:
- SDLC workflow orchestration
- Documentation generation
- Quality gate enforcement
- Release and deployment management

### AIWG Artifacts

Project artifacts stored in `.aiwg/`:
- `intake/` - Project intake forms and solution profiles
- `requirements/` - Use cases and specifications
- `architecture/` - ADRs and design documents
- `planning/` - Phase plans and iteration tracking
- `risks/` - Risk register and mitigation plans
- `gates/` - Phase gate documentation
- `team/` - Agent assignments and team structure

### Orchestration

Use `/orchestrate-project` to coordinate multi-agent workflows. The Executive Orchestrator manages agent delegation, enforces quality gates, and maintains artifact synchronization across the SDLC.

---

<!--
  USER NOTES
  Add team directives, conventions, or project-specific notes below.
  Content in this file's preserved sections is maintained during regeneration.
  Use <!-- PRESERVE --> markers for content that must be kept.
-->
