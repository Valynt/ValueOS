/**
 * Streaming Canvas Renderer
 * 
 * Renders canvas incrementally as agent generates layout
 * Shows skeleton loaders for progressive loading UX
 */

import React, { useState, useEffect } from 'react';
import { CanvasLayout } from './types';

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
      console.log('StreamingCanvas: WebSocket connected');
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
          console.error('StreamingCanvas error:', data.error);
          setIsStreaming(false);
        }
      } catch (error) {
        console.error('StreamingCanvas: Failed to parse message', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('StreamingCanvas: WebSocket error', error);
      setIsStreaming(false);
    };
    
    ws.onclose = () => {
      console.log('StreamingCanvas: WebSocket disconnected');
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
