#!/usr/bin/env node

/**
 * CodeHound MCP Server
 *
 * Multi-modal code search MCP server: text search (Hound), symbols (tree-sitter),
 * and future semantic search. Supports both stdio and HTTP transport modes.
 * See ADR-001 for architecture decisions.
 */

import { createServer } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { houndSearch, houndSearchSchema } from './tools/search.js';
import { houndRepos, houndReposSchema } from './tools/repos.js';
import { houndFileContext, houndFileContextSchema } from './tools/context.js';
import { houndRepoStats, houndRepoStatsSchema } from './tools/stats.js';
import { houndSearchSymbol, houndSearchSymbolSchema } from './tools/symbols.js';
import { houndIndexRepos, houndIndexReposSchema } from './tools/index-repos.js';
import {
  validateClientCredentials,
  generateAccessToken,
  validateBearerToken,
  registerClient,
  createAuthorizationCode,
  exchangeAuthorizationCode,
  refreshAccessToken,
} from './auth.js';
import { handleGiteaWebhook, triggerSync } from './webhook.js';

/**
 * Parse command line arguments
 */
function parseArgs(): { mode: 'stdio' | 'http'; port: number } {
  const args = process.argv.slice(2);
  let mode: 'stdio' | 'http' = 'stdio';
  let port = parseInt(process.env.MCP_PORT || '3000', 10);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--http') {
      mode = 'http';
    } else if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { mode, port };
}

/**
 * Create and configure the MCP server
 */
function createMcpServer(): Server {
  const mcpServer = new Server(
    {
      name: 'codehound-mcp',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list_tools request
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'hound_search',
          description:
            'Search code across all indexed repositories using regex patterns. Returns matching files and lines with deep links.',
          inputSchema: houndSearchSchema,
        },
        {
          name: 'hound_repos',
          description:
            'List all repositories indexed by Hound code search. Returns repository names and URLs.',
          inputSchema: houndReposSchema,
        },
        {
          name: 'hound_file_context',
          description:
            'Get extended context around a specific line in a file. Useful for understanding code around a search match.',
          inputSchema: houndFileContextSchema,
        },
        {
          name: 'hound_repo_stats',
          description:
            'Get repository statistics including file counts, line counts, and language breakdown.',
          inputSchema: houndRepoStatsSchema,
        },
        {
          name: 'hound_search_symbol',
          description:
            'Search for code symbols (functions, classes, methods, interfaces, types) by name using tree-sitter AST parsing. Supports wildcards (* and ?).',
          inputSchema: houndSearchSymbolSchema,
        },
        {
          name: 'hound_index_repos',
          description:
            'Index repositories for symbol search. Fetches source files from Gitea and extracts symbols using tree-sitter. Run this before using hound_search_symbol to populate the index.',
          inputSchema: houndIndexReposSchema,
        },
      ],
    };
  });

  // Handle call_tool request
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'hound_search':
          return await houndSearch(args);
        case 'hound_repos':
          return await houndRepos();
        case 'hound_file_context':
          return await houndFileContext(args);
        case 'hound_repo_stats':
          return await houndRepoStats(args);
        case 'hound_search_symbol':
          return await houndSearchSymbol(args);
        case 'hound_index_repos':
          return await houndIndexRepos(args);
        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return mcpServer;
}

/**
 * Start the server in stdio mode (for local invocation)
 */
async function startStdioServer() {
  const mcpServer = createMcpServer();
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('CodeHound MCP server started (stdio mode)');
}

/**
 * Read request body as string with size limit
 */
const MAX_BODY_SIZE = 1024 * 1024; // 1MB

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate bearer token from Authorization header
 */
function validateAuth(req: import('node:http').IncomingMessage): { valid: boolean; clientId?: string } {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false };
  }
  const token = authHeader.slice(7);
  return validateBearerToken(token);
}

/**
 * Start the server in HTTP mode (for remote/service mode)
 */
async function startHttpServer(port: number) {
  // Support both StreamableHTTP and SSE transports
  const transports = new Map<string, StreamableHTTPServerTransport | SSEServerTransport>();

  const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '';

  const httpServer = createServer(async (req, res) => {
    // CORS headers for all responses
    const origin = req.headers.origin || '';
    if (allowedOrigin && origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    } else if (!allowedOrigin) {
      // No CORS restriction when not configured (development mode)
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    // If origin doesn't match configured allowedOrigin, no CORS header is set
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Session-Id');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint (no auth required)
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', mode: 'http', port }));
      return;
    }

    // OAuth2 Authorization Server Metadata (RFC 8414)
    if (req.url === '/.well-known/oauth-authorization-server' && req.method === 'GET') {
      const baseUrl = `https://${req.headers.host || `localhost:${port}`}`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        registration_endpoint: `${baseUrl}/oauth/register`,
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
        grant_types_supported: ['client_credentials', 'authorization_code', 'refresh_token'],
        response_types_supported: ['code', 'token'],
        scopes_supported: ['mcp'],
        code_challenge_methods_supported: ['S256'],
        service_documentation: 'https://github.com/jmagly/mcp-hound',
      }));
      return;
    }

    // Protected Resource Metadata (RFC 9728)
    if (req.url === '/.well-known/oauth-protected-resource' && req.method === 'GET') {
      const baseUrl = `https://${req.headers.host || `localhost:${port}`}`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        resource: baseUrl,
        authorization_servers: [baseUrl],
        scopes_supported: ['mcp'],
      }));
      return;
    }

    // OAuth2 Authorization endpoint - show approval page or process approval
    if (req.url?.startsWith('/oauth/authorize')) {
      const url = new URL(req.url, `https://${req.headers.host}`);
      const clientId = url.searchParams.get('client_id');
      const redirectUri = url.searchParams.get('redirect_uri');
      const responseType = url.searchParams.get('response_type');
      const state = url.searchParams.get('state');
      const codeChallenge = url.searchParams.get('code_challenge') || undefined;
      const codeChallengeMethod = url.searchParams.get('code_challenge_method') || undefined;

      // Validate required params
      if (!clientId || !redirectUri || responseType !== 'code') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'invalid_request',
          error_description: 'Missing required parameters: client_id, redirect_uri, response_type=code',
        }));
        return;
      }

      // POST = user clicked approve button
      if (req.method === 'POST') {
        const code = createAuthorizationCode(clientId, redirectUri, codeChallenge, codeChallengeMethod);
        const redirectUrl = new URL(redirectUri);
        redirectUrl.searchParams.set('code', code);
        if (state) {
          redirectUrl.searchParams.set('state', state);
        }
        console.error(`[authorize] approved for client=${clientId}, redirecting`);
        res.writeHead(302, { Location: redirectUrl.toString() });
        res.end();
        return;
      }

      // GET = show authorization page
      if (req.method === 'GET') {
        console.error(`[authorize] showing approval page for client=${clientId}`);
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize CodeHound</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.2);
      max-width: 420px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .logo { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #1a1a2e; font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 24px; }
    .client-info {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
    }
    .client-info strong { color: #333; }
    .client-info code {
      background: #e0e0e0;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      word-break: break-all;
    }
    .permissions {
      text-align: left;
      margin-bottom: 24px;
    }
    .permissions h3 { color: #333; font-size: 14px; margin-bottom: 8px; }
    .permissions ul { list-style: none; }
    .permissions li {
      padding: 8px 0;
      border-bottom: 1px solid #eee;
      color: #555;
    }
    .permissions li:before { content: "✓ "; color: #4CAF50; }
    .buttons { display: flex; gap: 12px; }
    button {
      flex: 1;
      padding: 14px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.1s;
    }
    button:hover { transform: translateY(-1px); }
    .approve {
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(76,175,80,0.3);
    }
    .deny {
      background: #f5f5f5;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🔍</div>
    <h1>Authorize CodeHound</h1>
    <p class="subtitle">Code Search for Claude</p>

    <div class="client-info">
      <strong>Application:</strong><br>
      <code>${escapeHtml(clientId)}</code>
    </div>

    <div class="permissions">
      <h3>This will allow access to:</h3>
      <ul>
        <li>Search code across indexed repositories</li>
        <li>List available repositories</li>
        <li>Read file context around matches</li>
      </ul>
    </div>

    <form method="POST" class="buttons">
      <button type="button" class="deny" onclick="window.close()">Cancel</button>
      <button type="submit" class="approve">Authorize</button>
    </form>
  </div>
</body>
</html>`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }
    }

    // Dynamic Client Registration (RFC 7591)
    if (req.url === '/oauth/register' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const request = JSON.parse(body);
        const response = registerClient(request);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        return;
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_client_metadata' }));
        return;
      }
    }

    // OAuth2 token endpoint
    if (req.url === '/oauth/token' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const contentType = req.headers['content-type'] || '';

        // Parse body based on content type (support both form and JSON)
        let grantType: string | null = null;
        let clientId: string | null = null;
        let clientSecret: string | null = null;
        let code: string | null = null;
        let redirectUri: string | null = null;
        let codeVerifier: string | null = null;
        let refreshTokenParam: string | null = null;

        // Check for HTTP Basic Auth (client_id:client_secret in Authorization header)
        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Basic ')) {
          const base64Credentials = authHeader.slice(6);
          const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
          const [basicClientId, basicClientSecret] = credentials.split(':');
          if (basicClientId) clientId = basicClientId;
          if (basicClientSecret) clientSecret = basicClientSecret;
          console.error(`[token] parsed Basic auth: client_id=${clientId}`);
        }

        if (contentType.includes('application/json')) {
          const json = JSON.parse(body);
          grantType = json.grant_type || null;
          // Body params override Basic auth if present
          if (json.client_id) clientId = json.client_id;
          if (json.client_secret) clientSecret = json.client_secret;
          code = json.code || null;
          redirectUri = json.redirect_uri || null;
          codeVerifier = json.code_verifier || null;
          refreshTokenParam = json.refresh_token || null;
        } else {
          const params = new URLSearchParams(body);
          grantType = params.get('grant_type');
          // Body params override Basic auth if present
          if (params.get('client_id')) clientId = params.get('client_id');
          if (params.get('client_secret')) clientSecret = params.get('client_secret');
          code = params.get('code');
          redirectUri = params.get('redirect_uri');
          codeVerifier = params.get('code_verifier');
          refreshTokenParam = params.get('refresh_token');
        }

        console.error(`[token] grant_type=${grantType} client_id=${clientId} code=${code ? 'present' : 'absent'}`);

        // Handle authorization_code grant
        if (grantType === 'authorization_code') {
          // code and redirect_uri required; client_id optional for public clients using PKCE
          if (!code || !redirectUri) {
            console.error(`[token] auth_code missing params: code=${!!code} redirectUri=${!!redirectUri}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Missing required parameters (code, redirect_uri)' }));
            return;
          }

          const result = exchangeAuthorizationCode(code, clientId, redirectUri, codeVerifier || undefined);
          if ('error' in result) {
            console.error(`[token] auth_code exchange failed: ${result.error}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
          }

          console.error(`[token] auth_code exchange success for ${clientId}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // Handle client_credentials grant
        if (grantType === 'client_credentials') {
          if (!clientId || !clientSecret) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Missing client credentials' }));
            return;
          }

          const validation = validateClientCredentials(clientId, clientSecret);
          if (!validation.valid) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_client' }));
            return;
          }

          const tokenResponse = generateAccessToken(clientId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(tokenResponse));
          return;
        }

        // Handle refresh_token grant
        if (grantType === 'refresh_token') {
          if (!refreshTokenParam) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Missing refresh_token' }));
            return;
          }

          const result = refreshAccessToken(refreshTokenParam);
          if ('error' in result) {
            console.error(`[token] refresh failed: ${result.error}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
          }

          console.error(`[token] refresh success`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unsupported_grant_type' }));
        return;
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'server_error' }));
        return;
      }
    }

    //=========================================================================
    // SSE TRANSPORT (MCP Protocol version 2024-11-05)
    //=========================================================================

    // SSE endpoint - establishes SSE stream
    if ((req.url === '/sse' || req.url === '/') && req.method === 'GET' && req.headers['accept']?.includes('text/event-stream')) {
      const baseUrl = `https://${req.headers.host || `localhost:${port}`}`;
      console.error(`[sse] GET ${req.url} - SSE transport connection`);

      // Validate bearer token
      const auth = validateAuth(req);
      if (!auth.valid) {
        console.error(`[sse] auth failed`);
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer realm="mcp", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }

      console.error(`[sse] auth success, creating SSE transport`);
      const transport = new SSEServerTransport('/messages', res);
      console.error(`[sse] transport created with sessionId: ${transport.sessionId}`);
      transports.set(transport.sessionId, transport);

      res.on('close', () => {
        console.error(`[sse] connection closed for session ${transport.sessionId}`);
        transports.delete(transport.sessionId);
      });

      const mcpServer = createMcpServer();
      await mcpServer.connect(transport);
      console.error(`[sse] MCP server connected for session ${transport.sessionId}`);
      return;
    }

    // Messages endpoint - receives messages for SSE transport
    if (req.url?.startsWith('/messages') && req.method === 'POST') {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const sessionId = urlObj.searchParams.get('sessionId');
      console.error(`[messages] POST with sessionId: ${sessionId}`);

      // Validate bearer token
      const auth = validateAuth(req);
      if (!auth.valid) {
        console.error(`[messages] auth failed`);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }

      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing sessionId parameter' }));
        return;
      }

      const transport = transports.get(sessionId);
      if (!transport || !(transport instanceof SSEServerTransport)) {
        console.error(`[messages] no SSE transport found for session ${sessionId}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No SSE transport found for sessionId' }));
        return;
      }

      const body = await readBody(req);
      const message = JSON.parse(body);
      console.error(`[messages] handling message for session ${sessionId}`);
      await transport.handlePostMessage(req, res, message);
      return;
    }

    //=========================================================================
    // STREAMABLE HTTP TRANSPORT (Protocol version 2025-11-25)
    //=========================================================================

    // MCP endpoint (root path) - requires authentication
    if (req.url === '/' || req.url?.startsWith('/?')) {
      const baseUrl = `https://${req.headers.host || `localhost:${port}`}`;
      console.error(`[mcp] ${req.method} ${req.url}`);

      // Validate bearer token
      const auth = validateAuth(req);
      if (!auth.valid) {
        console.error(`[mcp] auth failed`);
        // RFC 9728 - Return WWW-Authenticate with resource_metadata pointer
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer realm="mcp", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        });
        res.end(JSON.stringify({ error: 'unauthorized', error_description: 'Valid bearer token required' }));
        return;
      }
      console.error(`[mcp] auth success for client=${auth.clientId}`);

      // Get or create session ID from header
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      console.error(`[mcp] sessionId from header: ${sessionId || 'none'}`);

      if (req.method === 'POST') {
        // Handle new connection or message (Streamable HTTP only)
        const existingTransport = sessionId ? transports.get(sessionId) : undefined;
        console.error(`[mcp] POST, existing transport: ${!!existingTransport}`);

        let transport: StreamableHTTPServerTransport;
        if (existingTransport && existingTransport instanceof StreamableHTTPServerTransport) {
          transport = existingTransport;
        } else if (!existingTransport) {
          // Create new transport for this session
          console.error(`[mcp] creating new Streamable HTTP transport`);
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
          });

          const mcpServer = createMcpServer();
          await mcpServer.connect(transport);
          console.error(`[mcp] transport connected (sessionId set after handleRequest)`);

          // Cleanup on close
          transport.onclose = () => {
            console.error(`[mcp] transport closed: ${transport?.sessionId}`);
            if (transport?.sessionId) {
              transports.delete(transport.sessionId);
            }
          };
        } else {
          // Session exists but is SSE transport, not Streamable HTTP
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session uses different transport protocol' }));
          return;
        }

        console.error(`[mcp] handling POST request`);
        await transport.handleRequest(req, res);

        // Store transport AFTER handleRequest - sessionId is only set after first request
        if (transport.sessionId && !transports.has(transport.sessionId)) {
          console.error(`[mcp] storing transport with sessionId: ${transport.sessionId}`);
          transports.set(transport.sessionId, transport);
        }
        return;
      }

      // For Streamable HTTP GET requests, we need an existing session
      // (SSE-only clients are handled by the /sse endpoint above)
      if (req.method === 'GET') {
        const existingTransport = sessionId ? transports.get(sessionId) : undefined;
        console.error(`[mcp] GET, sessionId: ${sessionId || 'none'}, transport found: ${!!existingTransport}`);

        if (!existingTransport || !(existingTransport instanceof StreamableHTTPServerTransport)) {
          console.error(`[mcp] GET without valid Streamable HTTP session`);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad Request: No valid session. POST to initialize first, or use /sse for SSE transport.' }));
          return;
        }

        await existingTransport.handleRequest(req, res);
        return;
      }

      if (req.method === 'DELETE') {
        // Close session
        const transport = sessionId ? transports.get(sessionId) : undefined;
        if (transport) {
          await transport.close();
          transports.delete(sessionId!);
        }
        res.writeHead(200);
        res.end();
        return;
      }
    }

    //=========================================================================
    // WEBHOOK ENDPOINTS (for Gitea auto-indexing)
    //=========================================================================

    // Gitea webhook endpoint (no auth - uses webhook secret)
    if (req.url === '/webhook/gitea' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const eventType = req.headers['x-gitea-event'] as string | undefined;
        const signature = req.headers['x-gitea-signature'] as string | undefined;

        console.error(`[webhook] Gitea event: ${eventType}`);
        const result = await handleGiteaWebhook(eventType, signature, body);

        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      } catch (error) {
        console.error(`[webhook] Error: ${error}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Internal error' }));
        return;
      }
    }

    // Manual sync endpoint (requires auth)
    if (req.url === '/admin/sync' && req.method === 'POST') {
      const auth = validateAuth(req);
      if (!auth.valid) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }

      console.error(`[admin] Manual sync requested by ${auth.clientId}`);
      const result = triggerSync();
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // 404 for other paths
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  httpServer.listen(port, () => {
    console.error(`CodeHound MCP server started (HTTP mode) on port ${port}`);
    console.error(`  Health: http://localhost:${port}/health`);
    console.error(`  Token:  http://localhost:${port}/oauth/token`);
    console.error(`  MCP:    http://localhost:${port}/`);
  });
}

/**
 * Main entry point
 */
async function main() {
  const { mode, port } = parseArgs();

  if (mode === 'http') {
    await startHttpServer(port);
  } else {
    await startStdioServer();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
