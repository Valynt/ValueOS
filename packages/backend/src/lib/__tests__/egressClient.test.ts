import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertEgressAllowed, EgressBlockedError, egressFetch } from '../egressClient.js';

vi.mock('../logger.js', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

// Stub global fetch so egressFetch tests don't make real network calls.
const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
vi.stubGlobal('fetch', mockFetch);

describe('assertEgressAllowed', () => {
  describe('non-production (allowlist advisory only)', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('allows any non-blocked hostname in dev', () => {
      expect(() => assertEgressAllowed('https://example.com')).not.toThrow();
      expect(() => assertEgressAllowed('https://localhost:3000')).not.toThrow();
      expect(() => assertEgressAllowed('http://127.0.0.1:8080')).not.toThrow();
    });

    it('still blocks hostnames on the blocklist in dev', () => {
      expect(() => assertEgressAllowed('https://evil.ngrok.io')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://foo.serveo.net')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://github.com')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://pastebin.com')).toThrow(EgressBlockedError);
    });
  });

  describe('production', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    // ── Allowed hostnames ────────────────────────────────────────────────

    it('allows Supabase hostnames', () => {
      expect(() => assertEgressAllowed('https://abc123.supabase.co')).not.toThrow();
      expect(() => assertEgressAllowed('https://project.supabase.com')).not.toThrow();
    });

    it('allows LLM provider hostnames', () => {
      expect(() => assertEgressAllowed('https://api.openai.com/v1/chat')).not.toThrow();
      expect(() => assertEgressAllowed('https://api.anthropic.com/v1/messages')).not.toThrow();
      expect(() => assertEgressAllowed('https://api.together.xyz/inference')).not.toThrow();
      expect(() => assertEgressAllowed('https://generativelanguage.googleapis.com')).not.toThrow();
    });

    it('allows CRM hostnames', () => {
      expect(() => assertEgressAllowed('https://api.hubapi.com/crm/v3')).not.toThrow();
      expect(() => assertEgressAllowed('https://api.hubspot.com')).not.toThrow();
      expect(() => assertEgressAllowed('https://myorg.salesforce.com')).not.toThrow();
    });

    it('allows Stripe hostnames', () => {
      expect(() => assertEgressAllowed('https://api.stripe.com/v1/charges')).not.toThrow();
      expect(() => assertEgressAllowed('https://hooks.stripe.com')).not.toThrow();
    });

    it('allows monitoring hostnames', () => {
      expect(() => assertEgressAllowed('https://app.datadoghq.com')).not.toThrow();
    });

    // ── Blocked hostnames ────────────────────────────────────────────────

    it('blocks ngrok tunneling domains', () => {
      expect(() => assertEgressAllowed('https://abc.ngrok.io')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://abc.ngrok-free.app')).toThrow(EgressBlockedError);
    });

    it('blocks serveo and localtunnel (apex and subdomains)', () => {
      expect(() => assertEgressAllowed('https://serveo.net')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://foo.serveo.net')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://foo.localtunnel.me')).toThrow(EgressBlockedError);
    });

    it('blocks github.com and paste sites', () => {
      expect(() => assertEgressAllowed('https://github.com/org/repo')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://raw.githubusercontent.com/file')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://gist.github.com/abc')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://pastebin.com/abc')).toThrow(EgressBlockedError);
    });

    it('blocks RFC-1918 private IP ranges (SSRF protection)', () => {
      expect(() => assertEgressAllowed('https://10.0.0.1')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://10.255.255.255')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://172.16.0.1')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://172.31.255.255')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://192.168.1.1')).toThrow(EgressBlockedError);
    });

    it('blocks link-local addresses', () => {
      expect(() => assertEgressAllowed('https://169.254.169.254')).toThrow(EgressBlockedError);
    });

    it('blocks loopback addresses in production', () => {
      expect(() => assertEgressAllowed('https://localhost')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('https://127.0.0.1')).toThrow(EgressBlockedError);
    });

    it('blocks IPv6 loopback', () => {
      // URL normalises [::1] to ::1 in hostname
      expect(() => assertEgressAllowed('https://[::1]')).toThrow(EgressBlockedError);
    });

    // ── Protocol enforcement ─────────────────────────────────────────────

    it('blocks non-HTTPS in production', () => {
      expect(() => assertEgressAllowed('http://api.openai.com')).toThrow(EgressBlockedError);
    });

    it('allows HTTPS for allowlisted hosts', () => {
      expect(() => assertEgressAllowed('https://api.openai.com')).not.toThrow();
    });

    // ── Invalid URLs ─────────────────────────────────────────────────────

    it('blocks invalid URLs', () => {
      expect(() => assertEgressAllowed('not-a-url')).toThrow(EgressBlockedError);
      expect(() => assertEgressAllowed('')).toThrow(EgressBlockedError);
    });

    // ── EGRESS_EXTRA_ALLOWED_DOMAINS ─────────────────────────────────────

    it('allows domains added via EGRESS_EXTRA_ALLOWED_DOMAINS', () => {
      vi.stubEnv('EGRESS_EXTRA_ALLOWED_DOMAINS', 'custom.internal.example.com,*.partner.io');
      expect(() => assertEgressAllowed('https://custom.internal.example.com/api')).not.toThrow();
      vi.unstubAllEnvs();
      vi.stubEnv('NODE_ENV', 'production'); // re-stub after unstubAll
    });

    it('does not allow domains not in EGRESS_EXTRA_ALLOWED_DOMAINS', () => {
      vi.stubEnv('EGRESS_EXTRA_ALLOWED_DOMAINS', 'custom.internal.example.com');
      expect(() => assertEgressAllowed('https://other.example.com')).toThrow(EgressBlockedError);
      vi.unstubAllEnvs();
      vi.stubEnv('NODE_ENV', 'production');
    });
  });
});

describe('egressFetch', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    mockFetch.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('calls fetch for allowed URLs', async () => {
    await egressFetch('https://api.openai.com/v1/chat');
    expect(mockFetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat', undefined);
  });

  it('throws EgressBlockedError without calling fetch for blocked URLs', async () => {
    await expect(egressFetch('https://10.0.0.1/secret')).rejects.toThrow(EgressBlockedError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('accepts URL objects', async () => {
    await egressFetch(new URL('https://api.stripe.com/v1/charges'));
    expect(mockFetch).toHaveBeenCalled();
  });
});
