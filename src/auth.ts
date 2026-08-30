/**
 * Simple OAuth2 Client Credentials Authentication
 *
 * Provides token generation and validation for MCP server access.
 */

import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * Client credentials stored in the credentials file
 */
interface ClientCredential {
  clientId: string;
  clientSecretHash: string;
  name: string;
  createdAt: string;
}

/**
 * Active token in memory
 */
interface ActiveToken {
  clientId: string;
  expiresAt: number;
}

/**
 * Token response for OAuth2 token endpoint
 */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

/**
 * Default credentials file path
 */
const CREDENTIALS_FILE = process.env.MCP_CREDENTIALS_FILE || '/etc/mcp-hound/clients.json';

/**
 * Token expiration time (1 hour)
 */
const TOKEN_EXPIRY_SECONDS = 3600;

/**
 * In-memory token store
 */
const activeTokens = new Map<string, ActiveToken>();

/**
 * Refresh token data
 */
interface RefreshToken {
  clientId: string;
  expiresAt: number;
}

/**
 * In-memory refresh token store (longer lived)
 */
const refreshTokens = new Map<string, RefreshToken>();

/**
 * Refresh token expiration time (30 days)
 */
const REFRESH_TOKEN_EXPIRY_SECONDS = 30 * 24 * 3600;

/**
 * Authorization code data
 */
interface AuthCode {
  clientId: string;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: number;
}

/**
 * In-memory authorization code store (short-lived)
 */
const authCodes = new Map<string, AuthCode>();

/**
 * Hash a secret using SHA-256
 */
function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/**
 * Generate a random string
 */
function generateRandomString(length: number): string {
  return randomBytes(length).toString('base64url').slice(0, length);
}

/**
 * Load client credentials from file
 */
function loadCredentials(): ClientCredential[] {
  if (!existsSync(CREDENTIALS_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Save client credentials to file
 */
function saveCredentials(credentials: ClientCredential[]): void {
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}

/**
 * Validate client credentials and return client info if valid
 */
export function validateClientCredentials(
  clientId: string,
  clientSecret: string
): { valid: boolean; clientId?: string; name?: string } {
  const credentials = loadCredentials();
  const client = credentials.find((c) => c.clientId === clientId);

  if (!client) {
    return { valid: false };
  }

  const secretHash = hashSecret(clientSecret);
  if (client.clientSecretHash !== secretHash) {
    return { valid: false };
  }

  return { valid: true, clientId: client.clientId, name: client.name };
}

/**
 * Generate an access token and refresh token for a validated client
 */
export function generateAccessToken(clientId: string): TokenResponse {
  const accessToken = generateRandomString(32);
  const refreshToken = generateRandomString(48);
  const accessExpiresAt = Date.now() + TOKEN_EXPIRY_SECONDS * 1000;
  const refreshExpiresAt = Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000;

  activeTokens.set(accessToken, { clientId, expiresAt: accessExpiresAt });
  refreshTokens.set(refreshToken, { clientId, expiresAt: refreshExpiresAt });

  // Clean up expired tokens periodically
  cleanupExpiredTokens();

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: TOKEN_EXPIRY_SECONDS,
    scope: 'mcp',
  };
}

/**
 * Refresh an access token using a refresh token
 */
export function refreshAccessToken(
  refreshToken: string
): TokenResponse | { error: string; error_description: string } {
  const tokenData = refreshTokens.get(refreshToken);

  if (!tokenData) {
    return { error: 'invalid_grant', error_description: 'Invalid refresh token' };
  }

  if (Date.now() > tokenData.expiresAt) {
    refreshTokens.delete(refreshToken);
    return { error: 'invalid_grant', error_description: 'Refresh token expired' };
  }

  // Rotate refresh token (invalidate old one, issue new one)
  refreshTokens.delete(refreshToken);

  return generateAccessToken(tokenData.clientId);
}

/**
 * Validate a bearer token
 */
export function validateBearerToken(token: string): { valid: boolean; clientId?: string } {
  const activeToken = activeTokens.get(token);

  if (!activeToken) {
    return { valid: false };
  }

  if (Date.now() > activeToken.expiresAt) {
    activeTokens.delete(token);
    return { valid: false };
  }

  return { valid: true, clientId: activeToken.clientId };
}

/**
 * Remove expired tokens from memory
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [token, data] of activeTokens.entries()) {
    if (now > data.expiresAt) {
      activeTokens.delete(token);
    }
  }
  // Also cleanup expired refresh tokens
  for (const [token, data] of refreshTokens.entries()) {
    if (now > data.expiresAt) {
      refreshTokens.delete(token);
    }
  }
  // Also cleanup expired auth codes
  for (const [code, data] of authCodes.entries()) {
    if (now > data.expiresAt) {
      authCodes.delete(code);
    }
  }
}

/**
 * Create an authorization code (for auth code flow)
 */
export function createAuthorizationCode(
  clientId: string,
  redirectUri: string,
  codeChallenge?: string,
  codeChallengeMethod?: string
): string {
  const code = generateRandomString(32);
  authCodes.set(code, {
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    expiresAt: Date.now() + 60000, // 1 minute expiry
  });
  return code;
}

/**
 * Exchange authorization code for tokens
 * clientId is optional - if not provided, uses the one from the auth code (for public clients with PKCE)
 */
export function exchangeAuthorizationCode(
  code: string,
  clientId: string | null,
  redirectUri: string,
  codeVerifier?: string
): TokenResponse | { error: string; error_description: string } {
  const authCode = authCodes.get(code);

  if (!authCode) {
    return { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' };
  }

  // If clientId provided, verify it matches; otherwise use the one from auth code
  if (clientId && authCode.clientId !== clientId) {
    return { error: 'invalid_grant', error_description: 'Client ID mismatch' };
  }
  const effectiveClientId = clientId || authCode.clientId;

  if (authCode.redirectUri !== redirectUri) {
    return { error: 'invalid_grant', error_description: 'Redirect URI mismatch' };
  }

  // Verify PKCE if code challenge was provided
  if (authCode.codeChallenge && authCode.codeChallengeMethod === 'S256') {
    if (!codeVerifier) {
      return { error: 'invalid_grant', error_description: 'Code verifier required' };
    }
    const hash = createHash('sha256').update(codeVerifier).digest('base64url');
    if (hash !== authCode.codeChallenge) {
      return { error: 'invalid_grant', error_description: 'Invalid code verifier' };
    }
  }

  // Code is valid, delete it (single use)
  authCodes.delete(code);

  // Generate access token
  return generateAccessToken(effectiveClientId);
}

/**
 * Create a new client credential (for CLI tool)
 */
export function createClient(name: string): { clientId: string; clientSecret: string } {
  const clientId = `mcp_${generateRandomString(16)}`;
  const clientSecret = generateRandomString(32);
  const clientSecretHash = hashSecret(clientSecret);

  const credentials = loadCredentials();
  credentials.push({
    clientId,
    clientSecretHash,
    name,
    createdAt: new Date().toISOString(),
  });
  saveCredentials(credentials);

  return { clientId, clientSecret };
}

/**
 * List all clients (for CLI tool)
 */
export function listClients(): Array<{ clientId: string; name: string; createdAt: string }> {
  return loadCredentials().map((c) => ({
    clientId: c.clientId,
    name: c.name,
    createdAt: c.createdAt,
  }));
}

/**
 * Revoke a client (for CLI tool)
 */
export function revokeClient(clientId: string): boolean {
  const credentials = loadCredentials();
  const index = credentials.findIndex((c) => c.clientId === clientId);

  if (index === -1) {
    return false;
  }

  credentials.splice(index, 1);
  saveCredentials(credentials);

  // Also revoke any active tokens for this client
  for (const [token, data] of activeTokens.entries()) {
    if (data.clientId === clientId) {
      activeTokens.delete(token);
    }
  }

  return true;
}

/**
 * Dynamic client registration request (RFC 7591)
 */
export interface ClientRegistrationRequest {
  client_name?: string;
  redirect_uris?: string[];
  grant_types?: string[];
  token_endpoint_auth_method?: string;
}

/**
 * Dynamic client registration response (RFC 7591)
 */
export interface ClientRegistrationResponse {
  client_id: string;
  client_secret: string;
  client_name: string;
  client_id_issued_at: number;
  client_secret_expires_at: number;
  grant_types: string[];
  redirect_uris: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string;
}

/**
 * Register a new client dynamically (RFC 7591)
 */
export function registerClient(request: ClientRegistrationRequest): ClientRegistrationResponse {
  const clientName = request.client_name || `dynamic-client-${Date.now()}`;
  const redirectUris = request.redirect_uris || [];
  const { clientId, clientSecret } = createClient(clientName);

  return {
    client_id: clientId,
    client_secret: clientSecret,
    client_name: clientName,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0, // Never expires
    grant_types: ['client_credentials', 'authorization_code'],
    redirect_uris: redirectUris,
    response_types: ['code', 'token'],
    token_endpoint_auth_method: 'client_secret_post',
    scope: 'mcp',
  };
}
