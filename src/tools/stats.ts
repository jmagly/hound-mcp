/**
 * hound_repo_stats MCP Tool
 *
 * Get repository statistics including file counts, line counts, and language breakdown.
 */

import { z } from 'zod';
import { houndClient, HoundError } from '../clients/hound.js';

/**
 * Input schema for hound_repo_stats tool
 */
export const houndRepoStatsSchema = {
  type: 'object' as const,
  properties: {
    repo: {
      type: 'string',
      description:
        'Repository name (e.g., "roctinam/sysops") or "*" for all repos (default: "*")',
    },
  },
  required: [],
};

/**
 * Zod schema for runtime validation
 */
const StatsInputSchema = z.object({
  repo: z.string().optional().default('*'),
});

/**
 * Format number with commas for readability
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Execute hound_repo_stats tool
 */
export async function houndRepoStats(args: unknown) {
  // Validate input
  const parsed = StatsInputSchema.safeParse(args);
  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    return {
      content: [
        {
          type: 'text',
          text: `Invalid input: ${errors}\n\nUsage: hound_repo_stats({ repo?: "owner/repo" | "*" })`,
        },
      ],
      isError: true,
    };
  }

  const { repo } = parsed.data;

  try {
    const result = await houndClient.getRepoStats({ repo });

    let output = '';

    if (result.repos.length === 0) {
      output = 'No repositories found.\n\n';
      output += 'Check:\n';
      output += '- Is the Hound server indexing any repositories?\n';
      output += '- Run `hound_repos()` to see available repositories';
      return {
        content: [{ type: 'text', text: output }],
      };
    }

    // Summary header
    if (repo === '*') {
      output += `## Repository Statistics\n\n`;
      output += `**${result.totalRepos} repositories** indexed with `;
      output += `**${formatNumber(result.totalFiles)} files** and `;
      output += `**~${formatNumber(result.totalLines)} lines** of code.\n\n`;
    }

    // Per-repo stats
    for (const stats of result.repos) {
      if (repo !== '*') {
        // Single repo - detailed view
        output += `## ${stats.repo}\n\n`;
      } else {
        // Multi-repo - compact view
        output += `### ${stats.repo}\n`;
      }

      output += `- **Files:** ${formatNumber(stats.totalFiles)}\n`;
      output += `- **Lines:** ~${formatNumber(stats.totalLines)}\n`;

      // Language breakdown (sorted by file count)
      const sortedLangs = Object.entries(stats.languages)
        .sort(([, a], [, b]) => b.files - a.files)
        .slice(0, 10); // Top 10 languages

      if (sortedLangs.length > 0) {
        output += '- **Languages:**\n';
        for (const [lang, langStats] of sortedLangs) {
          const pct = ((langStats.files / stats.totalFiles) * 100).toFixed(1);
          output += `  - ${lang}: ${langStats.files} files (${pct}%)\n`;
        }

        // Show "other" count if more than 10 languages
        const totalLangs = Object.keys(stats.languages).length;
        if (totalLangs > 10) {
          output += `  - _...and ${totalLangs - 10} more languages_\n`;
        }
      }

      output += '\n';
    }

    // Note about line count approximation
    output += `---\n`;
    output += `_Note: Line counts are approximations based on indexed content._`;

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  } catch (error) {
    if (error instanceof HoundError) {
      let message = error.message;
      let hint = '';

      if (error.code === 'TIMEOUT') {
        message = 'Statistics query timed out.';
        hint =
          '\n\nTry:\n- Querying a specific repository: repo: "owner/repo"\n- The server may have too many repositories indexed.';
      } else if (error.code === 'NETWORK') {
        const url = process.env.HOUND_URL || 'http://localhost:6080';
        message = `Cannot reach Hound server at ${url}.`;
        hint =
          '\n\nCheck:\n- Is the Hound server running?\n- Is HOUND_URL environment variable correct?';
      } else if (error.code === 'API_ERROR') {
        hint =
          '\n\nThe Hound server returned an error. Check server logs for details.';
      }

      return {
        content: [{ type: 'text', text: `Error: ${message}${hint}` }],
        isError: true,
      };
    }
    throw error;
  }
}
