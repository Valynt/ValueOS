# Performance Monitoring Guide

## Overview

ValueCanvas includes performance monitoring utilities that track Core Web Vitals and custom application metrics. This guide explains how to use the performance monitoring system and interpret the metrics.

## Core Web Vitals

### Interaction to Next Paint (INP)
**Target:** < 200ms | **Warning:** 300ms | **Critical:** > 500ms

INP measures responsiveness throughout the page lifecycle. It tracks the time from user interaction (click, tap, keystroke) to the next paint.

```typescript
// Automatically tracked when observeWebVitals() is called
performanceMonitor.observeWebVitals();

// View INP metrics
const inpMetrics = performanceMonitor.getMetrics('web-vitals.inp');
```

**Why it matters:** INP replaced First Input Delay (FID) as a Core Web Vital because it measures responsiveness throughout the entire session, not just the first interaction.

### Total Blocking Time (TBT)
**Target:** < 200ms | **Warning:** 400ms | **Critical:** > 600ms

TBT measures the total time the main thread is blocked by long tasks (> 50ms) between First Contentful Paint and Time to Interactive.

```typescript
// Automatically tracked when observeWebVitals() is called
performanceMonitor.observeWebVitals();

// View TBT metrics
const tbtMetrics = performanceMonitor.getMetrics('web-vitals.tbt');
```

**Why it matters:** High TBT indicates JavaScript is blocking the main thread, preventing user interactions from being processed quickly.

### First Contentful Paint (FCP)
**Target:** < 1.8s | **Warning:** 2.5s | **Critical:** > 3s

FCP measures when the first content appears on screen.

```typescript
const fcpMetrics = performanceMonitor.getMetrics('web-vitals.fcp');
```

### Largest Contentful Paint (LCP)
**Target:** < 2.5s | **Warning:** 3.5s | **Critical:** > 4s

LCP measures when the largest content element becomes visible.

```typescript
const lcpMetrics = performanceMonitor.getMetrics('web-vitals.lcp');
```

### Cumulative Layout Shift (CLS)
**Target:** ≤ 0.1 | **Warning:** 0.15 | **Critical:** > 0.25

CLS measures visual stability by tracking unexpected layout shifts.

```typescript
const clsMetrics = performanceMonitor.getMetrics('web-vitals.cls');
```

## Custom Metrics

### Component Performance Measurement

Track how long operations take:

```typescript
// Start measuring
const endMeasure = performanceMonitor.startMeasure('component.load');

// ... perform operation ...

// End measurement and get duration
const duration = endMeasure();
console.log(`Operation took ${duration}ms`);
```

### Throughput Tracking

Measure actions per second for high-traffic components:

```typescript
const actionCount = 100;
const duration = 1000; // ms

performanceMonitor.measureThroughput('button-clicks', actionCount, duration);

// Result: 100 actions/second
```

**Use cases:**
- Form submissions
- API request rates
- User interactions
- Data processing

### Error Rate Monitoring

Track success/failure rates for operations:

```typescript
// Record operations
performanceMonitor.recordOperation('api-call', true, 150);  // success
performanceMonitor.recordOperation('api-call', false, 200); // failure

// Calculate error rate (last 60 seconds)
const errorRate = performanceMonitor.calculateErrorRate('api-call', 60000);
console.log(`Error rate: ${errorRate}%`);
```

**Target:** < 1% error rate

### Animation Frame Rate

Monitor animation smoothness:

```typescript
// Monitor for 1 second
const fps = await performanceMonitor.monitorFrameRate(1000);
console.log(`Animation running at ${fps} FPS`);
```

**Target:** 60 FPS for smooth animations

### Memory Usage

Track JavaScript heap usage:

```typescript
performanceMonitor.trackMemoryUsage();

const memoryMetrics = performanceMonitor.getMetrics('memory.used');
// Value in MB
```

## Performance Reports

Generate performance reports with statistics and issues:

```typescript
const report = performanceMonitor.generateReport();

console.log('Summary:', report.summary);
// {
//   'web-vitals.inp': { avg: 180, p50: 150, p95: 250, p99: 300 },
//   'api-call': { avg: 200, p50: 180, p95: 350, p99: 450 }
// }

console.log('Issues:', report.issues);
// [
//   { name: 'settings.panel.load', severity: 'warning', value: 350 }
// ]
```

## React Integration

Use the performance monitoring hook in React components:

```typescript
import { usePerformanceMonitor } from '@/utils/performance';

function MyComponent() {
  const { recordMetric } = usePerformanceMonitor('MyComponent.render');
  
  useEffect(() => {
    // Component automatically measures render time
    
    // Record custom metrics
    recordMetric({
      name: 'data.fetch',
      value: 150,
      unit: 'ms',
    });
  }, []);
  
  return <div>Content</div>;
}
```

## Best Practices

### 1. Set Performance Budgets

Define acceptable thresholds for your application:

```typescript
const PERFORMANCE_BENCHMARKS = {
  'component.load': { target: 100, warning: 200, critical: 300 },
  'api.response': { target: 200, warning: 500, critical: 1000 },
};
```

### 2. Monitor in Production

Enable Web Vitals tracking in production:

```typescript
if (typeof window !== 'undefined') {
  performanceMonitor.observeWebVitals();
}
```

### 3. Track Critical User Journeys

Measure key user flows:

```typescript
// Checkout flow
const endCheckout = performanceMonitor.startMeasure('checkout.complete');
// ... checkout logic ...
const duration = endCheckout();

if (duration > 3000) {
  console.warn('Checkout took too long:', duration);
}
```

### 4. Use Percentiles, Not Averages

P95 and P99 show what most users experience:

```typescript
const p95 = performanceMonitor.getPercentile('page.load', 95);
const p99 = performanceMonitor.getPercentile('page.load', 99);

// 95% of users see load times under p95
// 99% of users see load times under p99
```

### 5. Debounce High-Frequency Events

Use the debounce utility for events like scroll or resize:

```typescript
import { debounce } from '@/utils/performance';

const handleScroll = debounce(() => {
  // Handle scroll
}, 100);

window.addEventListener('scroll', handleScroll);
```

## Interpreting Metrics

### Good Performance
- **INP:** < 200ms - Feels instant
- **TBT:** < 200ms - Smooth interactions
- **FCP:** < 1.8s - Quick initial render
- **LCP:** < 2.5s - Main content loads fast
- **CLS:** < 0.1 - Stable layout
- **FPS:** 60 - Smooth animations
- **Error Rate:** < 1% - Reliable

### Needs Improvement
- **INP:** 200-500ms - Noticeable delay
- **TBT:** 200-600ms - Some blocking
- **FCP:** 1.8-3s - Slow initial render
- **LCP:** 2.5-4s - Slow main content
- **CLS:** 0.1-0.25 - Some layout shifts
- **FPS:** 30-60 - Choppy animations
- **Error Rate:** 1-5% - Occasional failures

### Poor Performance
- **INP:** > 500ms - Frustrating delays
- **TBT:** > 600ms - Significant blocking
- **FCP:** > 3s - Very slow
- **LCP:** > 4s - Very slow
- **CLS:** > 0.25 - Unstable layout
- **FPS:** < 30 - Janky animations
- **Error Rate:** > 5% - Unreliable

## Troubleshooting

### High INP
- Break up long JavaScript tasks
- Use web workers for heavy computation
- Debounce/throttle event handlers
- Optimize event listeners

### High TBT
- Code split large bundles
- Defer non-critical JavaScript
- Optimize third-party scripts
- Use lazy loading

### High LCP
- Optimize images (compression, WebP)
- Preload critical resources
- Use CDN for static assets
- Minimize render-blocking CSS

### High CLS
- Set dimensions for images/videos
- Reserve space for ads
- Avoid inserting content above existing content
- Use `font-display: swap`

### Low FPS
- Reduce DOM complexity
- Use CSS transforms instead of layout properties
- Optimize animations with `will-change`
- Use `requestAnimationFrame`

## API Reference

### PerformanceMonitor

```typescript
class PerformanceMonitor {
  // Measurement
  startMeasure(name: string): () => number
  recordMetric(metric: PerformanceMetric): void
  
  // Retrieval
  getMetrics(name: string): PerformanceMetric[]
  getAverage(name: string): number
  getPercentile(name: string, percentile: number): number
  
  // Web Vitals
  observeWebVitals(): void
  
  // Custom Metrics
  measureThroughput(componentName: string, actionCount: number, duration: number): void
  monitorFrameRate(duration?: number): Promise<number>
  trackMemoryUsage(): void
  
  // Error Tracking
  recordOperation(name: string, success: boolean, duration?: number): void
  calculateErrorRate(operationName: string, timeWindow?: number): number
  
  // Reporting
  generateReport(): PerformanceReport
  
  // Cleanup
  clear(): void
  disconnect(): void
}
```

### Types

```typescript
interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PerformanceBenchmark {
  target: number;
  warning: number;
  critical: number;
}

interface PerformanceReport {
  summary: Record<string, {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  }>;
  issues: Array<{
    name: string;
    severity: string;
    value: number;
  }>;
}
```

## Resources

- [Web Vitals](https://web.dev/vitals/)
- [Core Web Vitals](https://web.dev/articles/vitals)
- [INP Documentation](https://web.dev/articles/inp)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [UXPin Performance Metrics](https://www.uxpin.com/studio/blog/top-metrics-for-ui-component-performance-benchmarking/)
</content>
</invoke>