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

  it('should return rust for .rs files', () => {
    expect(getLanguageFromExtension('.rs')).toBe('rust');
  });

  it('should return solidity for .sol files', () => {
    expect(getLanguageFromExtension('.sol')).toBe('solidity');
  });

  it('should return csharp for .cs files', () => {
    expect(getLanguageFromExtension('.cs')).toBe('csharp');
  });

  it('should return fsharp for .fs files', () => {
    expect(getLanguageFromExtension('.fs')).toBe('fsharp');
  });

  it('should return vue for .vue files', () => {
    expect(getLanguageFromExtension('.vue')).toBe('vue');
  });

  it('should return bash for .sh files', () => {
    expect(getLanguageFromExtension('.sh')).toBe('bash');
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

  it('should have config for rust', () => {
    expect(LANGUAGE_CONFIGS.rust).toBeDefined();
    expect(LANGUAGE_CONFIGS.rust.extensions).toContain('.rs');
  });

  it('should have config for solidity', () => {
    expect(LANGUAGE_CONFIGS.solidity).toBeDefined();
    expect(LANGUAGE_CONFIGS.solidity.extensions).toContain('.sol');
  });

  it('should have config for csharp', () => {
    expect(LANGUAGE_CONFIGS.csharp).toBeDefined();
    expect(LANGUAGE_CONFIGS.csharp.extensions).toContain('.cs');
  });

  it('should have config for fsharp', () => {
    expect(LANGUAGE_CONFIGS.fsharp).toBeDefined();
    expect(LANGUAGE_CONFIGS.fsharp.extensions).toContain('.fs');
  });

  it('should have config for vue', () => {
    expect(LANGUAGE_CONFIGS.vue).toBeDefined();
    expect(LANGUAGE_CONFIGS.vue.extensions).toContain('.vue');
  });

  it('should have config for bash', () => {
    expect(LANGUAGE_CONFIGS.bash).toBeDefined();
    expect(LANGUAGE_CONFIGS.bash.extensions).toContain('.sh');
  });
});
