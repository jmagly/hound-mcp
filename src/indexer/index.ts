/**
 * Symbol Index Manager
 *
 * Manages the symbol index using in-memory storage with optional JSON persistence.
 * Integrates with Hound to index symbols from repositories.
 */

import { promises as fs } from 'node:fs';
import { extname } from 'node:path';
import { extractSymbols, preloadGrammars, getLanguageFromExtension } from './parser.js';
import type { Symbol, SymbolSearchOptions, SymbolSearchResult, SymbolKind } from './types.js';

/**
 * Symbol index configuration
 */
export interface SymbolIndexConfig {
  /** Path to persist index (optional) */
  persistPath?: string;

  /** Gitea/GitHub base URL for deep links */
  baseUrl?: string;

  /** Whether to auto-save after updates */
  autoSave?: boolean;
}

/**
 * Symbol index storage format
 */
interface SymbolIndexData {
  version: number;
  updatedAt: string;
  symbols: Symbol[];
  repoStats: Record<string, { files: number; symbols: number; updatedAt: string }>;
}

/**
 * Symbol Index Manager class
 */
export class SymbolIndex {
  private symbols: Symbol[] = [];
  private repoStats: Map<string, { files: number; symbols: number; updatedAt: string }> = new Map();
  private config: SymbolIndexConfig;
  private initialized = false;

  constructor(config: SymbolIndexConfig = {}) {
    this.config = config;
  }

  /**
   * Initialize the index (load from disk if available)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Preload grammars
    await preloadGrammars();

    // Load persisted index if available
    if (this.config.persistPath) {
      await this.load();
    }

    this.initialized = true;
  }

  /**
   * Load index from disk
   */
  async load(): Promise<void> {
    if (!this.config.persistPath) return;

    try {
      const data = await fs.readFile(this.config.persistPath, 'utf-8');
      const parsed: SymbolIndexData = JSON.parse(data);

      if (parsed.version !== 1) {
        console.error('[symbol-index] Incompatible index version, rebuilding...');
        return;
      }

      this.symbols = parsed.symbols;
      this.repoStats = new Map(Object.entries(parsed.repoStats));
      console.error(`[symbol-index] Loaded ${this.symbols.length} symbols from ${this.repoStats.size} repos`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[symbol-index] Error loading index: ${err}`);
      }
    }
  }

  /**
   * Save index to disk
   */
  async save(): Promise<void> {
    if (!this.config.persistPath) return;

    const data: SymbolIndexData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      symbols: this.symbols,
      repoStats: Object.fromEntries(this.repoStats),
    };

    await fs.writeFile(this.config.persistPath, JSON.stringify(data, null, 2));
    console.error(`[symbol-index] Saved ${this.symbols.length} symbols`);
  }

  /**
   * Index a file and add its symbols
   */
  async indexFile(sourceCode: string, filePath: string, repo: string): Promise<number> {
    const symbols = await extractSymbols(sourceCode, filePath, repo, this.config.baseUrl);

    // Remove existing symbols for this file
    this.symbols = this.symbols.filter((s) => !(s.repo === repo && s.file === filePath));

    // Add new symbols
    this.symbols.push(...symbols);

    return symbols.length;
  }

  /**
   * Index multiple files from a repository
   */
  async indexRepo(
    repo: string,
    files: Array<{ path: string; content: string }>
  ): Promise<{ files: number; symbols: number }> {
    let totalSymbols = 0;
    let indexedFiles = 0;

    // Remove existing symbols for this repo
    this.symbols = this.symbols.filter((s) => s.repo !== repo);

    for (const file of files) {
      const ext = extname(file.path);
      if (!getLanguageFromExtension(ext)) continue;

      try {
        const count = await this.indexFile(file.content, file.path, repo);
        totalSymbols += count;
        indexedFiles++;
      } catch (err) {
        console.error(`[symbol-index] Error indexing ${file.path}: ${err}`);
      }
    }

    // Update repo stats
    this.repoStats.set(repo, {
      files: indexedFiles,
      symbols: totalSymbols,
      updatedAt: new Date().toISOString(),
    });

    // Auto-save if configured
    if (this.config.autoSave) {
      await this.save();
    }

    return { files: indexedFiles, symbols: totalSymbols };
  }

  /**
   * Remove a repository from the index
   */
  removeRepo(repo: string): void {
    this.symbols = this.symbols.filter((s) => s.repo !== repo);
    this.repoStats.delete(repo);
  }

  /**
   * Search for symbols
   */
  search(options: SymbolSearchOptions): SymbolSearchResult {
    const { name, kind, repos, language, limit = 20 } = options;

    // Build name regex from pattern (supports * and ? wildcards)
    const namePattern = name
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex chars except * and ?
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const nameRegex = new RegExp(`^${namePattern}$`, 'i');

    // Filter repos if specified
    const repoFilter = repos ? repos.split(',').map((r) => r.trim().toLowerCase()) : null;

    // Count repos searched
    const searchedRepos = new Set<string>();

    // Filter symbols
    const matches = this.symbols.filter((symbol) => {
      searchedRepos.add(symbol.repo);

      // Name match
      if (!nameRegex.test(symbol.name)) return false;

      // Kind filter
      if (kind && symbol.kind !== kind) return false;

      // Repo filter
      if (repoFilter && !repoFilter.some((r) => symbol.repo.toLowerCase().includes(r))) return false;

      // Language filter
      if (language && symbol.language !== language.toLowerCase()) return false;

      return true;
    });

    // Sort by relevance (exact match first, then alphabetically)
    matches.sort((a, b) => {
      const aExact = a.name.toLowerCase() === name.toLowerCase();
      const bExact = b.name.toLowerCase() === name.toLowerCase();
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      results: matches.slice(0, limit),
      totalMatches: matches.length,
      reposSearched: searchedRepos.size,
    };
  }

  /**
   * Get a specific symbol by name and location
   */
  getSymbol(repo: string, file: string, line: number): Symbol | undefined {
    return this.symbols.find((s) => s.repo === repo && s.file === file && s.line <= line && s.endLine >= line);
  }

  /**
   * Get all symbols in a file
   */
  getFileSymbols(repo: string, file: string): Symbol[] {
    return this.symbols.filter((s) => s.repo === repo && s.file === file);
  }

  /**
   * Get index statistics
   */
  getStats(): { totalSymbols: number; totalRepos: number; repos: Array<{ repo: string; symbols: number }> } {
    const repoSymbolCounts = new Map<string, number>();
    for (const symbol of this.symbols) {
      repoSymbolCounts.set(symbol.repo, (repoSymbolCounts.get(symbol.repo) || 0) + 1);
    }

    return {
      totalSymbols: this.symbols.length,
      totalRepos: repoSymbolCounts.size,
      repos: Array.from(repoSymbolCounts.entries()).map(([repo, symbols]) => ({ repo, symbols })),
    };
  }

  /**
   * Clear all indexed data
   */
  clear(): void {
    this.symbols = [];
    this.repoStats.clear();
  }
}

// Re-export types
export type { Symbol, SymbolSearchOptions, SymbolSearchResult, SymbolKind };
export { getLanguageFromExtension } from './parser.js';
