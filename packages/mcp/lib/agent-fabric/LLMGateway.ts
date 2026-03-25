export class LLMGateway {
  constructor(provider: string, config: Record<string, unknown>) {}
  async generate(request: Record<string, unknown>): Promise<{ content: string }> {
    return { content: "{}" };
  }
}
