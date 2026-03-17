/**
 * ContextFabric
 */

export class ContextFabric {
  buildContext(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data, context: 'built' };
  }
}

export const contextFabric = new ContextFabric();
