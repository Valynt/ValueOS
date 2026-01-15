import React, { useCallback, useEffect, useRef, useState } from 'react';

// Lazy loading hook for components
export function useLazyLoad<T extends HTMLElement = HTMLElement>(options?: IntersectionObserverInit) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [hasIntersected, options]);

  return { ref, isIntersecting, hasIntersected };
}

// Image lazy loading component
export function LazyImage({
  src,
  alt,
  className = '',
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+Cjwvc3ZnPgo=',
  ...props
}: {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
} & React.ImgHTMLAttributes<HTMLImageElement>) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { ref, hasIntersected } = useLazyLoad<HTMLImageElement>();

  useEffect(() => {
    if (!hasIntersected) return;

    const img = new Image();
    img.src = src;
    img.onload = () => setIsLoaded(true);
    img.onerror = () => setHasError(true);
  }, [src, hasIntersected]);

  return (
    <img
      ref={ref}
      src={hasIntersected && isLoaded ? src : placeholder}
      alt={alt}
      className={`${className} ${!isLoaded ? 'blur-sm' : ''} transition-all duration-300`}
      loading="lazy"
      {...props}
    />
  );
}

// Caching utilities
export class Cache {
  private static instance: Cache;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  set(key: string, data: any, ttl = 5 * 60 * 1000): void { // Default 5 minutes
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

// React hook for caching
export function useCache<T>(key: string, ttl?: number) {
  const cache = Cache.getInstance();

  const set = useCallback((data: T) => {
    cache.set(key, data, ttl);
  }, [key, ttl]);

  const get = useCallback(() => {
    return cache.get<T>(key);
  }, [key]);

  const clear = useCallback(() => {
    cache.delete(key);
  }, [key]);

  return { set, get, clear };
}

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Throttle hook
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= delay) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, delay - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return throttledValue;
}

// Memoization hook with dependencies
export function useMemoCompare<T>(
  next: T,
  compare: (previous: T | undefined, next: T) => boolean
): T {
  const previousRef = useRef<T | undefined>(undefined);
  const previous = previousRef.current;

  const isEqual = compare(previous, next);

  useEffect(() => {
    if (!isEqual) {
      previousRef.current = next;
    }
  });

  return isEqual ? previous! : next;
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const startTime = useRef(performance.now());

  useEffect(() => {
    renderCount.current += 1;
  });

  useEffect(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTime.current;

    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} render #${renderCount.current} took ${renderTime.toFixed(2)}ms`);
    }

    startTime.current = performance.now();
  });

  return {
    renderCount: renderCount.current,
  };
}

// Bundle splitting and lazy loading utilities
export const lazyLoad = {
  // Lazy load a component
  component: (importFunc: () => Promise<{ default: React.ComponentType<any> }>) => {
    return React.lazy(importFunc);
  },

  // Preload a component
  preload: (importFunc: () => Promise<any>) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    // This is a simplified version - in practice you'd need more sophisticated preloading
    importFunc();
  },
};

// Service Worker registration disabled for WebContainer compatibility
export function useServiceWorker() {
  useEffect(() => {
    // Unregister any existing service workers to prevent WebContainer conflicts
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister();
        });
      });
    }
  }, []);
}

// Resource hints for performance
export function useResourceHints() {
  useEffect(() => {
    // Preconnect to external domains
    const domains = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

    domains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });

    // DNS prefetch for critical resources
    const dnsPrefetchDomains = ['https://api.example.com'];

    dnsPrefetchDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = domain;
      document.head.appendChild(link);
    });

    return () => {
      // Cleanup not necessary as these persist for the session
    };
  }, []);
}
