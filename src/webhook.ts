/**
 * Gitea Webhook Handler
 *
 * Handles Gitea webhook events to auto-sync Hound index when repos are created/deleted,
 * and auto-index symbols when code is pushed.
 */

import { execSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { giteaClient } from './clients/gitea.js';
import { getSymbolIndex } from './tools/symbols.js';

/**
 * Configuration from environment
 */
const WEBHOOK_SECRET = process.env.HOUND_WEBHOOK_SECRET || '';
const HOUND_CONFIG_DIR = process.env.HOUND_CONFIG_DIR || '';
const GITEA_TOKEN = process.env.GITEA_TOKEN || '';

/**
 * Gitea webhook payload (simplified)
 */
interface GiteaWebhookPayload {
  action?: string; // 'created', 'deleted' for repository events
  ref?: string; // refs/heads/main for push events
  repository?: {
    full_name: string;
    name: string;
    default_branch?: string;
    owner: {
      login: string;
    };
  };
}

/**
 * Webhook response
 */
export interface WebhookResponse {
  success: boolean;
  message: string;
  action?: string;
}

/**
 * Verify Gitea webhook signature
 */
function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!WEBHOOK_SECRET) {
    // No secret configured, skip verification
    return true;
  }

  if (!signature) {
    return false;
  }

  const expected = createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  return signature === expected || signature === `sha256=${expected}`;
}

/**
 * Index a repository's symbols
 */
async function indexRepoSymbols(repoName: string, branch: string): Promise<{ success: boolean; message: string }> {
  try {
    console.error(`[webhook] Indexing symbols for ${repoName}...`);

    if (!giteaClient.isConfigured()) {
      console.error('[webhook] Gitea not configured, skipping symbol indexing');
      return { success: true, message: 'Skipped (Gitea not configured)' };
    }

    const [owner, repo] = repoName.split('/');
    if (!owner || !repo) {
      return { success: false, message: `Invalid repo name: ${repoName}` };
    }

    // Fetch files from Gitea
    const files = await giteaClient.getRepoFiles(owner, repo, branch);

    if (files.length === 0) {
      console.error(`[webhook] No source files found in ${repoName}`);
      return { success: true, message: 'No source files to index' };
    }

    // Index files
    const index = getSymbolIndex();
    await index.initialize();
    const result = await index.indexRepo(repoName, files);

    console.error(`[webhook] Indexed ${result.symbols} symbols from ${result.files} files in ${repoName}`);
    return { success: true, message: `Indexed ${result.symbols} symbols from ${result.files} files` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[webhook] Failed to index ${repoName}: ${message}`);
    return { success: false, message: `Failed to index: ${message}` };
  }
}

/**
 * Regenerate Hound config from Gitea repos
 */
function regenerateConfig(): { success: boolean; message: string } {
  try {
    console.error('[webhook] Regenerating Hound config...');

    // Run generate-config.sh
    const env = { ...process.env, GITEA_TOKEN };
    execSync('./generate-config.sh config.json', {
      cwd: HOUND_CONFIG_DIR,
      env,
      stdio: 'pipe',
      timeout: 30000,
    });

    console.error('[webhook] Config regenerated, restarting Hound...');

    // Restart Hound container
    execSync('sudo docker compose restart hound', {
      cwd: HOUND_CONFIG_DIR,
      stdio: 'pipe',
      timeout: 60000,
    });

    console.error('[webhook] Hound restarted successfully');
    return { success: true, message: 'Hound index updated' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[webhook] Failed to update Hound: ${message}`);
    return { success: false, message: `Failed to update Hound: ${message}` };
  }
}

/**
 * Handle Gitea webhook request
 */
export async function handleGiteaWebhook(
  eventType: string | undefined,
  signature: string | undefined,
  payload: string
): Promise<WebhookResponse> {
  // Verify signature if configured
  if (!verifySignature(payload, signature)) {
    console.error('[webhook] Invalid signature');
    return { success: false, message: 'Invalid signature' };
  }

  // Parse payload
  let data: GiteaWebhookPayload;
  try {
    data = JSON.parse(payload);
  } catch {
    console.error('[webhook] Invalid JSON payload');
    return { success: false, message: 'Invalid JSON payload' };
  }

  console.error(`[webhook] Received event: ${eventType}, action: ${data.action}`);

  // Handle repository events
  if (eventType === 'repository') {
    const repoName = data.repository?.full_name || 'unknown';

    if (data.action === 'created') {
      console.error(`[webhook] New repo created: ${repoName}`);
      const result = regenerateConfig();
      return { ...result, action: `indexed new repo: ${repoName}` };
    }

    if (data.action === 'deleted') {
      console.error(`[webhook] Repo deleted: ${repoName}`);
      const result = regenerateConfig();
      return { ...result, action: `removed deleted repo: ${repoName}` };
    }
  }

  // Handle push events - re-index symbols for the repository
  if (eventType === 'push') {
    const repoName = data.repository?.full_name || 'unknown';
    const branch = data.ref?.replace('refs/heads/', '') || data.repository?.default_branch || 'main';

    // Only index pushes to main/master branch
    if (branch === 'main' || branch === 'master') {
      console.error(`[webhook] Push to ${repoName}:${branch}, re-indexing symbols...`);
      const result = await indexRepoSymbols(repoName, branch);
      return { ...result, action: `re-indexed symbols for ${repoName}` };
    } else {
      console.error(`[webhook] Push to ${repoName}:${branch}, skipping (not main branch)`);
      return {
        success: true,
        message: 'Skipped non-main branch',
        action: `skipped ${repoName}:${branch}`,
      };
    }
  }

  // Ignore other events
  return {
    success: true,
    message: 'Event ignored',
    action: `ignored ${eventType || 'unknown'} event`,
  };
}

/**
 * Manually trigger Hound sync (for admin use)
 */
export function triggerSync(): WebhookResponse {
  console.error('[webhook] Manual sync triggered');
  const result = regenerateConfig();
  return { ...result, action: 'manual sync' };
}
