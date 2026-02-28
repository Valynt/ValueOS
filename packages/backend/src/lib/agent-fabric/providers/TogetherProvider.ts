// TogetherProvider.ts
// Encapsulates Together-specific logic for LLMGateway

import { TogetherAPIConfig, TogetherAPIError } from './types';

export class TogetherProvider {
  private config: TogetherAPIConfig;

  constructor(config: TogetherAPIConfig) {
    this.config = config;
  }

  async callTogetherAPI(payload: Record<string, unknown>): Promise<any> {
    // Implement Together API call logic here
    // Example: fetch, error handling, etc.
    // ...
    throw new Error('Not implemented');
  }

  handleTogetherError(error: unknown): TogetherAPIError {
    // Implement Together-specific error handling
    // ...
    throw new Error('Not implemented');
  }
}
