/**
 * ContextFabric
 */

export class ContextFabric {
  buildContext(data: any): any {
    return { ...data, context: 'built' };
  }
}

export const contextFabric = new ContextFabric();
