declare module "web-vitals" {
  export interface Metric {
    name: string;
    value: number;
    delta: number;
    id: string;
    navigationType: string;
  }

  export type ReportCallback = (metric: Metric) => void;

  export function onLCP(callback: ReportCallback): void;
  export function onFID(callback: ReportCallback): void;
  export function onCLS(callback: ReportCallback): void;
  export function onFCP(callback: ReportCallback): void;
  export function onTTFB(callback: ReportCallback): void;
  export function onINP(callback: ReportCallback): void;
}
