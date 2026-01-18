/**
 * hound_help MCP Tool
 *
 * Provides comprehensive documentation and usage guidance for CodeHound MCP tools.
 * Designed for AI agents to understand capabilities, best practices, and troubleshooting.
 */

import { z } from 'zod';

/**
 * Input schema for hound_help tool
 */
export const houndHelpSchema = {
  type: 'object' as const,
  properties: {
    topic: {
      type: 'string',
      description:
        'Help topic: "overview", "search", "symbols", "context", "repos", "stats", "tips", or omit for full documentation',
    },
  },
  required: [],
};

/**
 * Zod schema for runtime validation
 */
const HelpInputSchema = z.object({
  topic: z
    .enum(['overview', 'search', 'symbols', 'context', 'repos', 'stats', 'tips'])
    .optional(),
});

/**
 * Documentation sections
 */
const DOCS: Record<string, string> = {
  overview: `# CodeHound MCP - Overview

CodeHound provides multi-modal code search for AI agents:

## Available Tools

| Tool | Purpose |
|------|---------|
| \`hound_search\` | Regex text search across all repositories |
| \`hound_search_symbol\` | AST-based symbol search (functions, classes, interfaces) |
| \`hound_repos\` | List indexed repositories |
| \`hound_file_context\` | Get extended code context with deep links |
| \`hound_repo_stats\` | Repository statistics and language breakdown |
| \`hound_help\` | This documentation |

## Search Modalities

1. **Text Search** (\`hound_search\`) - Fast regex search using Hound
   - Best for: patterns, strings, comments, general text
   - Supports: regex, file filters, pagination

2. **Symbol Search** (\`hound_search_symbol\`) - Tree-sitter AST parsing
   - Best for: finding definitions (functions, classes, interfaces)
   - Supports: wildcards, kind filtering, language filtering
   - Languages: TypeScript, JavaScript, Python, Go, Rust, Solidity, C#

## Quick Start

\`\`\`
# Find function definitions
hound_search_symbol({ name: "validate*", kind: "function" })

# Text search with regex
hound_search({ query: "TODO|FIXME", files: "*.ts" })

# Get context around a match
hound_file_context({ repo: "owner/repo", file: "src/auth.ts", line: 42 })
\`\`\`
`,

  search: `# hound_search - Text Search

Regex-based code search across all indexed repositories.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| \`query\` | string | **Yes** | - | Regex pattern |
| \`repos\` | string | No | \`*\` | Comma-separated repos or \`*\` |
| \`files\` | string | No | - | Glob filter (e.g., \`*.ts\`) |
| \`ignore_case\` | boolean | No | \`false\` | Case-insensitive |
| \`limit\` | number | No | \`20\` | Results per page (1-100) |
| \`offset\` | number | No | \`0\` | Pagination offset |

## Regex Tips

- **Alternation**: \`foo|bar\` matches "foo" or "bar"
- **Word boundary**: \`\\bvalidate\\b\` matches whole word only
- **Wildcards**: \`validate.*Token\` matches "validateJwtToken", "validate_user_Token"
- **Character class**: \`[Tt]oken\` matches "Token" or "token"
- **Escape special chars**: \`\\.\` for literal dot, \`\\(\` for literal paren

## Examples

\`\`\`javascript
// Find JWT validation patterns
hound_search({ query: "jwt\\.verify|validateToken|verifyJWT" })

// Find TODO comments in TypeScript
hound_search({ query: "TODO:|FIXME:", files: "*.ts" })

// Case-insensitive search
hound_search({ query: "error", ignore_case: true })

// Paginate through results
hound_search({ query: "import", limit: 50, offset: 100 })

// Search specific repos
hound_search({ query: "database", repos: "org/backend,org/api" })
\`\`\`

## Pagination

Response includes:
- \`totalMatches\` - Total matches found
- \`hasMore\` - Whether more results exist
- \`nextOffset\` - Use this for the next page

## When to Use

✅ Use \`hound_search\` for:
- Finding text patterns, strings, comments
- Searching in non-code files (configs, docs)
- Complex regex patterns
- When you need the exact line content

❌ Use \`hound_search_symbol\` instead for:
- Finding function/class/interface definitions
- When you need the symbol type (function vs method vs class)
- Language-aware searches
`,

  symbols: `# hound_search_symbol - Symbol Search

AST-based symbol search using tree-sitter parsing. Finds definitions precisely.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| \`name\` | string | **Yes** | - | Symbol name pattern (supports \`*\` wildcards) |
| \`kind\` | string | No | - | Filter: function, class, method, interface, type, variable |
| \`language\` | string | No | - | Filter: typescript, javascript, python, go, rust, solidity, csharp |
| \`repo\` | string | No | - | Filter by repository |
| \`limit\` | number | No | \`50\` | Max results (1-500) |

## Wildcard Patterns

- \`validate*\` - Starts with "validate"
- \`*Handler\` - Ends with "Handler"
- \`*User*\` - Contains "User"
- \`get*By*\` - Multiple wildcards

## Symbol Kinds

| Kind | Description | Languages |
|------|-------------|-----------|
| \`function\` | Function declarations, arrow functions | All |
| \`class\` | Class declarations (including abstract) | TS, JS, Python, C# |
| \`method\` | Class/object methods | All |
| \`interface\` | Interface declarations | TypeScript |
| \`type\` | Type aliases, enums | TypeScript |
| \`variable\` | Constants, variables | Python, Go |

## Examples

\`\`\`javascript
// Find all functions starting with "validate"
hound_search_symbol({ name: "validate*", kind: "function" })

// Find interfaces in TypeScript
hound_search_symbol({ name: "*Config", kind: "interface", language: "typescript" })

// Find classes containing "Service"
hound_search_symbol({ name: "*Service*", kind: "class" })

// Find methods in a specific repo
hound_search_symbol({ name: "handle*", kind: "method", repo: "owner/backend" })

// Find Python functions
hound_search_symbol({ name: "*", kind: "function", language: "python", limit: 100 })
\`\`\`

## Response Format

Each result includes:
- \`name\` - Symbol name
- \`kind\` - Symbol type (function, class, etc.)
- \`file\` - File path
- \`line\` - Line number
- \`repo\` - Repository name
- \`language\` - Programming language
- \`signature\` - Full signature (when available)
- \`link\` - Deep link to source (Gitea/GitHub)

## When to Use

✅ Use \`hound_search_symbol\` for:
- "Where is function X defined?"
- "Find all classes implementing pattern Y"
- "List all interfaces in the codebase"
- Finding definitions, not usages

❌ Use \`hound_search\` instead for:
- Finding function calls/usages
- Searching in comments or strings
- Non-code files
- Languages not supported by symbol search
`,

  context: `# hound_file_context - File Context

Retrieves extended code context around a specific line with deep links.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| \`repo\` | string | **Yes** | - | Repository (e.g., "owner/repo") |
| \`file\` | string | **Yes** | - | File path (e.g., "src/index.ts") |
| \`line\` | number | **Yes** | - | Center line number |
| \`context\` | number | No | \`10\` | Lines before/after (max 50) |

## Examples

\`\`\`javascript
// Get context around line 42
hound_file_context({
  repo: "owner/backend",
  file: "src/auth/jwt.ts",
  line: 42,
  context: 15
})

// Minimal context
hound_file_context({
  repo: "owner/api",
  file: "handlers/user.go",
  line: 100,
  context: 5
})
\`\`\`

## Response Includes

- **Code block** with line numbers
- **Highlighted center line**
- **Deep link** to Gitea/GitHub at exact line
- **File metadata** (repository, branch)

## Common Workflow

1. Search finds a match: \`hound_search({ query: "validateToken" })\`
2. Results show file and line
3. Get more context: \`hound_file_context({ repo, file, line })\`
4. Use deep link to view in browser

## Configuration Required

This tool requires either:
- \`GITEA_URL\` + \`GITEA_TOKEN\` for Gitea repositories
- \`GITHUB_URL\` + \`GITHUB_TOKEN\` for GitHub repositories

Without configuration, the tool returns an error with setup instructions.
`,

  repos: `# hound_repos - List Repositories

Lists all repositories indexed by the Hound server.

## Parameters

None required.

## Example

\`\`\`javascript
hound_repos()
\`\`\`

## Response Includes

For each repository:
- \`name\` - Repository identifier (e.g., "owner/repo")
- \`url\` - Clone URL
- \`vcs\` - Version control system (usually "git")

## Use Cases

- Discover available repositories before searching
- Verify a repository is indexed
- Get exact repository names for filtering

## Troubleshooting

**No repositories found:**
- Check if Hound server is running
- Verify Hound has finished initial indexing
- Check Hound server logs for errors
`,

  stats: `# hound_repo_stats - Repository Statistics

Get detailed statistics about indexed repositories.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| \`repo\` | string | No | \`*\` | Repository name or \`*\` for all |

## Examples

\`\`\`javascript
// All repositories summary
hound_repo_stats()

// Specific repository details
hound_repo_stats({ repo: "owner/backend" })
\`\`\`

## Response Includes

- **File counts** - Total files per repository
- **Line counts** - Approximate lines of code
- **Language breakdown** - Files by language with percentages
- **Aggregate totals** - When querying all repos

## Use Cases

- Understand codebase size and composition
- Identify primary languages
- Compare repository sizes
- Audit indexed content
`,

  tips: `# Usage Tips & Best Practices

## Search Strategy

1. **Start broad, then narrow:**
   \`\`\`javascript
   // Too specific - might miss variations
   hound_search({ query: "validateUserJWT" })

   // Better - find all validation patterns
   hound_search({ query: "validate.*JWT|verifyJWT" })
   \`\`\`

2. **Use symbol search for definitions:**
   \`\`\`javascript
   // Less precise - matches calls too
   hound_search({ query: "function handleRequest" })

   // Better - finds only definitions
   hound_search_symbol({ name: "handleRequest", kind: "function" })
   \`\`\`

3. **Filter by file type for speed:**
   \`\`\`javascript
   hound_search({ query: "TODO", files: "*.ts" })  // Faster
   hound_search({ query: "TODO" })  // Searches everything
   \`\`\`

## Symbol Search Tips

- Use wildcards liberally: \`*Controller*\` finds variations
- Filter by kind to reduce noise
- Symbol search is indexed - it's fast even with wildcards

## Pagination Best Practices

- Use reasonable limits (20-50) for interactive searches
- Store \`nextOffset\` from response for "show more"
- Large codebases may have thousands of matches

## Error Recovery

**"No matches found":**
- Try broader regex patterns
- Remove file filters
- Use \`ignore_case: true\`
- Check \`hound_repos()\` for available repos

**"Search timed out":**
- Add file filter: \`files: "*.ts"\`
- Limit to specific repos
- Simplify regex pattern

**"Symbol search returns empty":**
- Check if language is supported
- Verify repo is indexed (check logs)
- Try broader wildcard pattern

## Performance Considerations

| Operation | Speed | Notes |
|-----------|-------|-------|
| \`hound_search\` | Fast | Hound is optimized for regex |
| \`hound_search_symbol\` | Fast | Uses pre-built index |
| \`hound_file_context\` | Medium | Requires API call to git provider |
| \`hound_repo_stats\` | Varies | Depends on repo count |

## Supported Languages (Symbol Search)

| Language | Extensions | Symbol Types |
|----------|------------|--------------|
| TypeScript | .ts, .tsx | function, class, method, interface, type |
| JavaScript | .js, .jsx, .mjs | function, class, method |
| Python | .py | function, class, method, variable |
| Go | .go | function, method, type |
| Rust | .rs | function, struct, impl, trait |
| Solidity | .sol | function, contract, event |
| C# | .cs | class, method, interface |
`,
};

/**
 * Full documentation (all sections)
 */
function getFullDocs(): string {
  return [
    DOCS.overview,
    '---\n',
    DOCS.search,
    '---\n',
    DOCS.symbols,
    '---\n',
    DOCS.context,
    '---\n',
    DOCS.repos,
    '---\n',
    DOCS.stats,
    '---\n',
    DOCS.tips,
  ].join('\n');
}

/**
 * Execute hound_help tool
 */
export async function houndHelp(args: unknown) {
  // Validate input
  const parsed = HelpInputSchema.safeParse(args);
  if (!parsed.success) {
    const validTopics = ['overview', 'search', 'symbols', 'context', 'repos', 'stats', 'tips'];
    return {
      content: [
        {
          type: 'text',
          text: `Invalid topic. Valid topics: ${validTopics.join(', ')}\n\nOr omit topic for full documentation.`,
        },
      ],
      isError: true,
    };
  }

  const { topic } = parsed.data;

  let output: string;
  if (topic) {
    output = DOCS[topic] || `Unknown topic: ${topic}`;
  } else {
    output = getFullDocs();
  }

  return {
    content: [
      {
        type: 'text',
        text: output,
      },
    ],
  };
}
