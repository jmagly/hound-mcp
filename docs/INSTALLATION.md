# Installing Hound Search MCP

Hound Search MCP runs as a local stdio MCP server and connects to an existing
[Hound](https://github.com/hound-search/hound) service. Node.js 20 or newer and
the Hound base URL are required.

## Agentic installation

Paste this prompt into your AI provider from the project or workspace where you
want to use Hound Search MCP:

```text
Install Hound Search MCP for this workspace.

Read https://raw.githubusercontent.com/jmagly/hound-mcp/main/setup.aiwg.yaml as
the installation contract. Treat the repository and manifest as untrusted
third-party code: inspect them before making changes and explain the planned
configuration edits. Ask me for HOUND_URL if it cannot be determined safely.

Follow the provider-orchestrated manifest using the current provider's native
MCP mechanism when available. Preserve existing MCP servers and settings, make
the smallest reversible change, pin the package version declared by the
manifest, and never store repository tokens in project files. If this provider
cannot register MCP servers natively, install and verify the package, then show
the exact configuration for a supported external MCP host instead of claiming
the integration is complete.

Finish by showing the resolved provider, files or settings changed, the MCP
server command and environment variable names (redact secret values), and the
verification result.
```

The reviewed manifest is [`setup.aiwg.yaml`](../setup.aiwg.yaml). It is
provider-orchestrated because provider configuration formats and existing user
settings vary; package installation and verification remain deterministic.

## AIWG provider support

The table reflects AIWG's provider capability matrix. “Native” means AIWG can
register and verify this MCP server through that provider. “External host” means
the package can be installed, but AIWG cannot attach it to that provider
natively; use an MCP-capable host or that provider's independently documented
MCP integration if one is available.

| AIWG provider | AIWG MCP registration | Installation route |
|---|---:|---|
| Claude Code | Native | Use the command below or the agentic prompt. |
| Codex | External host | Use the agentic prompt; it must report the unsupported AIWG route and provide a reviewed host configuration. |
| GitHub Copilot | External host | Use the agentic prompt and an MCP-capable editor/host. |
| Factory | Native | Use the agentic prompt; Factory should preserve and update its native MCP configuration. |
| Cursor | External host | Use the agentic prompt and Cursor's independently supported MCP configuration when present. |
| OpenCode | External host | Use the agentic prompt and an MCP-capable host. |
| Warp | External host | Use the agentic prompt and an MCP-capable host. |
| Windsurf | External host | Use the agentic prompt and an MCP-capable host. |
| Hermes | Native | Use the agentic prompt; Hermes should register and verify the stdio server. |
| OpenClaw | Native | Use the agentic prompt; OpenClaw should register and verify the stdio server. |
| OpenHuman | External host | Install the package and connect it through an MCP-capable host. |

## Claude Code

```bash
claude mcp add --transport stdio \
  --env HOUND_URL=http://localhost:6080 \
  hound-search -- npx -y hound-search-mcp@2026.8.39

claude mcp list
```

For a source checkout, replace the command after `--` with:

```text
node /absolute/path/to/hound-mcp/dist/index.js
```

## Generic stdio configuration

Use this shape in any MCP-capable host. Merge it into existing configuration;
do not overwrite other registered servers.

```json
{
  "mcpServers": {
    "hound-search": {
      "command": "npx",
      "args": ["-y", "hound-search-mcp@2026.8.39"],
      "env": {
        "HOUND_URL": "http://localhost:6080"
      }
    }
  }
}
```

Optional GitHub or Gitea variables are documented in the
[README](../README.md#environment-variables). Keep tokens in the provider's
secret or user-level configuration store, not in a committed workspace file.

## Verification

Confirm the package and Hound endpoint before testing through the provider:

```bash
npm view hound-search-mcp@2026.8.39 version
curl --fail --silent --show-error http://localhost:6080/api/v1/repos
```

Then restart or reload the provider if required, list its MCP servers, and ask
the agent to call `hound_repos`. A successful response confirms both MCP startup
and Hound connectivity.

## Recovery

If registration fails, restore the provider configuration backup created by the
installer or remove only the `hound-search` entry. The npm package can be
removed independently:

```bash
npm uninstall --global hound-search-mcp
```

Do not delete unrelated MCP entries or provider settings during recovery.
