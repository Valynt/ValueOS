/**
 * Streaming Canvas Renderer
 * 
 * Renders canvas incrementally as agent generates layout
 * Shows skeleton loaders for progressive loading UX
 */

import React, { useState, useEffect } from 'react';
import { CanvasLayout } from './types';
import { createLogger } from '../../lib/logger';

const logger = createLogger({ component: 'StreamingCanvas' });

export interface StreamingCanvasProps {
  canvasId: string;
  onEvent?: (event: any) => void;
  wsUrl?: string;
}

export const StreamingCanvas: React.FC<StreamingCanvasProps> = ({ 
  canvasId,
  onEvent,
  wsUrl = '/api/canvas/stream'
}) => {
  const [layout, setLayout] = useState<CanvasLayout | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chunks, setChunks] = useState<Partial<CanvasLayout>[]>([]);
  
  useEffect(() => {
    // Connect to WebSocket for streaming updates
    const ws = new WebSocket(`${wsUrl}/${canvasId}`);

    ws.onopen = () => {
      logger.info('Streaming canvas WebSocket connected', { canvasId, wsUrl });
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'start') {
          setIsStreaming(true);
          setChunks([]);
        } else if (data.type === 'chunk') {
          setIsStreaming(true);
          setChunks(prev => [...prev, data.chunk]);
        } else if (data.type === 'complete') {
          setLayout(data.layout);
          setIsStreaming(false);
          setChunks([]);
        } else if (data.type === 'error') {
          logger.error('Streaming canvas error message received', new Error(String(data.error)), {
            canvasId,
          });
          setIsStreaming(false);
        }
      } catch (error) {
        logger.error('Streaming canvas failed to parse message', error as Error, { canvasId });
      }
    };

    ws.onerror = (error) => {
      logger.error('Streaming canvas WebSocket error', error as Error, { canvasId });
      setIsStreaming(false);
    };

    ws.onclose = () => {
      logger.info('Streaming canvas WebSocket disconnected', { canvasId });
      setIsStreaming(false);
    };
    
    return () => {
      ws.close();
    };
  }, [canvasId, wsUrl]);
  
  if (isStreaming && chunks.length > 0) {
    return <StreamingSkeletons chunks={chunks} />;
  }
  
  if (!layout) {
    return <EmptyCanvas message="Waiting for agent..." />;
  }
  
  // Render actual layout
  return (
    <div className="h-full w-full">
      {/* TODO: Integrate with actual CanvasRenderer */}
      <div className="text-white p-4">Canvas: {JSON.stringify(layout, null, 2)}</div>
    </div>
  );
};

/**
 * Show skeleton loaders for streaming components
 */
const StreamingSkeletons: React.FC<{ chunks: Partial<CanvasLayout>[] }> = ({ 
  chunks 
}) => {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      {chunks.map((chunk, i) => (
        <div key={i}>
          {chunk.type === 'Component' && (chunk as any).component === 'LineChart' && (
            <div className="h-64 bg-gray-800 rounded-lg"></div>
          )}
          {chunk.type === 'Component' && (chunk as any).component === 'KPICard' && (
            <div className="h-32 bg-gray-800 rounded-lg"></div>
          )}
          {chunk.type === 'Component' && (chunk as any).component === 'DataTable' && (
            <div className="h-96 bg-gray-800 rounded-lg"></div>
          )}
          {(!chunk.type || chunk.type === 'VerticalSplit' || chunk.type === 'Grid') && (
            <div className="h-48 bg-gray-800 rounded-lg"></div>
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * Empty canvas placeholder
 */
const EmptyCanvas: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-gray-400">{message}</p>
      </div>
    </div>
  );
};
