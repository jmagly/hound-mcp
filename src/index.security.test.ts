import { afterEach, describe, expect, it } from 'vitest';
import { validateApprovalToken } from './index.js';

describe('approval token validation', () => {
  afterEach(() => {
    delete process.env.MCP_APPROVAL_TOKEN;
  });

  it('fails closed when the server token is not configured', () => {
    expect(validateApprovalToken('candidate')).toBe(false);
  });

  it('accepts only an exact token match', () => {
    process.env.MCP_APPROVAL_TOKEN = 'high-entropy-approval-token';
    expect(validateApprovalToken('high-entropy-approval-token')).toBe(true);
    expect(validateApprovalToken('wrong-token')).toBe(false);
    expect(validateApprovalToken(undefined)).toBe(false);
  });
});
