/**
 * Tests for hound_search_symbol tool
 */

import { describe, it, expect, vi } from 'vitest';
import { houndSearchSymbol } from './symbols.js';

// Mock the symbol index for testing
vi.mock('../indexer/index.js', () => {
  return {
    SymbolIndex: class MockSymbolIndex {
      private symbols: Array<{
        name: string;
        kind: string;
        line: number;
        endLine: number;
        column: number;
        file: string;
        repo: string;
        signature?: string;
        scope?: string;
        language: string;
        url?: string;
      }> = [];

      async initialize() {
        // Mock initialization
        this.symbols = [
          {
            name: 'parseConfig',
            kind: 'function',
            line: 10,
            endLine: 25,
            column: 0,
            file: 'src/config.ts',
            repo: 'owner/repo',
            signature: 'function parseConfig(path: string): Config',
            language: 'typescript',
            url: 'https://git.example.com/owner/repo/src/branch/main/src/config.ts#L10',
          },
          {
            name: 'UserService',
            kind: 'class',
            line: 5,
            endLine: 100,
            column: 0,
            file: 'src/services/user.ts',
            repo: 'owner/repo',
            signature: 'class UserService',
            language: 'typescript',
            url: 'https://git.example.com/owner/repo/src/branch/main/src/services/user.ts#L5',
          },
          {
            name: 'getUser',
            kind: 'method',
            line: 15,
            endLine: 30,
            column: 2,
            file: 'src/services/user.ts',
            repo: 'owner/repo',
            signature: 'async getUser(id: string): Promise<User>',
            scope: 'UserService',
            language: 'typescript',
            url: 'https://git.example.com/owner/repo/src/branch/main/src/services/user.ts#L15',
          },
          {
            name: 'handle_request',
            kind: 'function',
            line: 1,
            endLine: 20,
            column: 0,
            file: 'handler.py',
            repo: 'owner/python-repo',
            signature: 'def handle_request(request)',
            language: 'python',
          },
        ];
      }

      search(options: { name: string; kind?: string; repos?: string; language?: string; limit?: number }) {
        const { name, kind, repos, language, limit = 20 } = options;

        // Build name regex
        const namePattern = name
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        const nameRegex = new RegExp(`^${namePattern}$`, 'i');

        // Filter repos
        const repoFilter = repos ? repos.split(',').map((r) => r.trim().toLowerCase()) : null;

        const matches = this.symbols.filter((symbol) => {
          if (!nameRegex.test(symbol.name)) return false;
          if (kind && symbol.kind !== kind) return false;
          if (repoFilter && !repoFilter.some((r) => symbol.repo.toLowerCase().includes(r))) return false;
          if (language && symbol.language !== language.toLowerCase()) return false;
          return true;
        });

        return {
          results: matches.slice(0, limit),
          totalMatches: matches.length,
          reposSearched: new Set(this.symbols.map((s) => s.repo)).size,
        };
      }

      getStats() {
        return {
          totalSymbols: this.symbols.length,
          totalRepos: new Set(this.symbols.map((s) => s.repo)).size,
          repos: [],
        };
      }
    },
    getLanguageFromExtension: (ext: string) => {
      const map: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.py': 'python',
        '.go': 'go',
      };
      return map[ext.toLowerCase()] || null;
    },
  };
});

describe('houndSearchSymbol', () => {
  describe('input validation', () => {
    it('should reject empty name', async () => {
      const result = await houndSearchSymbol({ name: '' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid input');
    });

    it('should reject invalid kind', async () => {
      const result = await houndSearchSymbol({ name: 'test', kind: 'invalid' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid input');
    });

    it('should reject invalid language', async () => {
      const result = await houndSearchSymbol({ name: 'test', language: 'ruby' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid input');
    });

    it('should reject limit over 100', async () => {
      const result = await houndSearchSymbol({ name: 'test', limit: 101 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid input');
    });

    it('should accept valid input', async () => {
      const result = await houndSearchSymbol({ name: 'parseConfig' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('parseConfig');
    });
  });

  describe('search functionality', () => {
    it('should find symbols by exact name', async () => {
      const result = await houndSearchSymbol({ name: 'parseConfig' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('parseConfig');
      expect(result.content[0].text).toContain('function');
    });

    it('should support wildcard search with *', async () => {
      const result = await houndSearchSymbol({ name: 'parse*' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('parseConfig');
    });

    it('should support wildcard search with ?', async () => {
      const result = await houndSearchSymbol({ name: 'getUse?' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('getUser');
    });

    it('should filter by kind', async () => {
      const result = await houndSearchSymbol({ name: '*', kind: 'class' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('UserService');
      expect(result.content[0].text).not.toContain('parseConfig');
    });

    it('should filter by language', async () => {
      const result = await houndSearchSymbol({ name: '*', language: 'python' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('handle_request');
      expect(result.content[0].text).not.toContain('parseConfig');
    });

    it('should filter by repos', async () => {
      const result = await houndSearchSymbol({ name: '*', repos: 'python-repo' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('handle_request');
      expect(result.content[0].text).not.toContain('parseConfig');
    });

    it('should show no results message when nothing found', async () => {
      const result = await houndSearchSymbol({ name: 'nonexistent' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('No symbols found');
      expect(result.content[0].text).toContain('wildcards');
    });
  });

  describe('result formatting', () => {
    it('should include symbol kind badge', async () => {
      const result = await houndSearchSymbol({ name: 'parseConfig' });
      expect(result.content[0].text).toContain('`function`');
    });

    it('should include file location', async () => {
      const result = await houndSearchSymbol({ name: 'parseConfig' });
      expect(result.content[0].text).toContain('src/config.ts:10');
    });

    it('should include signature when available', async () => {
      const result = await houndSearchSymbol({ name: 'parseConfig' });
      expect(result.content[0].text).toContain('parseConfig(path: string)');
    });

    it('should include scope for methods', async () => {
      const result = await houndSearchSymbol({ name: 'getUser' });
      expect(result.content[0].text).toContain('UserService.getUser');
    });

    it('should group results by repository', async () => {
      const result = await houndSearchSymbol({ name: '*' });
      expect(result.content[0].text).toContain('### owner/repo');
      expect(result.content[0].text).toContain('### owner/python-repo');
    });
  });
});
