import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AWSSecretProvider } from '../AWSSecretProvider';
import { VaultSecretProvider } from '../VaultSecretProvider';
import { providerFactory, createProviderFromEnv } from '../ProviderFactory';

let sendMock: ReturnType<typeof vi.fn>;
let mockVaultClient: any;

vi.mock('@aws-sdk/client-secrets-manager', () => {
  class GetSecretValueCommand {
    constructor(public input: any) {}
  }
  class PutSecretValueCommand {
    constructor(public input: any) {}
  }
  class DeleteSecretCommand {
    constructor(public input: any) {}
  }
  class ListSecretsCommand {
    constructor(public input: any) {}
  }
  class DescribeSecretCommand {
    constructor(public input: any) {}
  }
  class RotateSecretCommand {
    constructor(public input: any) {}
  }

  class SecretsManagerClient {
    send = (command: any) => sendMock(command);
  }

  return {
    SecretsManagerClient,
    GetSecretValueCommand,
    PutSecretValueCommand,
    DeleteSecretCommand,
    ListSecretsCommand,
    DescribeSecretCommand,
    RotateSecretCommand,
  };
});

vi.mock('node-vault', () => ({
  default: vi.fn(() => mockVaultClient),
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe.each([
  {
    name: 'aws',
    setup: async () => {
      sendMock = vi.fn(async (command) => {
        const commandName = command.constructor.name;
        if (commandName === 'GetSecretValueCommand') {
          return { SecretString: JSON.stringify({ value: 'aws-secret' }) };
        }
        if (commandName === 'ListSecretsCommand') {
          return { SecretList: [{ Name: 'valuecanvas/dev/tenants/t-1/api-key', Tags: [] }] };
        }
        if (commandName === 'DescribeSecretCommand') {
          return { Name: 'valuecanvas/dev/tenants/t-1/api-key', VersionIdsToStages: { v1: [] } };
        }
        return {};
      });

      const provider = new AWSSecretProvider('us-east-1', 1_000);
      return { provider, getSpy: sendMock };
    },
  },
  {
    name: 'vault',
    setup: async () => {
      mockVaultClient = {
        kubernetesLogin: vi.fn().mockResolvedValue({ auth: { client_token: 'token' } }),
        read: vi.fn().mockResolvedValue({ data: { data: { value: 'vault-secret' }, metadata: { version: 1 } } }),
        write: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
        list: vi.fn().mockResolvedValue({ data: { keys: ['api-key'] } }),
        health: vi.fn().mockResolvedValue({ status: 'ok' }),
      };

      const provider = new VaultSecretProvider('http://vault', 'valuecanvas', 'role', 1_000);
      await provider.initialize();
      return { provider, getSpy: mockVaultClient.read };
    },
  },
])('ISecretProvider compliance for $name', ({ setup }) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns secret values and caches responses', async () => {
    const { provider, getSpy } = await setup();
    const result1 = await provider.getSecret('t-1', 'api-key', undefined, 'user-1');
    const result2 = await provider.getSecret('t-1', 'api-key', undefined, 'user-1');

    expect(result1.value).toBeDefined();
    expect(result2.value).toBeDefined();
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('supports listing secrets per tenant', async () => {
    const { provider } = await setup();
    const keys = await provider.listSecrets('t-1', 'user-1');
    expect(keys.length).toBeGreaterThan(0);
  });

  it('reports correct provider name for switching', async () => {
    const { provider } = await setup();
    expect(['aws', 'vault']).toContain(provider.getProviderName());
  });
});

describe('ProviderFactory from environment', () => {
  beforeEach(() => {
    providerFactory.clearCache();
  });

  it('creates vault provider when SECRETS_PROVIDER=vault', async () => {
    process.env.SECRETS_PROVIDER = 'vault';
    process.env.VAULT_ADDR = 'http://vault';
    process.env.VAULT_NAMESPACE = 'valuecanvas';

    const provider = createProviderFromEnv();

    expect(provider.getProviderName()).toBe('vault');
  });
});
