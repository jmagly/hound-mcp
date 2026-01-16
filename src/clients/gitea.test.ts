/**
 * Tests for Gitea API client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GiteaClient, GiteaError } from './gitea.js';

describe('GiteaClient', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('isConfigured', () => {
    it('should return false when not configured', () => {
      const client = new GiteaClient({ baseUrl: '', token: '' });
      expect(client.isConfigured()).toBe(false);
    });

    it('should return true when configured', () => {
      const client = new GiteaClient({ baseUrl: 'https://git.example.com', token: 'test-token' });
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe('getFileContent', () => {
    it('should decode base64 content', async () => {
      const client = new GiteaClient({ baseUrl: 'https://git.example.com', token: 'test-token' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: Buffer.from('const x = 1;').toString('base64'),
          encoding: 'base64',
        }),
      });

      const result = await client.getFileContent('owner', 'repo', 'test.ts');
      expect(result).toBe('const x = 1;');
    });

    it('should throw GiteaError on API failure', async () => {
      const client = new GiteaClient({ baseUrl: 'https://git.example.com', token: 'test-token' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(client.getFileContent('owner', 'repo', 'missing.ts'))
        .rejects.toThrow(GiteaError);
    });
  });

  describe('getRepoFiles', () => {
    it('should throw when not configured', async () => {
      const client = new GiteaClient({ baseUrl: '', token: '' });

      await expect(client.getRepoFiles('owner', 'repo'))
        .rejects.toThrow('Gitea not configured');
    });

    it('should filter to supported file types', async () => {
      const client = new GiteaClient({ baseUrl: 'https://git.example.com', token: 'test-token' });

      // Mock tree response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: 'abc123',
          tree: [
            { path: 'src/main.ts', type: 'blob' },
            { path: 'src/utils.js', type: 'blob' },
            { path: 'README.md', type: 'blob' },
            { path: 'package.json', type: 'blob' },
            { path: 'src', type: 'tree' },
          ],
          truncated: false,
        }),
      });

      // Mock file content responses
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: Buffer.from('export const main = () => {}').toString('base64'),
          encoding: 'base64',
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: Buffer.from('export const utils = {}').toString('base64'),
          encoding: 'base64',
        }),
      });

      const files = await client.getRepoFiles('owner', 'repo', 'main');

      // Should only have .ts and .js files, not .md or .json
      expect(files).toHaveLength(2);
      expect(files.find(f => f.path === 'src/main.ts')).toBeDefined();
      expect(files.find(f => f.path === 'src/utils.js')).toBeDefined();
    });
  });
});

describe('GiteaError', () => {
  it('should have correct name', () => {
    const error = new GiteaError('Test error', 404);
    expect(error.name).toBe('GiteaError');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(404);
  });
});
