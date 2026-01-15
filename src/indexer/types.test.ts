/**
 * Tests for symbol indexer types
 */

import { describe, it, expect } from 'vitest';
import { getLanguageFromExtension, LANGUAGE_CONFIGS } from './types.js';

describe('getLanguageFromExtension', () => {
  it('should return typescript for .ts files', () => {
    expect(getLanguageFromExtension('.ts')).toBe('typescript');
  });

  it('should return typescript for .tsx files', () => {
    expect(getLanguageFromExtension('.tsx')).toBe('typescript');
  });

  it('should return javascript for .js files', () => {
    expect(getLanguageFromExtension('.js')).toBe('javascript');
  });

  it('should return javascript for .jsx files', () => {
    expect(getLanguageFromExtension('.jsx')).toBe('javascript');
  });

  it('should return javascript for .mjs files', () => {
    expect(getLanguageFromExtension('.mjs')).toBe('javascript');
  });

  it('should return python for .py files', () => {
    expect(getLanguageFromExtension('.py')).toBe('python');
  });

  it('should return go for .go files', () => {
    expect(getLanguageFromExtension('.go')).toBe('go');
  });

  it('should return null for unsupported extensions', () => {
    expect(getLanguageFromExtension('.txt')).toBeNull();
    expect(getLanguageFromExtension('.md')).toBeNull();
    expect(getLanguageFromExtension('.json')).toBeNull();
  });

  it('should be case insensitive', () => {
    expect(getLanguageFromExtension('.TS')).toBe('typescript');
    expect(getLanguageFromExtension('.Py')).toBe('python');
  });
});

describe('LANGUAGE_CONFIGS', () => {
  it('should have config for typescript', () => {
    expect(LANGUAGE_CONFIGS.typescript).toBeDefined();
    expect(LANGUAGE_CONFIGS.typescript.extensions).toContain('.ts');
    expect(LANGUAGE_CONFIGS.typescript.extensions).toContain('.tsx');
    expect(LANGUAGE_CONFIGS.typescript.wasmFile).toBe('tree-sitter-typescript.wasm');
  });

  it('should have config for javascript', () => {
    expect(LANGUAGE_CONFIGS.javascript).toBeDefined();
    expect(LANGUAGE_CONFIGS.javascript.extensions).toContain('.js');
    expect(LANGUAGE_CONFIGS.javascript.extensions).toContain('.jsx');
  });

  it('should have config for python', () => {
    expect(LANGUAGE_CONFIGS.python).toBeDefined();
    expect(LANGUAGE_CONFIGS.python.extensions).toContain('.py');
  });

  it('should have config for go', () => {
    expect(LANGUAGE_CONFIGS.go).toBeDefined();
    expect(LANGUAGE_CONFIGS.go.extensions).toContain('.go');
  });
});
