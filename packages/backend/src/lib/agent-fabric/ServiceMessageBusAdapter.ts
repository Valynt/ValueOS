/**
 * ServiceMessageBusAdapter
 */

import { EventEmitter } from 'events';

export class ServiceMessageBusAdapter extends EventEmitter {
  constructor() {
    super();
  }

  protected async emitSecure(event: string, data: unknown): Promise<void> {
    this.emit(event, data);
  }
}

export const servicemessagebusadapter = new ServiceMessageBusAdapter();
