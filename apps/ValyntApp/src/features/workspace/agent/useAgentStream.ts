/**
 * useAgentStream Hook
 * 
 * Connects the agent API to the UI store.
 * Handles both real API calls and mock fallback.
 * Optionally persists artifacts to the backend.
 */

import { useCallback, useRef } from 'react';
import { useAgentStore } from './store';
import { generateMockAgentStream } from './mock-stream';
import {
  createErrorEvent,
  createPhaseChangeEvent,
} from './api-adapter';
import type { AgentPhase, AgentEvent, Artifact } from './types';
import { llmService, AVAILABLE_MODELS } from '@/services/llm';
import { artifactsService } from '@/services/artifacts';

// Configuration
const USE_MOCK_API = true; // Toggle this to switch between mock and real API
const API_TIMEOUT = 30000; // 30 seconds

// Generate unique IDs
const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

interface UseAgentStreamOptions {
  /** Use mock API instead of real backend */
  useMock?: boolean;
  /** Company name for context */
  companyName?: string;
  /** Value case ID for artifact persistence */
  valueCaseId?: string;
  /** Whether to persist artifacts to the backend */
  persistArtifacts?: boolean;
  /** Callback when stream completes */
  onComplete?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Callback when artifact is persisted */
  onArtifactPersisted?: (artifact: Artifact, persistedId: string) => void;
}

interface AgentStreamResult {
  /** Send a message to the agent */
  sendMessage: (message: string) => Promise<void>;
  /** Cancel the current stream */
  cancel: () => void;
  /** Whether a stream is currently active */
  isStreaming: boolean;
}

/**
 * Hook to manage agent streaming interactions
 */
export function useAgentStream(options: UseAgentStreamOptions = {}): AgentStreamResult {
  const { 
    useMock = USE_MOCK_API, 
    companyName = 'Target Company',
    valueCaseId,
    persistArtifacts = false,
    onComplete,
    onError,
    onArtifactPersisted,
  } = options;

  const abortControllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);
  const pendingArtifactsRef = useRef<Artifact[]>([]);

  const {
    phase,
    messages,
    isStreaming,
    processEvent,
    sendMessage: storeAddMessage,
    startRun,
    cancelRun,
  } = useAgentStore();

  /**
   * Persist artifacts to the backend
   */
  const persistArtifactsToBackend = useCallback(async (artifacts: Artifact[]) => {
    if (!persistArtifacts || artifacts.length === 0) return;

    try {
      const requests = artifacts.map(artifact => 
        artifactsService.toCreateRequest(artifact, valueCaseId)
      );

      const persisted = await artifactsService.createBatch(valueCaseId, requests);
      
      // Notify about each persisted artifact
      persisted.forEach((p, index) => {
        const original = artifacts[index];
        if (original) {
          onArtifactPersisted?.(original, p.id);
        }
      });

      console.log(`Persisted ${persisted.length} artifacts to backend`);
    } catch (error) {
      console.error('Failed to persist artifacts:', error);
      // Don't throw - artifact persistence failure shouldn't break the UI flow
    }
  }, [persistArtifacts, valueCaseId, onArtifactPersisted]);

  /**
   * Send message using mock API
   */
  const sendWithMock = useCallback(async (message: string) => {
    const runId = `run_${Date.now()}`;
    runIdRef.current = runId;
    pendingArtifactsRef.current = [];
    startRun(runId);

    try {
      // Wrap processEvent to capture artifacts
      const wrappedProcessEvent = (event: AgentEvent) => {
        if (event.type === 'artifact_proposed') {
          pendingArtifactsRef.current.push(event.payload.artifact);
        }
        processEvent(event);
      };

      await generateMockAgentStream(
        message,
        wrappedProcessEvent,
        { 
          companyName, 
          includeClarify: messages.length === 0,
          eventDelay: 200,
        }
      );

      // Persist collected artifacts
      await persistArtifactsToBackend(pendingArtifactsRef.current);
      
      onComplete?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      processEvent(createErrorEvent(err, runId));
      onError?.(err);
    }
  }, [companyName, messages.length, processEvent, startRun, onComplete, onError, persistArtifactsToBackend]);

  /**
   * Send message using real LLM API via Together.ai
   */
  const sendWithRealAPI = useCallback(async (message: string) => {
    const runId = `run_${Date.now()}`;
    runIdRef.current = runId;
    pendingArtifactsRef.current = [];
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    startRun(runId);

    // Emit initial phase change
    processEvent(createPhaseChangeEvent('idle', 'execute', runId, 'Processing query'));

    try {
      // Check if LLM service has direct API access
      if (!llmService.hasDirectAccess()) {
        console.warn('VITE_TOGETHER_API_KEY not configured, falling back to mock');
        await generateMockAgentStream(
          message,
          processEvent,
          { 
            companyName, 
            includeClarify: messages.length === 0,
            eventDelay: 200,
          }
        );
        onComplete?.();
        return;
      }

      // Build the prompt for value case generation
      const systemPrompt = `You are a value engineering expert helping build business value cases. 
The company context is: ${companyName}

When asked to build a value case, respond with a structured JSON object containing:
1. A value_model with value drivers and metrics
2. An executive_summary with key insights
3. Financial projections if relevant

Format your response as valid JSON with this structure:
{
  "artifacts": [
    {
      "type": "value_model",
      "title": "Value Model for [Company]",
      "data": {
        "valueDrivers": [
          { "name": "Driver Name", "category": "revenue|cost|risk", "impact": "high|medium|low", "value": 0 }
        ],
        "totalValue": 0,
        "confidence": 0.8
      }
    },
    {
      "type": "executive_summary", 
      "title": "Executive Summary",
      "markdown": "## Summary\\n\\nKey insights here..."
    }
  ],
  "message": "Brief explanation of the value case"
}`;

      const fullPrompt = `${systemPrompt}\n\nUser request: ${message}`;

      // Emit progress checkpoint
      processEvent({
        id: generateId(),
        type: 'checkpoint_created',
        timestamp: Date.now(),
        runId,
        payload: {
          checkpointId: generateId(),
          label: 'Analyzing request with AI...',
          progress: 0.3,
          canRestore: false,
        },
      });

      // Call the LLM service
      const response = await llmService.chat({
        prompt: fullPrompt,
        model: AVAILABLE_MODELS.MIXTRAL_8X7B,
        maxTokens: 2000,
        temperature: 0.7,
      });

      if (signal.aborted) return;

      // Emit progress checkpoint
      processEvent({
        id: generateId(),
        type: 'checkpoint_created',
        timestamp: Date.now(),
        runId,
        payload: {
          checkpointId: generateId(),
          label: 'Processing AI response...',
          progress: 0.7,
          canRestore: false,
        },
      });

      // Try to parse the response as JSON
      let parsedResponse: { artifacts?: Array<{ type: string; title: string; data?: unknown; markdown?: string }>; message?: string } | null = null;
      try {
        // Extract JSON from the response (it might be wrapped in markdown code blocks)
        const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/) || 
                          response.content.match(/```\s*([\s\S]*?)\s*```/) ||
                          [null, response.content];
        const jsonStr = jsonMatch[1] || response.content;
        parsedResponse = JSON.parse(jsonStr.trim());
      } catch {
        // If JSON parsing fails, treat the response as a narrative
        parsedResponse = null;
      }

      if (parsedResponse?.artifacts && Array.isArray(parsedResponse.artifacts)) {
        // Process each artifact
        for (const artifactData of parsedResponse.artifacts) {
          const artifact: Artifact = {
            id: generateId(),
            type: artifactData.type as Artifact['type'],
            title: artifactData.title || 'Generated Artifact',
            status: 'proposed',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            content: artifactData.markdown 
              ? { kind: 'markdown', markdown: artifactData.markdown }
              : { kind: 'json', data: (artifactData.data || artifactData) as Record<string, unknown> },
            source: { agentRunId: runId },
          };

          pendingArtifactsRef.current.push(artifact);

          processEvent({
            id: generateId(),
            type: 'artifact_proposed',
            timestamp: Date.now(),
            runId,
            payload: { artifact },
          });
        }

        // Add the message
        if (parsedResponse.message) {
          processEvent({
            id: generateId(),
            type: 'message_delta',
            timestamp: Date.now(),
            runId,
            payload: {
              messageId: generateId(),
              delta: parsedResponse.message,
              done: true,
            },
          });
        }
      } else {
        // Treat the entire response as a narrative artifact
        const artifact: Artifact = {
          id: generateId(),
          type: 'narrative',
          title: `Value Analysis for ${companyName}`,
          status: 'proposed',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          content: {
            kind: 'markdown',
            markdown: response.content,
          },
          source: { agentRunId: runId },
        };

        pendingArtifactsRef.current.push(artifact);

        processEvent({
          id: generateId(),
          type: 'artifact_proposed',
          timestamp: Date.now(),
          runId,
          payload: { artifact },
        });

        processEvent({
          id: generateId(),
          type: 'message_delta',
          timestamp: Date.now(),
          runId,
          payload: {
            messageId: generateId(),
            delta: 'I\'ve generated a value analysis based on your request.',
            done: true,
          },
        });
      }

      // Persist collected artifacts to backend
      await persistArtifactsToBackend(pendingArtifactsRef.current);

      // Emit completion
      processEvent(createPhaseChangeEvent('execute', 'review', runId, 'Analysis complete'));
      onComplete?.();

    } catch (error) {
      if (signal.aborted) return;

      const err = error instanceof Error ? error : new Error(String(error));
      console.error('LLM API error:', err);
      processEvent(createErrorEvent(err, runId));
      onError?.(err);
    }
  }, [companyName, messages.length, processEvent, startRun, onComplete, onError, persistArtifactsToBackend]);

  /**
   * Main send message function
   */
  const sendMessage = useCallback(async (message: string) => {
    if (isStreaming) {
      console.warn('Already streaming, ignoring message');
      return;
    }

    // Add user message to store
    storeAddMessage(message);

    // Use mock or real API
    if (useMock) {
      await sendWithMock(message);
    } else {
      await sendWithRealAPI(message);
    }
  }, [isStreaming, useMock, storeAddMessage, sendWithMock, sendWithRealAPI]);

  /**
   * Cancel current stream
   */
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    cancelRun();
  }, [cancelRun]);

  return {
    sendMessage,
    cancel,
    isStreaming,
  };
}

export default useAgentStream;
