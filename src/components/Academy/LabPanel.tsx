/**
 * Lab Panel Component
 * 
 * Split-screen view for Agent Labs.
 * Left side: Instructions and guidance
 * Right side: Interactive agent chat for simulations
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Clock,
  Target,
  MessageSquare,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
} from 'lucide-react';
import { LabConfiguration, LabSuccessCriterion } from '../../types/academy';

// ============================================================================
// Types
// ============================================================================

interface LabPanelProps {
  title: string;
  description: string;
  labConfig: LabConfiguration;
  instructions: string[];
  tips?: string[];
  onComplete: (success: boolean, score: number, transcript: LabMessage[]) => void;
}

interface LabMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
}

interface CriterionStatus extends LabSuccessCriterion {
  met: boolean;
  evidence?: string;
}

type LabStatus = 'ready' | 'active' | 'paused' | 'completed' | 'failed';

// ============================================================================
// Component
// ============================================================================

export const LabPanel: React.FC<LabPanelProps> = ({
  title,
  description,
  labConfig,
  instructions,
  tips = [],
  onComplete,
}) => {
  // State
  const [status, setStatus] = useState<LabStatus>('ready');
  const [messages, setMessages] = useState<LabMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [criteriaStatus, setCriteriaStatus] = useState<CriterionStatus[]>(
    labConfig.successCriteria.map(c => ({ ...c, met: false }))
  );
  const [attempts, setAttempts] = useState(0);
  const [showTips, setShowTips] = useState(false);
  const [expandedInstructions, setExpandedInstructions] = useState(true);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Timer management
  useEffect(() => {
    if (status === 'active') {
      timerRef.current = setInterval(() => {
        setTimeElapsed(t => {
          const newTime = t + 1;
          // Check timeout
          if (newTime >= labConfig.timeoutMinutes * 60) {
            handleTimeout();
          }
          return newTime;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleStart = () => {
    setStatus('active');
    setAttempts(a => a + 1);
    
    // Add system message
    const systemMessage: LabMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: `Lab started. You have ${labConfig.timeoutMinutes} minutes to complete this exercise.`,
      timestamp: new Date(),
    };
    
    // Add initial agent message based on scenario
    const agentGreeting: LabMessage = {
      id: crypto.randomUUID(),
      role: 'agent',
      content: getAgentGreeting(),
      timestamp: new Date(),
    };
    
    setMessages([systemMessage, agentGreeting]);
  };

  const handlePause = () => {
    setStatus(status === 'paused' ? 'active' : 'paused');
  };

  const handleReset = () => {
    setStatus('ready');
    setMessages([]);
    setTimeElapsed(0);
    setCriteriaStatus(labConfig.successCriteria.map(c => ({ ...c, met: false })));
    setInput('');
  };

  const handleTimeout = () => {
    setStatus('failed');
    const systemMessage: LabMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: 'Time expired. Lab failed.',
      timestamp: new Date(),
    };
    setMessages(m => [...m, systemMessage]);
  };

  const handleSend = async () => {
    if (!input.trim() || status !== 'active' || isTyping) return;

    const userMessage: LabMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(m => [...m, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Simulate agent response (would be real LLM call in production)
      const response = await simulateAgentResponse(userMessage.content, messages);
      
      const agentMessage: LabMessage = {
        id: crypto.randomUUID(),
        role: 'agent',
        content: response.content,
        timestamp: new Date(),
      };

      setMessages(m => [...m, agentMessage]);

      // Check criteria after each exchange
      const updatedCriteria = await evaluateCriteria(
        [...messages, userMessage, agentMessage],
        criteriaStatus
      );
      setCriteriaStatus(updatedCriteria);

      // Check if all criteria met
      if (updatedCriteria.every(c => c.met)) {
        handleSuccess(updatedCriteria);
      }
    } catch (error) {
      console.error('Agent response error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuccess = (finalCriteria: CriterionStatus[]) => {
    setStatus('completed');
    
    const score = calculateScore(finalCriteria);
    const systemMessage: LabMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: `Congratulations! Lab completed successfully with a score of ${score}%.`,
      timestamp: new Date(),
    };
    
    setMessages(m => [...m, systemMessage]);
    onComplete(true, score, messages);
  };

  const handleFinish = () => {
    const score = calculateScore(criteriaStatus);
    const success = criteriaStatus.filter(c => c.met).length >= criteriaStatus.length * 0.6;
    
    setStatus(success ? 'completed' : 'failed');
    onComplete(success, score, messages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getAgentGreeting = (): string => {
    switch (labConfig.agentType) {
      case 'discovery':
        return "Hello, I'm the CFO at TechCorp Industries. I understand you wanted to discuss how your solution might help our business. I have to be upfront - we've looked at several vendors already and I'm skeptical about the ROI claims I keep hearing. What makes your approach different?";
      case 'kpi':
        return "Welcome to the ROI Modeling Lab. I'll be reviewing your assumptions and calculations. Let's start by discussing the baseline metrics you've gathered. What's the current state you're measuring against?";
      case 'integrity':
        return "I'm the Integrity Agent. I'll be evaluating your Value Commit for compliance with our conservative modeling standards. Please walk me through your key assumptions and how you derived them.";
      case 'realization':
        return "It's time for our quarterly business review. I'm looking at the original Value Commit from 6 months ago. The projected savings were $2.4M annually. Let's review what we've actually achieved and address any variance.";
      default:
        return "Hello! I'm ready to begin this lab exercise. How would you like to proceed?";
    }
  };

  const simulateAgentResponse = async (
    userInput: string,
    _history: LabMessage[]
  ): Promise<{ content: string }> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));

    // In production, this would call the actual LLM with the lab's system prompt
    // For now, return contextual responses based on agent type and keywords
    
    const input = userInput.toLowerCase();
    
    if (labConfig.agentType === 'discovery') {
      if (input.includes('pain') || input.includes('challenge') || input.includes('problem')) {
        return {
          content: "That's an interesting question. Our biggest challenge right now is the disconnect between our sales forecasting and actual pipeline conversion. We're seeing about 40% slippage quarter over quarter. What specifically do you think causes that kind of variance?"
        };
      }
      if (input.includes('budget') || input.includes('cost') || input.includes('invest')) {
        return {
          content: "Budget is always tight, but if something genuinely moves the needle, we find the money. The real question is proving ROI within 6 months. Our board has zero patience for long payback periods. How have other companies in our industry measured success with your approach?"
        };
      }
      if (input.includes('decision') || input.includes('stakeholder') || input.includes('team')) {
        return {
          content: "For anything over $100K, it goes to our executive committee - that's myself, the CEO, and our VP of Sales. They'll want to see hard numbers, not just promises. The VP of Sales is particularly skeptical of new tools after our last CRM implementation went sideways."
        };
      }
      return {
        content: "I appreciate you asking that. Let me think... Honestly, I need to see concrete evidence this will work for a company our size. We're not a Fortune 500 with unlimited resources to experiment. Can you give me a specific example of how you've helped a similar company?"
      };
    }

    if (labConfig.agentType === 'integrity') {
      if (input.includes('conservative') || input.includes('assumption')) {
        return {
          content: "I see you've used a 15% improvement rate. Our benchmark data suggests 8-12% is more typical for first-year implementations. Can you justify the higher figure with customer-specific evidence, or should we adjust to the conservative range?"
        };
      }
      if (input.includes('baseline') || input.includes('current state')) {
        return {
          content: "The baseline looks reasonable, but I notice you're using self-reported data from the customer. Have you validated this against their actual system metrics? Self-reported baselines tend to be 20-30% optimistic."
        };
      }
      return {
        content: "Walk me through your methodology for this calculation. I want to understand the logic chain from input to projected outcome."
      };
    }

    return {
      content: "That's a good point. Tell me more about how you arrived at that conclusion."
    };
  };

  const evaluateCriteria = async (
    allMessages: LabMessage[],
    currentStatus: CriterionStatus[]
  ): Promise<CriterionStatus[]> => {
    // In production, use LLM to evaluate criteria
    // For now, use keyword matching
    
    const userMessages = allMessages
      .filter(m => m.role === 'user')
      .map(m => m.content.toLowerCase())
      .join(' ');

    return currentStatus.map(criterion => {
      if (criterion.met) return criterion;

      // Simple keyword-based evaluation
      let met = false;
      let evidence = '';

      if (criterion.description.toLowerCase().includes('pain point')) {
        met = userMessages.includes('challenge') || 
              userMessages.includes('problem') || 
              userMessages.includes('pain');
        evidence = 'Asked about challenges/problems';
      }
      
      if (criterion.description.toLowerCase().includes('budget')) {
        met = userMessages.includes('budget') || 
              userMessages.includes('invest') ||
              userMessages.includes('cost');
        evidence = 'Discussed budget constraints';
      }
      
      if (criterion.description.toLowerCase().includes('decision')) {
        met = userMessages.includes('decision') || 
              userMessages.includes('stakeholder') ||
              userMessages.includes('approve');
        evidence = 'Mapped decision process';
      }

      if (criterion.description.toLowerCase().includes('baseline')) {
        met = userMessages.includes('baseline') || 
              userMessages.includes('current') ||
              userMessages.includes('today');
        evidence = 'Established baseline metrics';
      }

      return { ...criterion, met, evidence: met ? evidence : undefined };
    });
  };

  const calculateScore = (criteria: CriterionStatus[]): number => {
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    const earnedWeight = criteria
      .filter(c => c.met)
      .reduce((sum, c) => sum + c.weight, 0);
    return Math.round((earnedWeight / totalWeight) * 100);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex h-full bg-[#121212] rounded-xl overflow-hidden border border-gray-800">
      {/* Left Panel: Instructions */}
      <div className="w-[400px] flex-shrink-0 border-r border-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-sm text-gray-400 mt-1">{description}</p>
        </div>

        {/* Status Bar */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className={`font-mono text-sm ${
              timeElapsed > labConfig.timeoutMinutes * 60 * 0.8 
                ? 'text-red-400' 
                : 'text-gray-300'
            }`}>
              {formatTime(timeElapsed)} / {labConfig.timeoutMinutes}:00
            </span>
          </div>
          <div className="flex items-center gap-1">
            {status === 'ready' && (
              <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                Ready
              </span>
            )}
            {status === 'active' && (
              <span className="px-2 py-0.5 rounded text-xs bg-[#39FF14]/20 text-[#39FF14]">
                Active
              </span>
            )}
            {status === 'paused' && (
              <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
                Paused
              </span>
            )}
            {status === 'completed' && (
              <span className="px-2 py-0.5 rounded text-xs bg-[#39FF14]/20 text-[#39FF14]">
                Completed
              </span>
            )}
            {status === 'failed' && (
              <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                Failed
              </span>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => setExpandedInstructions(!expandedInstructions)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-800/50"
          >
            <span className="text-sm font-medium text-white">Instructions</span>
            {expandedInstructions ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          
          {expandedInstructions && (
            <div className="px-4 pb-4 space-y-2">
              {instructions.map((instruction, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="text-[#39FF14] flex-shrink-0">{i + 1}.</span>
                  <span className="text-gray-300">{instruction}</span>
                </div>
              ))}
            </div>
          )}

          {/* Success Criteria */}
          <div className="px-4 py-3 border-t border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-[#39FF14]" />
              <span className="text-sm font-medium text-white">Success Criteria</span>
            </div>
            <div className="space-y-2">
              {criteriaStatus.map((criterion) => (
                <div
                  key={criterion.id}
                  className={`flex items-start gap-2 text-sm p-2 rounded ${
                    criterion.met 
                      ? 'bg-[#39FF14]/10 border border-[#39FF14]/30' 
                      : 'bg-gray-800/50'
                  }`}
                >
                  {criterion.met ? (
                    <CheckCircle className="w-4 h-4 text-[#39FF14] flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className={criterion.met ? 'text-[#39FF14]' : 'text-gray-400'}>
                      {criterion.description}
                    </span>
                    {criterion.evidence && (
                      <p className="text-xs text-gray-500 mt-0.5">{criterion.evidence}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          {tips.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-800">
              <button
                onClick={() => setShowTips(!showTips)}
                className="flex items-center gap-2 text-sm text-yellow-400 hover:text-yellow-300"
              >
                <Lightbulb className="w-4 h-4" />
                <span>{showTips ? 'Hide Tips' : 'Show Tips'}</span>
              </button>
              
              {showTips && (
                <div className="mt-2 space-y-2">
                  {tips.map((tip, i) => (
                    <p key={i} className="text-sm text-gray-400 pl-6">
                      • {tip}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-gray-800 flex gap-2">
          {status === 'ready' && (
            <button
              onClick={handleStart}
              disabled={attempts >= labConfig.maxAttempts}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#39FF14] text-black font-medium rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Start Lab
            </button>
          )}
          
          {(status === 'active' || status === 'paused') && (
            <>
              <button
                onClick={handlePause}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                {status === 'paused' ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <Pause className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500"
              >
                Finish Early
              </button>
            </>
          )}
          
          {(status === 'completed' || status === 'failed') && (
            <>
              {attempts < labConfig.maxAttempts && (
                <button
                  onClick={handleReset}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again ({labConfig.maxAttempts - attempts} left)
                </button>
              )}
              <button
                onClick={() => onComplete(status === 'completed', calculateScore(criteriaStatus), messages)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#39FF14] text-black font-medium rounded-lg hover:bg-[#39FF14]/90"
              >
                Continue
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right Panel: Chat */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#39FF14] to-[#00D4FF] flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-black" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">
              {labConfig.agentType === 'discovery' && 'Discovery Agent - CFO Roleplay'}
              {labConfig.agentType === 'kpi' && 'KPI Agent - ROI Modeling'}
              {labConfig.agentType === 'integrity' && 'Integrity Agent - Value Commit Review'}
              {labConfig.agentType === 'realization' && 'Realization Agent - QBR Simulation'}
            </h3>
            <p className="text-xs text-gray-400">{labConfig.scenario}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {status === 'ready' ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Click "Start Lab" to begin the simulation</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-[#39FF14]/20 text-white'
                        : message.role === 'system'
                        ? 'bg-gray-800 text-gray-400 text-sm italic'
                        : 'bg-gray-800 text-gray-200'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    <span className="text-gray-400 text-sm">Agent is typing...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                status === 'active' 
                  ? "Type your response..." 
                  : status === 'paused'
                  ? "Lab paused..."
                  : "Start the lab to begin..."
              }
              disabled={status !== 'active'}
              rows={2}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-[#39FF14]/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={status !== 'active' || !input.trim() || isTyping}
              className="px-4 bg-[#39FF14] text-black rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};

export default LabPanel;
