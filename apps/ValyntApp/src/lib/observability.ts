export function recordMetric(_name: string, _value: number, _tags?: Record<string, string>): void {}
export function startSpan(_name: string): { end: () => void } { return { end: () => {} }; }
