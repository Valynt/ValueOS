/**
 * ServiceMessageBusAdapter
 */

export class ServiceMessageBusAdapter {
  constructor() {}

  protected async emitSecure(event: string, data: unknown): Promise<void> {
    // Base implementation - subclasses can override for actual message bus integration
  }
}

export const servicemessagebusadapter = new ServiceMessageBusAdapter();
