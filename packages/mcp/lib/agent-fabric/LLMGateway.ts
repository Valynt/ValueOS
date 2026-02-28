export class LLMGateway {
  constructor(provider: string, config: any) {}
  async generate(request: any): Promise<{ content: string }> {
    return { content: "{}" };
  }
}
