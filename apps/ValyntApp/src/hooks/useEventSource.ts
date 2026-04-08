import { useEffect, useRef, useState } from 'react';

interface UseEventSourceOptions {
  url: string;
  onMessage: (event: MessageEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

interface UseEventSourceReturn {
  status: 'connecting' | 'open' | 'closed' | 'error';
  reconnectAttempts: number;
  close: () => void;
}

/**
 * Generic Server-Sent Events (SSE) hook with auto-reconnection
 * 
 * @param options - Configuration options
 * @returns Connection status and close function
 */
export function useEventSource({
  url,
  onMessage,
  onError,
  onOpen,
  reconnectDelay = 5000,
  maxReconnectAttempts = 10,
}: UseEventSourceOptions): UseEventSourceReturn {
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualClose = useRef(false);

  const close = () => {
    isManualClose.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('closed');
  };

  useEffect(() => {
    if (!url) return;

    const connect = () => {
      // Don't reconnect if manually closed
      if (isManualClose.current) return;
      
      // Check max reconnect attempts
      if (reconnectAttempts >= maxReconnectAttempts) {
        setStatus('error');
        return;
      }

      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      try {
        const es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;
        setStatus('connecting');

        es.onopen = () => {
          setStatus('open');
          setReconnectAttempts(0);
          onOpen?.();
        };

        es.onmessage = (event) => {
          onMessage(event);
        };

        es.onerror = (error) => {
          setStatus('error');
          onError?.(error);
          
          // Close and schedule reconnect
          es.close();
          
          if (!isManualClose.current) {
            setReconnectAttempts((prev) => prev + 1);
            reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
          }
        };
      } catch (error) {
        setStatus('error');
        if (!isManualClose.current) {
          setReconnectAttempts((prev) => prev + 1);
          reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
        }
      }
    };

    // Reset manual close flag when url changes
    isManualClose.current = false;
    connect();

    return () => {
      close();
    };
  }, [url, reconnectDelay, maxReconnectAttempts, onMessage, onError, onOpen]);

  return { status, reconnectAttempts, close };
}
