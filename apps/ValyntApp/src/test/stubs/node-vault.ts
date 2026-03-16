// Stub for node-vault — not installed in the test environment.
// VaultSecretProvider uses a dynamic import; this stub prevents resolution
// failures when the module graph is walked at transform time.
import { vi } from "vitest";

const vault = vi.fn(() => ({
  read: vi.fn(),
  write: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
}));

export default vault;
