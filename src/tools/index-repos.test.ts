/**
 * Tests for hound_index_repos tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { houndIndexRepos } from './index-repos.js';

// Mock the gitea client
vi.mock('../clients/gitea.js', () => ({
  giteaClient: {
    isConfigured: vi.fn(),
    getRepoFiles: vi.fn(),
  },
}));

// Mock the hound client
vi.mock('../clients/hound.js', () => ({
  houndClient: {
    listRepos: vi.fn(),
  },
}));

// Create mock index instance
const mockSymbolIndex = {
  initialize: vi.fn().mockResolvedValue(undefined),
  indexRepo: vi.fn().mockResolvedValue({ files: 5, symbols: 25 }),
};

// Mock the symbol index
vi.mock('./symbols.js', () => ({
  getSymbolIndex: vi.fn(() => mockSymbolIndex),
}));

import { giteaClient } from '../clients/gitea.js';
import { houndClient } from '../clients/hound.js';

describe('houndIndexRepos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSymbolIndex.initialize.mockResolvedValue(undefined);
    mockSymbolIndex.indexRepo.mockResolvedValue({ files: 5, symbols: 25 });
  });

  describe('configuration check', () => {
    it('should return error when Gitea is not configured', async () => {
      vi.mocked(giteaClient.isConfigured).mockReturnValue(false);

      const result = await houndIndexRepos({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Configuration Required');
    });
  });

  describe('with configured Gitea', () => {
    beforeEach(() => {
      vi.mocked(giteaClient.isConfigured).mockReturnValue(true);
    });

    it('should index specified repos', async () => {
      vi.mocked(giteaClient.getRepoFiles).mockResolvedValue([
        { path: 'src/main.ts', content: 'export const main = () => {}' },
      ]);

      const result = await houndIndexRepos({ repos: 'owner/repo1' });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Symbol Indexing Complete');
      expect(result.content[0].text).toContain('owner/repo1');
    });

    it('should list repos from Hound when no repos specified', async () => {
      vi.mocked(houndClient.listRepos).mockResolvedValue({
        count: 2,
        repos: [
          { name: 'owner/repo1', key: 'owner-repo1', vcs: 'git', url: '' },
          { name: 'owner/repo2', key: 'owner-repo2', vcs: 'git', url: '' },
        ],
      });
      vi.mocked(giteaClient.getRepoFiles).mockResolvedValue([
        { path: 'src/main.ts', content: 'const x = 1;' },
      ]);

      const result = await houndIndexRepos({});

      expect(houndClient.listRepos).toHaveBeenCalled();
      expect(result.content[0].text).toContain('2 repos indexed');
    });

    it('should handle indexing errors gracefully', async () => {
      vi.mocked(giteaClient.getRepoFiles).mockRejectedValue(new Error('Network error'));

      const result = await houndIndexRepos({ repos: 'owner/repo' });

      expect(result.content[0].text).toContain('Failed Repositories');
      expect(result.content[0].text).toContain('Network error');
    });

    it('should handle invalid repo name format', async () => {
      const result = await houndIndexRepos({ repos: 'invalid-name' });

      expect(result.content[0].text).toContain('Failed Repositories');
      expect(result.content[0].text).toContain('Invalid repo name format');
    });

    it('should show summary with totals', async () => {
      vi.mocked(giteaClient.getRepoFiles).mockResolvedValue([
        { path: 'src/main.ts', content: 'const x = 1;' },
      ]);

      const result = await houndIndexRepos({ repos: 'owner/repo' });

      expect(result.content[0].text).toContain('files');
      expect(result.content[0].text).toContain('symbols');
    });
  });

  describe('input validation', () => {
    it('should accept empty input', async () => {
      vi.mocked(giteaClient.isConfigured).mockReturnValue(false);

      const result = await houndIndexRepos({});

      // Should fail on configuration, not validation
      expect(result.content[0].text).toContain('Configuration Required');
    });

    it('should accept branch parameter', async () => {
      vi.mocked(giteaClient.isConfigured).mockReturnValue(true);
      vi.mocked(giteaClient.getRepoFiles).mockResolvedValue([]);

      await houndIndexRepos({ repos: 'owner/repo', branch: 'develop' });

      expect(giteaClient.getRepoFiles).toHaveBeenCalledWith('owner', 'repo', 'develop');
    });
  });
});
