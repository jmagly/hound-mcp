/**
 * Gitea API Client
 *
 * Fetches repository files for symbol indexing.
 */

/**
 * Gitea API error
 */
export class GiteaError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'GiteaError';
  }
}

/**
 * Gitea file content response
 */
interface GiteaFileContent {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
  size: number;
  content?: string;
  encoding?: string;
}

/**
 * Gitea tree entry
 */
interface GiteaTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

/**
 * Gitea tree response
 */
interface GiteaTreeResponse {
  sha: string;
  tree: GiteaTreeEntry[];
  truncated: boolean;
}

/**
 * File content result
 */
export interface FileContent {
  path: string;
  content: string;
}

/**
 * Supported file extensions for symbol indexing
 */
const SUPPORTED_EXTENSIONS = [
  // TypeScript/JavaScript
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  // Python
  '.py', '.pyw',
  // Go
  '.go',
  // Rust
  '.rs',
  // Solidity
  '.sol',
  // C#
  '.cs',
  // F#
  '.fs', '.fsx', '.fsi',
  // Vue
  '.vue',
  // Shell
  '.sh', '.bash', '.zsh',
];

/**
 * Gitea API Client
 */
export class GiteaClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeout: number;

  constructor(config?: { baseUrl?: string; token?: string; timeout?: number }) {
    this.baseUrl = config?.baseUrl || process.env.GITEA_URL || '';
    this.token = config?.token || process.env.GITEA_TOKEN || '';
    this.timeout = config?.timeout || 30000;
  }

  /**
   * Check if Gitea is configured
   */
  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.token);
  }

  /**
   * Fetch all source files from a repository
   */
  async getRepoFiles(
    owner: string,
    repo: string,
    branch = 'main'
  ): Promise<FileContent[]> {
    if (!this.isConfigured()) {
      throw new GiteaError('Gitea not configured (GITEA_URL and GITEA_TOKEN required)');
    }

    const files: FileContent[] = [];

    // Get the tree for the entire repo
    const treeUrl = `${this.baseUrl}/api/v1/repos/${owner}/${repo}/git/trees/${branch}?recursive=true`;
    const treeResponse = await this.fetch(treeUrl);
    const tree = (await treeResponse.json()) as GiteaTreeResponse;

    // Filter to supported file types
    const sourceFiles = tree.tree.filter(
      (entry) =>
        entry.type === 'blob' &&
        SUPPORTED_EXTENSIONS.some((ext) => entry.path.toLowerCase().endsWith(ext))
    );

    console.error(`[gitea] Found ${sourceFiles.length} source files in ${owner}/${repo}`);

    // Fetch content for each file (in parallel with limits)
    const BATCH_SIZE = 10;
    for (let i = 0; i < sourceFiles.length; i += BATCH_SIZE) {
      const batch = sourceFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (entry) => {
          try {
            const content = await this.getFileContent(owner, repo, entry.path, branch);
            return { path: entry.path, content };
          } catch (err) {
            console.error(`[gitea] Failed to fetch ${entry.path}: ${err}`);
            return null;
          }
        })
      );

      for (const result of results) {
        if (result) {
          files.push(result);
        }
      }
    }

    return files;
  }

  /**
   * Fetch a single file's content
   */
  async getFileContent(
    owner: string,
    repo: string,
    filePath: string,
    ref = 'main'
  ): Promise<string> {
    const url = `${this.baseUrl}/api/v1/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${ref}`;
    const response = await this.fetch(url);
    const data = (await response.json()) as GiteaFileContent;

    if (data.encoding === 'base64' && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return data.content || '';
  }

  /**
   * Internal fetch wrapper
   */
  private async fetch(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `token ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new GiteaError(
          `Gitea API returned ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      return response;
    } catch (error) {
      if (error instanceof GiteaError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new GiteaError(`Request timed out after ${this.timeout}ms`);
      }

      throw new GiteaError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Default client instance
 */
export const giteaClient = new GiteaClient();
