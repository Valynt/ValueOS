import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (!global.fetch) {
  global.fetch = vi.fn();
}
