#!/usr/bin/env node
/**
 * Hound MCP CLI Tool
 *
 * Manage OAuth2 client credentials for MCP server access.
 */

import { createClient, listClients, revokeClient } from './auth.js';

function printUsage(): void {
  console.log(`
Hound MCP Credential Manager

Usage:
  mcp-hound-auth create <name>     Create a new client credential
  mcp-hound-auth list              List all client credentials
  mcp-hound-auth revoke <client_id> Revoke a client credential
  mcp-hound-auth help              Show this help message

Examples:
  mcp-hound-auth create "Claude Code - Workstation"
  mcp-hound-auth list
  mcp-hound-auth revoke mcp_abc123xyz

Environment:
  MCP_CREDENTIALS_FILE  Path to credentials file (default: /etc/mcp-hound/clients.json)
`);
}

function handleCreate(name: string): void {
  if (!name) {
    console.error('Error: Client name is required');
    console.error('Usage: mcp-hound-auth create <name>');
    process.exit(1);
  }

  try {
    const { clientId, clientSecret } = createClient(name);

    console.log('\n✓ Client created successfully\n');
    console.log('Save these credentials - the secret cannot be recovered:\n');
    console.log(`  Client ID:     ${clientId}`);
    console.log(`  Client Secret: ${clientSecret}`);
    console.log('\nClaude Code configuration (~/.claude.json):\n');
    console.log(`{
  "mcpServers": {
    "hound": {
      "url": "https://your-mcp-hound-server.example.com/",
      "auth": {
        "type": "oauth2",
        "clientId": "${clientId}",
        "clientSecret": "${clientSecret}",
        "tokenUrl": "https://your-mcp-hound-server.example.com/oauth/token"
      }
    }
  }
}`);
    console.log('');
  } catch (error) {
    console.error('Error creating client:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function handleList(): void {
  try {
    const clients = listClients();

    if (clients.length === 0) {
      console.log('No clients configured.');
      return;
    }

    console.log('\nConfigured clients:\n');
    console.log('  Client ID                    Name                           Created');
    console.log('  ─────────────────────────────────────────────────────────────────────');

    for (const client of clients) {
      const id = client.clientId.padEnd(28);
      const name = client.name.slice(0, 30).padEnd(30);
      const created = new Date(client.createdAt).toLocaleDateString();
      console.log(`  ${id} ${name} ${created}`);
    }
    console.log('');
  } catch (error) {
    console.error('Error listing clients:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function handleRevoke(clientId: string): void {
  if (!clientId) {
    console.error('Error: Client ID is required');
    console.error('Usage: mcp-hound-auth revoke <client_id>');
    process.exit(1);
  }

  try {
    const success = revokeClient(clientId);

    if (success) {
      console.log(`✓ Client ${clientId} revoked successfully`);
    } else {
      console.error(`Error: Client ${clientId} not found`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error revoking client:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Parse arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'create':
    handleCreate(args.slice(1).join(' '));
    break;
  case 'list':
    handleList();
    break;
  case 'revoke':
    handleRevoke(args[1]);
    break;
  case 'help':
  case '--help':
  case '-h':
    printUsage();
    break;
  default:
    if (command) {
      console.error(`Unknown command: ${command}\n`);
    }
    printUsage();
    process.exit(command ? 1 : 0);
}
