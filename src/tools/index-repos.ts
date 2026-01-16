/**
 * hound_index_repos tool - Index repositories for symbol search
 *
 * Fetches source files from Gitea and indexes them for symbol search.
 */

import { z } from 'zod';
import { giteaClient } from '../clients/gitea.js';
import { houndClient } from '../clients/hound.js';
import { getSymbolIndex } from './symbols.js';

/**
 * Input schema for hound_index_repos
 */
export const houndIndexReposSchema = {
  type: 'object',
  properties: {
    repos: {
      type: 'string',
      description:
        'Comma-separated repository names to index (e.g., "owner/repo1,owner/repo2"). If omitted, indexes all repos from Hound.',
    },
    branch: {
      type: 'string',
      description: 'Git branch to index (default: main)',
    },
  },
  required: [],
};

/**
 * Zod schema for input validation
 */
const inputSchema = z.object({
  repos: z.string().optional(),
  branch: z.string().optional(),
});

/**
 * Index result for a single repo
 */
interface RepoIndexResult {
  repo: string;
  success: boolean;
  files?: number;
  symbols?: number;
  error?: string;
}

/**
 * Parse repo name into owner and repo parts
 */
function parseRepoName(name: string): { owner: string; repo: string } | null {
  const parts = name.trim().split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
}

/**
 * Index a single repository
 */
async function indexSingleRepo(
  repoName: string,
  branch: string
): Promise<RepoIndexResult> {
  const parsed = parseRepoName(repoName);
  if (!parsed) {
    return {
      repo: repoName,
      success: false,
      error: `Invalid repo name format (expected owner/repo): ${repoName}`,
    };
  }

  try {
    console.error(`[index] Indexing ${repoName}...`);

    // Fetch files from Gitea
    const files = await giteaClient.getRepoFiles(parsed.owner, parsed.repo, branch);

    if (files.length === 0) {
      return {
        repo: repoName,
        success: true,
        files: 0,
        symbols: 0,
      };
    }

    // Index files
    const index = getSymbolIndex();
    await index.initialize();
    const result = await index.indexRepo(repoName, files);

    console.error(`[index] Indexed ${result.symbols} symbols from ${result.files} files in ${repoName}`);

    return {
      repo: repoName,
      success: true,
      files: result.files,
      symbols: result.symbols,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[index] Failed to index ${repoName}: ${message}`);
    return {
      repo: repoName,
      success: false,
      error: message,
    };
  }
}

/**
 * Format results as markdown
 */
function formatResults(results: RepoIndexResult[]): string {
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const totalFiles = successful.reduce((sum, r) => sum + (r.files || 0), 0);
  const totalSymbols = successful.reduce((sum, r) => sum + (r.symbols || 0), 0);

  const lines: string[] = [
    `## Symbol Indexing Complete`,
    '',
    `**Summary:** ${successful.length} repos indexed, ${failed.length} failed`,
    `**Total:** ${totalFiles} files, ${totalSymbols} symbols`,
    '',
  ];

  if (successful.length > 0) {
    lines.push('### Indexed Repositories');
    lines.push('');
    lines.push('| Repository | Files | Symbols |');
    lines.push('|------------|-------|---------|');
    for (const r of successful) {
      lines.push(`| ${r.repo} | ${r.files} | ${r.symbols} |`);
    }
    lines.push('');
  }

  if (failed.length > 0) {
    lines.push('### Failed Repositories');
    lines.push('');
    for (const r of failed) {
      lines.push(`- **${r.repo}**: ${r.error}`);
    }
    lines.push('');
  }

  lines.push('*Use `hound_search_symbol` to search indexed symbols.*');

  return lines.join('\n');
}

/**
 * hound_index_repos tool handler
 */
export async function houndIndexRepos(
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

  const { repos, branch = 'main' } = parseResult.data;

  // Check if Gitea is configured
  if (!giteaClient.isConfigured()) {
    return {
      content: [
        {
          type: 'text',
          text: `## Configuration Required

Symbol indexing requires Gitea API access. Please set:

- \`GITEA_URL\`: Your Gitea server URL (e.g., https://git.example.com)
- \`GITEA_TOKEN\`: Your Gitea API token

These can be set in your environment or MCP configuration.`,
        },
      ],
      isError: true,
    };
  }

  try {
    let repoList: string[];

    if (repos) {
      // Use specified repos
      repoList = repos.split(',').map((r) => r.trim()).filter(Boolean);
    } else {
      // Get all repos from Hound
      const houndRepos = await houndClient.listRepos();
      repoList = houndRepos.repos.map((r) => r.name);
    }

    if (repoList.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `## No Repositories Found

No repositories to index. Either:
- Specify repos: \`hound_index_repos({ repos: "owner/repo1,owner/repo2" })\`
- Ensure Hound has indexed repositories`,
          },
        ],
      };
    }

    // Index repos sequentially to avoid overwhelming the API
    const results: RepoIndexResult[] = [];
    for (const repo of repoList) {
      const result = await indexSingleRepo(repo, branch);
      results.push(result);
    }

    const text = formatResults(results);

    return {
      content: [{ type: 'text', text }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error indexing repositories: ${message}` }],
      isError: true,
    };
  }
}
