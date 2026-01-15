/**
 * hound_search_symbol tool - Symbol-aware code search using tree-sitter
 *
 * Provides AST-based symbol search for finding functions, classes, methods,
 * interfaces, and types across indexed repositories.
 */

import { z } from 'zod';
import { SymbolIndex, type Symbol } from '../indexer/index.js';
import type { SymbolMatch, SymbolSearchResult, SymbolKind } from '../types.js';

/**
 * Singleton symbol index instance
 */
let symbolIndex: SymbolIndex | null = null;

/**
 * Get or create the symbol index
 */
export function getSymbolIndex(): SymbolIndex {
  if (!symbolIndex) {
    const baseUrl = process.env.GITEA_URL || process.env.GITHUB_URL;
    symbolIndex = new SymbolIndex({
      baseUrl,
      autoSave: false, // Don't auto-save for now
    });
  }
  return symbolIndex;
}

/**
 * Initialize the symbol index (call at startup)
 */
export async function initSymbolIndex(): Promise<void> {
  const index = getSymbolIndex();
  await index.initialize();
}

/**
 * Symbol kinds enum for Zod validation
 */
const SymbolKindSchema = z.enum([
  'function',
  'class',
  'method',
  'interface',
  'type',
  'variable',
  'constant',
  'module',
]);

/**
 * Input schema for hound_search_symbol
 */
export const houndSearchSymbolSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description:
        'Symbol name pattern to search for. Supports wildcards: * for any characters, ? for single character. Examples: "parse*", "User*Service", "handle?"',
    },
    kind: {
      type: 'string',
      enum: ['function', 'class', 'method', 'interface', 'type', 'variable', 'constant', 'module'],
      description: 'Filter by symbol kind (optional)',
    },
    repos: {
      type: 'string',
      description: 'Comma-separated repository names to search (optional, searches all if omitted)',
    },
    language: {
      type: 'string',
      enum: ['typescript', 'javascript', 'python', 'go'],
      description: 'Filter by programming language (optional)',
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results to return (default: 20, max: 100)',
    },
  },
  required: ['name'],
};

/**
 * Zod schema for input validation
 */
const inputSchema = z.object({
  name: z.string().min(1),
  kind: SymbolKindSchema.optional(),
  repos: z.string().optional(),
  language: z.enum(['typescript', 'javascript', 'python', 'go']).optional(),
  limit: z.number().min(1).max(100).optional(),
});

/**
 * Convert internal Symbol to MCP SymbolMatch
 */
function toSymbolMatch(symbol: Symbol): SymbolMatch {
  return {
    repo: symbol.repo,
    file: symbol.file,
    line: symbol.line,
    kind: symbol.kind,
    name: symbol.name,
    signature: symbol.signature,
    scope: symbol.scope,
    language: symbol.language,
    url: symbol.url || '',
  };
}

/**
 * Format results as markdown for display
 */
function formatResults(result: SymbolSearchResult, name: string): string {
  if (result.totalMatches === 0) {
    return `## No symbols found matching "${name}"

Try:
- Using wildcards: \`${name}*\` or \`*${name}*\`
- Removing the kind filter
- Checking if repositories are indexed
- Using hound_repos() to see available repositories

**Note:** Symbol indexing happens on first access. If this is a new repository, try indexing it first.`;
  }

  const lines: string[] = [
    `## Found ${result.totalMatches} symbol${result.totalMatches > 1 ? 's' : ''} matching "${name}"`,
    `Searched ${result.reposSearched} repositories`,
    '',
  ];

  // Group by repository
  const byRepo = new Map<string, SymbolMatch[]>();
  for (const match of result.results) {
    const existing = byRepo.get(match.repo) || [];
    existing.push(match);
    byRepo.set(match.repo, existing);
  }

  for (const [repo, matches] of byRepo) {
    lines.push(`### ${repo}`);
    lines.push('');

    for (const match of matches) {
      const kindBadge = `\`${match.kind}\``;
      const scopePrefix = match.scope ? `${match.scope}.` : '';
      const signature = match.signature ? ` - \`${match.signature}\`` : '';
      const link = match.url ? ` [→](${match.url})` : '';

      lines.push(`- ${kindBadge} **${scopePrefix}${match.name}** (${match.file}:${match.line})${signature}${link}`);
    }

    lines.push('');
  }

  if (result.totalMatches > result.results.length) {
    lines.push(`*Showing ${result.results.length} of ${result.totalMatches} results. Use \`limit\` to see more.*`);
  }

  return lines.join('\n');
}

/**
 * hound_search_symbol tool handler
 */
export async function houndSearchSymbol(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  // Validate input
  const parseResult = inputSchema.safeParse(args);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    return {
      content: [{ type: 'text', text: `Invalid input: ${errors}` }],
      isError: true,
    };
  }

  const { name, kind, repos, language, limit = 20 } = parseResult.data;

  try {
    const index = getSymbolIndex();
    await index.initialize();

    const searchResult = index.search({
      name,
      kind: kind as SymbolKind | undefined,
      repos,
      language,
      limit,
    });

    // Convert to MCP format
    const result: SymbolSearchResult = {
      results: searchResult.results.map(toSymbolMatch),
      totalMatches: searchResult.totalMatches,
      reposSearched: searchResult.reposSearched,
    };

    const text = formatResults(result, name);

    return {
      content: [{ type: 'text', text }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error searching symbols: ${message}` }],
      isError: true,
    };
  }
}

/**
 * Index a repository's files (called by webhook or manual sync)
 */
export async function indexRepository(
  repo: string,
  files: Array<{ path: string; content: string }>
): Promise<{ files: number; symbols: number }> {
  const index = getSymbolIndex();
  await index.initialize();
  return index.indexRepo(repo, files);
}

/**
 * Get symbol index statistics
 */
export function getSymbolIndexStats(): { totalSymbols: number; totalRepos: number } {
  const index = getSymbolIndex();
  const stats = index.getStats();
  return {
    totalSymbols: stats.totalSymbols,
    totalRepos: stats.totalRepos,
  };
}
