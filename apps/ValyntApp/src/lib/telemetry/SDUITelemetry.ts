export class SDUITelemetry {
  static track(_event: string, _data?: Record<string, unknown>): void {}
  static startSpan(_name: string): { end: () => void } { return { end: () => {} }; }
  static recordMetric(_name: string, _value: number): void {}
}

export default SDUITelemetry;
