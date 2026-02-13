export interface Message { type: string; payload: unknown; timestamp: number; }
export class SecureMessageBus {
  publish(_channel: string, _message: Message): void {}
  subscribe(_channel: string, _handler: (msg: Message) => void): () => void { return () => {}; }
}
export default SecureMessageBus;
