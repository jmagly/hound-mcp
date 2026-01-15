/**
 * Shared TypeScript interfaces for CodeHound MCP
 */

// ============================================================================
// Hound API Types
// ============================================================================

/**
 * Hound API raw search response structure
 */
export interface HoundRawSearchResponse {
  Results: {
    [repoKey: string]: {
      Matches: Array<{
        Filename: string;
        Matches: Array<{
          LineNumber: number;
          Line: string;
          Before: string[];
          After: string[];
        }>;
      }>;
    };
  };
}

/**
 * Hound API repos response structure
 */
export interface HoundRawReposResponse {
  [repoKey: string]: {
    url: string;
    vcs: string;
  };
}

// ============================================================================
// Transformed Types (what MCP tools return)
// ============================================================================

/**
 * Search options for hound_search tool
 */
export interface SearchOptions {
  query: string;
  repos?: string;
  files?: string;
  ignoreCase?: boolean;
  /** Number of results to return (default: 20, max: 100) */
  limit?: number;
  /** Number of results to skip for pagination (default: 0) */
  offset?: number;
}

/**
 * Single search match result
 */
export interface SearchMatch {
  repo: string;
  file: string;
  line: number;
  content: string;
  url: string;
}

/**
 * Search results returned by hound_search tool
 */
export interface SearchResult {
  totalMatches: number;
  reposSearched: number;
  results: SearchMatch[];
  /** Pagination: number of results returned */
  count: number;
  /** Pagination: offset used for this request */
  offset: number;
  /** Pagination: whether more results are available */
  hasMore: boolean;
  /** Pagination: offset to use for next page (null if no more) */
  nextOffset: number | null;
}

/**
 * Repository info returned by hound_repos tool
 */
export interface RepoInfo {
  name: string;
  key: string;
  vcs: string;
  url: string;
}

/**
 * Repos list returned by hound_repos tool
 */
export interface ReposResult {
  count: number;
  repos: RepoInfo[];
}

/**
 * File context options for hound_file_context tool
 */
export interface FileContextOptions {
  repo: string;
  file: string;
  line: number;
  context?: number;
}

/**
 * File context returned by hound_file_context tool
 */
export interface FileContextResult {
  repo: string;
  file: string;
  startLine: number;
  endLine: number;
  content: string;
  url: string;
}

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * Hound client configuration
 */
export interface HoundClientConfig {
  baseUrl: string;
  timeout: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for HoundError
 */
export type HoundErrorCode = 'TIMEOUT' | 'NETWORK' | 'API_ERROR' | 'PARSE_ERROR';

// ============================================================================
// Repository Statistics Types
// ============================================================================

/**
 * Language statistics for a repository
 */
export interface LanguageStats {
  files: number;
  lines: number;
}

/**
 * Statistics for a single repository
 */
export interface RepoStats {
  repo: string;
  totalFiles: number;
  totalLines: number;
  languages: { [language: string]: LanguageStats };
}

/**
 * Repository statistics options
 */
export interface RepoStatsOptions {
  repo?: string;
}

/**
 * Repository statistics result
 */
export interface RepoStatsResult {
  repos: RepoStats[];
  totalRepos: number;
  totalFiles: number;
  totalLines: number;
}

// ============================================================================
// Symbol Search Types
// ============================================================================

/**
 * Supported symbol types
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
 * Symbol search options
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
 * A symbol found in code
 */
export interface SymbolMatch {
  repo: string;
  file: string;
  line: number;
  kind: SymbolKind;
  name: string;
  signature?: string;
  scope?: string;
  language: string;
  url: string;
}

/**
 * Symbol search results
 */
export interface SymbolSearchResult {
  results: SymbolMatch[];
  totalMatches: number;
  reposSearched: number;
}
