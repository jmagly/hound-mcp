/**
 * Tests for hound_help tool
 */

import { describe, it, expect } from 'vitest';
import { houndHelp, houndHelpSchema } from './help.js';

describe('houndHelp', () => {
  describe('schema', () => {
    it('should have optional topic parameter', () => {
      expect(houndHelpSchema.properties.topic).toBeDefined();
      expect(houndHelpSchema.required).toEqual([]);
    });
  });

  describe('without topic', () => {
    it('should return full documentation', async () => {
      const result = await houndHelp({});

      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text;

      // Should contain all major sections
      expect(text).toContain('# CodeHound MCP - Overview');
      expect(text).toContain('# hound_search - Text Search');
      expect(text).toContain('# hound_search_symbol - Symbol Search');
      expect(text).toContain('# hound_file_context - File Context');
      expect(text).toContain('# hound_repos - List Repositories');
      expect(text).toContain('# hound_repo_stats - Repository Statistics');
      expect(text).toContain('# Usage Tips & Best Practices');
    });
  });

  describe('with topic', () => {
    it('should return overview documentation', async () => {
      const result = await houndHelp({ topic: 'overview' });

      expect(result.content[0].text).toContain('# CodeHound MCP - Overview');
      expect(result.content[0].text).toContain('Available Tools');
      expect(result.content[0].text).not.toContain('# hound_search - Text Search');
    });

    it('should return search documentation', async () => {
      const result = await houndHelp({ topic: 'search' });

      expect(result.content[0].text).toContain('# hound_search - Text Search');
      expect(result.content[0].text).toContain('Regex Tips');
      expect(result.content[0].text).toContain('Pagination');
    });

    it('should return symbols documentation', async () => {
      const result = await houndHelp({ topic: 'symbols' });

      expect(result.content[0].text).toContain('# hound_search_symbol - Symbol Search');
      expect(result.content[0].text).toContain('Wildcard Patterns');
      expect(result.content[0].text).toContain('Symbol Kinds');
    });

    it('should return context documentation', async () => {
      const result = await houndHelp({ topic: 'context' });

      expect(result.content[0].text).toContain('# hound_file_context - File Context');
      expect(result.content[0].text).toContain('Common Workflow');
    });

    it('should return repos documentation', async () => {
      const result = await houndHelp({ topic: 'repos' });

      expect(result.content[0].text).toContain('# hound_repos - List Repositories');
      expect(result.content[0].text).toContain('Troubleshooting');
    });

    it('should return stats documentation', async () => {
      const result = await houndHelp({ topic: 'stats' });

      expect(result.content[0].text).toContain('# hound_repo_stats - Repository Statistics');
      expect(result.content[0].text).toContain('Language breakdown');
    });

    it('should return tips documentation', async () => {
      const result = await houndHelp({ topic: 'tips' });

      expect(result.content[0].text).toContain('# Usage Tips & Best Practices');
      expect(result.content[0].text).toContain('Search Strategy');
      expect(result.content[0].text).toContain('Performance Considerations');
      expect(result.content[0].text).toContain('Supported Languages');
    });
  });

  describe('error handling', () => {
    it('should reject invalid topic', async () => {
      const result = await houndHelp({ topic: 'invalid' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid topic');
      expect(result.content[0].text).toContain('Valid topics');
    });
  });

  describe('documentation quality', () => {
    it('should include examples in search docs', async () => {
      const result = await houndHelp({ topic: 'search' });

      expect(result.content[0].text).toContain('hound_search({');
      expect(result.content[0].text).toContain('query:');
    });

    it('should include examples in symbols docs', async () => {
      const result = await houndHelp({ topic: 'symbols' });

      expect(result.content[0].text).toContain('hound_search_symbol({');
      expect(result.content[0].text).toContain('name:');
    });

    it('should include parameter tables', async () => {
      const result = await houndHelp({ topic: 'search' });

      expect(result.content[0].text).toContain('| Parameter |');
      expect(result.content[0].text).toContain('| `query`');
    });

    it('should document all supported languages', async () => {
      const result = await houndHelp({ topic: 'tips' });
      const text = result.content[0].text;

      expect(text).toContain('TypeScript');
      expect(text).toContain('JavaScript');
      expect(text).toContain('Python');
      expect(text).toContain('Go');
      expect(text).toContain('Rust');
      expect(text).toContain('Solidity');
      expect(text).toContain('C#');
    });
  });
});
