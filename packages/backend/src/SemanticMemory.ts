/**
 * Semantic Memory
 */

export class SemanticMemory {
  private memory: Map<string, any> = new Map();

  async store(key: string, value: any): Promise<void> {
    this.memory.set(key, value);
  }

  async retrieve(key: string): Promise<any | null> {
    return this.memory.get(key) || null;
  }
}

export const semanticMemory = new SemanticMemory();
