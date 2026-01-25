import React, { useEffect, useRef } from 'react';
import { Link, useMatch, useResolvedPath } from 'react-router-dom';
import { usePrefetch } from '../../hooks/usePrefetch';

interface PrefetchLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean;
  intersection?: boolean;
  rootMargin?: string;
}

/**
 * Enhanced Link component with prefetching capabilities
 * Supports hover prefetch and intersection observer prefetch
 */
export const PrefetchLink: React.FC<PrefetchLinkProps> = ({
  to,
  children,
  className,
  prefetch = true,
  intersection = false,
  rootMargin = '50px',
  ...props
}) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const { prefetchRoute } = usePrefetch();
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: true });

  useEffect(() => {
    if (!prefetch || !linkRef.current) return;

    const link = linkRef.current;
    let timeoutId: NodeJS.Timeout;

    const handleMouseEnter = () => {
      // Debounce prefetch on hover
      timeoutId = setTimeout(() => {
        prefetchRoute(to);
      }, 100);
    };

    const handleMouseLeave = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    link.addEventListener('mouseenter', handleMouseEnter);
    link.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      link.removeEventListener('mouseenter', handleMouseEnter);
      link.removeEventListener('mouseleave', handleMouseLeave);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [prefetch, to, prefetchRoute]);

  useEffect(() => {
    if (!intersection || !linkRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            prefetchRoute(to);
            observer.disconnect();
          }
        });
      },
      { rootMargin }
    );

    observer.observe(linkRef.current);

    return () => observer.disconnect();
  }, [intersection, to, rootMargin, prefetchRoute]);

  return (
    <Link
      ref={linkRef}
      to={to}
      className={className}
      {...props}
    >
      {children}
    </Link>
  );
};