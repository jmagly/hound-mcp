/**
 * Symbol indexer types for tree-sitter based symbol extraction
 */

/**
 * Supported symbol types for indexing
 */
export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'interface'
  | 'type'
  | 'variable'
  | 'constant'
  | 'module';

/**
 * A code symbol extracted from source
 */
export interface Symbol {
  /** Symbol name (e.g., "parseConfig") */
  name: string;

  /** Symbol type */
  kind: SymbolKind;

  /** Starting line number (1-indexed) */
  line: number;

  /** Ending line number (1-indexed) */
  endLine: number;

  /** Column offset (0-indexed) */
  column: number;

  /** File path relative to repo root */
  file: string;

  /** Repository name (e.g., "owner/repo") */
  repo: string;

  /** Function/method signature if available */
  signature?: string;

  /** Parent scope (class name for methods, module for top-level) */
  scope?: string;

  /** Language of the source file */
  language: string;

  /** Direct URL to this symbol in Gitea/GitHub */
  url?: string;
}

/**
 * Search options for symbol search
 */
export interface SymbolSearchOptions {
  /** Symbol name pattern (supports wildcards: * for any, ? for single char) */
  name: string;

  /** Filter by symbol kind */
  kind?: SymbolKind;

  /** Filter by repository */
  repos?: string;

  /** Filter by language */
  language?: string;

  /** Max results to return (default: 20) */
  limit?: number;
}

/**
 * Symbol search results
 */
export interface SymbolSearchResult {
  /** Matching symbols */
  results: Symbol[];

  /** Total matches found */
  totalMatches: number;

  /** Number of repositories searched */
  reposSearched: number;
}

/**
 * Supported languages for symbol extraction
 */
export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'solidity'
  | 'csharp'
  | 'fsharp'
  | 'vue'
  | 'bash';

/**
 * Language configuration for parsing
 */
export interface LanguageConfig {
  /** File extensions for this language */
  extensions: string[];

  /** Language name for tree-sitter */
  grammarName: string;

  /** WASM file name */
  wasmFile: string;
}

/**
 * Language configurations
 */
export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  typescript: {
    extensions: ['.ts', '.tsx'],
    grammarName: 'typescript',
    wasmFile: 'tree-sitter-typescript.wasm',
  },
  javascript: {
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    grammarName: 'javascript',
    wasmFile: 'tree-sitter-javascript.wasm',
  },
  python: {
    extensions: ['.py', '.pyw'],
    grammarName: 'python',
    wasmFile: 'tree-sitter-python.wasm',
  },
  go: {
    extensions: ['.go'],
    grammarName: 'go',
    wasmFile: 'tree-sitter-go.wasm',
  },
  rust: {
    extensions: ['.rs'],
    grammarName: 'rust',
    wasmFile: 'tree-sitter-rust.wasm',
  },
  solidity: {
    extensions: ['.sol'],
    grammarName: 'solidity',
    wasmFile: 'tree-sitter-solidity.wasm',
  },
  csharp: {
    extensions: ['.cs'],
    grammarName: 'c_sharp',
    wasmFile: 'tree-sitter-c-sharp.wasm',
  },
  fsharp: {
    extensions: ['.fs', '.fsx', '.fsi'],
    grammarName: 'fsharp',
    wasmFile: 'tree-sitter-fsharp.wasm',
  },
  vue: {
    extensions: ['.vue'],
    grammarName: 'vue',
    wasmFile: 'tree-sitter-vue.wasm',
  },
  bash: {
    extensions: ['.sh', '.bash', '.zsh'],
    grammarName: 'bash',
    wasmFile: 'tree-sitter-bash.wasm',
  },
};

/**
 * Get language from file extension
 */
export function getLanguageFromExtension(ext: string): SupportedLanguage | null {
  for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
    if (config.extensions.includes(ext.toLowerCase())) {
      return lang as SupportedLanguage;
    }
  }
  return null;
}
