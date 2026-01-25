import { useEffect, useRef } from 'react';
import { usePrefetch } from './usePrefetch';

interface UseIntersectionPrefetchOptions {
  route?: string;
  resource?: string;
  rootMargin?: string;
  threshold?: number;
  enabled?: boolean;
}

/**
 * Hook that prefetches routes or resources when element comes into viewport
 */
export const useIntersectionPrefetch = ({
  route,
  resource,
  rootMargin = '50px',
  threshold = 0.1,
  enabled = true,
}: UseIntersectionPrefetchOptions) => {
  const elementRef = useRef<HTMLElement>(null);
  const { prefetchRoute, prefetchResource } = usePrefetch();

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (route) {
              prefetchRoute(route);
            }
            if (resource) {
              prefetchResource(resource);
            }
            // Disconnect after first intersection to avoid repeated prefetches
            observer.disconnect();
          }
        });
      },
      { rootMargin, threshold }
    );

    observer.observe(elementRef.current);

    return () => observer.disconnect();
  }, [route, resource, rootMargin, threshold, enabled, prefetchRoute, prefetchResource]);

  return elementRef;
};