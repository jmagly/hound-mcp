/**
 * hound_repo_stats tool unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { houndRepoStats, houndRepoStatsSchema } from './stats.js';
import { HoundError } from '../clients/hound.js';

// Mock the hound client
vi.mock('../clients/hound.js', async () => {
  const HoundError = class extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly statusCode?: number
    ) {
      super(message);
      this.name = 'HoundError';
    }
  };

  return {
    HoundError,
    houndClient: {
      getRepoStats: vi.fn(),
    },
  };
});

import { houndClient } from '../clients/hound.js';

describe('houndRepoStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('result formatting', () => {
    it('should format multi-repo statistics', async () => {
      vi.mocked(houndClient.getRepoStats).mockResolvedValueOnce({
        totalRepos: 2,
        totalFiles: 150,
        totalLines: 8500,
        repos: [
          {
            repo: 'roctinam/devops',
            totalFiles: 100,
            totalLines: 5000,
            languages: {
              TypeScript: { files: 60, lines: 3000 },
              JavaScript: { files: 20, lines: 1000 },
              Markdown: { files: 20, lines: 1000 },
            },
          },
          {
            repo: 'roctinam/sysops',
            totalFiles: 50,
            totalLines: 3500,
            languages: {
              Shell: { files: 30, lines: 2000 },
              YAML: { files: 20, lines: 1500 },
            },
          },
        ],
      });

      const result = await houndRepoStats({});

      expect(result.content[0].text).toContain('2 repositories');
      expect(result.content[0].text).toContain('150 files');
      expect(result.content[0].text).toContain('8,500 lines');
      expect(result.content[0].text).toContain('roctinam/devops');
      expect(result.content[0].text).toContain('roctinam/sysops');
      expect(result.content[0].text).toContain('TypeScript');
      expect(result.content[0].text).toContain('Shell');
    });

    it('should format single-repo statistics', async () => {
      vi.mocked(houndClient.getRepoStats).mockResolvedValueOnce({
        totalRepos: 1,
        totalFiles: 100,
        totalLines: 5000,
        repos: [
          {
            repo: 'roctinam/devops',
            totalFiles: 100,
            totalLines: 5000,
            languages: {
              TypeScript: { files: 60, lines: 3000 },
              JavaScript: { files: 20, lines: 1000 },
              Markdown: { files: 20, lines: 1000 },
            },
          },
        ],
      });

      const result = await houndRepoStats({ repo: 'roctinam/devops' });

      expect(result.content[0].text).toContain('roctinam/devops');
      expect(result.content[0].text).toContain('100');
      expect(result.content[0].text).toContain('TypeScript');
    });

    it('should show empty message when no repos', async () => {
      vi.mocked(houndClient.getRepoStats).mockResolvedValueOnce({
        totalRepos: 0,
        totalFiles: 0,
        totalLines: 0,
        repos: [],
      });

      const result = await houndRepoStats({});

      expect(result.content[0].text).toContain('No repositories found');
      expect(result.content[0].text).toContain('hound_repos()');
    });

    it('should show language percentages', async () => {
      vi.mocked(houndClient.getRepoStats).mockResolvedValueOnce({
        totalRepos: 1,
        totalFiles: 100,
        totalLines: 5000,
        repos: [
          {
            repo: 'test/repo',
            totalFiles: 100,
            totalLines: 5000,
            languages: {
              TypeScript: { files: 60, lines: 3000 },
              JavaScript: { files: 40, lines: 2000 },
            },
          },
        ],
      });

      const result = await houndRepoStats({ repo: 'test/repo' });

      expect(result.content[0].text).toContain('TypeScript: 60 files (60.0%)');
      expect(result.content[0].text).toContain('JavaScript: 40 files (40.0%)');
    });

    it('should truncate to top 10 languages', async () => {
      const languages: Record<string, { files: number; lines: number }> = {};
      for (let i = 0; i < 15; i++) {
        languages[`Language${i}`] = { files: 10, lines: 100 };
      }

      vi.mocked(houndClient.getRepoStats).mockResolvedValueOnce({
        totalRepos: 1,
        totalFiles: 150,
        totalLines: 1500,
        repos: [
          {
            repo: 'test/repo',
            totalFiles: 150,
            totalLines: 1500,
            languages,
          },
        ],
      });

      const result = await houndRepoStats({ repo: 'test/repo' });

      expect(result.content[0].text).toContain('...and 5 more languages');
    });

    it('should include approximation note', async () => {
      vi.mocked(houndClient.getRepoStats).mockResolvedValueOnce({
        totalRepos: 1,
        totalFiles: 10,
        totalLines: 500,
        repos: [
          {
            repo: 'test/repo',
            totalFiles: 10,
            totalLines: 500,
            languages: { TypeScript: { files: 10, lines: 500 } },
          },
        ],
      });

      const result = await houndRepoStats({});

      expect(result.content[0].text).toContain('approximations');
    });
  });

  describe('input validation', () => {
    it('should accept empty args', async () => {
      vi.mocked(houndClient.getRepoStats).mockResolvedValueOnce({
        totalRepos: 0,
        totalFiles: 0,
        totalLines: 0,
        repos: [],
      });

      const result = await houndRepoStats({});

      expect(result.isError).toBeUndefined();
    });

    it('should accept "*" for all repos', async () => {
      vi.mocked(houndClient.getRepoStats).mockResolvedValueOnce({
        totalRepos: 0,
        totalFiles: 0,
        totalLines: 0,
        repos: [],
      });

      await houndRepoStats({ repo: '*' });

      expect(houndClient.getRepoStats).toHaveBeenCalledWith({ repo: '*' });
    });

    it('should pass specific repo to client', async () => {
      vi.mocked(houndClient.getRepoStats).mockResolvedValueOnce({
        totalRepos: 0,
        totalFiles: 0,
        totalLines: 0,
        repos: [],
      });

      await houndRepoStats({ repo: 'owner/repo' });

      expect(houndClient.getRepoStats).toHaveBeenCalledWith({ repo: 'owner/repo' });
    });
  });

  describe('error handling', () => {
    it('should handle timeout error', async () => {
      vi.mocked(houndClient.getRepoStats).mockRejectedValueOnce(
        new HoundError('Timed out', 'TIMEOUT')
      );

      const result = await houndRepoStats({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('timed out');
      expect(result.content[0].text).toContain('specific repository');
    });

    it('should handle network error', async () => {
      vi.mocked(houndClient.getRepoStats).mockRejectedValueOnce(
        new HoundError('Network failed', 'NETWORK')
      );

      const result = await houndRepoStats({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Cannot reach Hound server');
    });

    it('should handle API error', async () => {
      vi.mocked(houndClient.getRepoStats).mockRejectedValueOnce(
        new HoundError('Server error', 'API_ERROR', 500)
      );

      const result = await houndRepoStats({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Server error');
    });

    it('should rethrow non-HoundError exceptions', async () => {
      vi.mocked(houndClient.getRepoStats).mockRejectedValueOnce(new Error('Unknown'));

      await expect(houndRepoStats({})).rejects.toThrow('Unknown');
    });
  });
});

describe('houndRepoStatsSchema', () => {
  it('should have no required properties', () => {
    expect(houndRepoStatsSchema.required).toEqual([]);
  });

  it('should have repo property', () => {
    expect(houndRepoStatsSchema.properties.repo).toBeDefined();
    expect(houndRepoStatsSchema.properties.repo.type).toBe('string');
  });
});
