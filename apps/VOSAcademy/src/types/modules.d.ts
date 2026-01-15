declare module 'streamdown' {
  export function parseMarkdown(markdown: string): any;
  export default function streamdown(markdown: string): any;
}

declare module 'intersection-observer' {
  const IntersectionObserver: any;
  export default IntersectionObserver;
}

declare module 'resize-observer-polyfill' {
  export default class ResizeObserver {
    constructor(callback: ResizeObserverCallback);
    observe(target: Element): void;
    unobserve(target: Element): void;
    disconnect(): void;
  }
}
