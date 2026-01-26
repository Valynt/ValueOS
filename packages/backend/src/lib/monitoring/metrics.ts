// Minimal metrics shim to satisfy imports during local DX
// Provides simple no-op counters/histograms compatible with code usage

type Labels = Record<string, string>;

class NoopMetric {
  inc(_labels?: Labels, _value?: number) {}
  observe(_labels: Labels, _value: number) {}
}

export const kafkaProducerEventsTotal = new NoopMetric();
export const kafkaProducerLatency = new NoopMetric();
export const kafkaProducerErrors = new NoopMetric();

export default {
  kafkaProducerEventsTotal,
  kafkaProducerLatency,
  kafkaProducerErrors,
};
