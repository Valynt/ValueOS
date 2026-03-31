/**
 * AIChatPanel Component
 *
 * Right sidebar chat interface for AI assistant interactions.
 * Used in executive layout for real-time agent conversations.
 */

import { forwardRef, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { PrismCard } from './PrismCard';
import { MaterialIcon } from './MaterialIcon';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    agentId?: string;
    confidence?: number;
    actions?: Array<{
      label: string;
      action: string;
    }>;
    tokensUsed?: number;
    responseTimeMs?: number;
  };
}

export interface AIChatPanelProps {
  /** Chat messages */
  messages: ChatMessage[];
  /** Current user input value */
  inputValue?: string;
  /** Loading state */
  isLoading?: boolean;
  /** AI online status */
  isOnline?: boolean;
  /** Panel title */
  title?: string;
  /** Subtitle (e.g., "AI Online") */
  subtitle?: string;
  /** Quick action buttons */
  quickActions?: Array<{
    label: string;
    icon: string;
    action: () => void;
  }>;
  /** Send message handler */
  onSendMessage?: (message: string) => void;
  /** Input change handler */
  onInputChange?: (value: string) => void;
  /** Close/minimize handler */
  onClose?: () => void;
  /** CSS classes */
  className?: string;
}

export const AIChatPanel = forwardRef<HTMLDivElement, AIChatPanelProps>(
  ({
    messages,
    inputValue = '',
    isLoading = false,
    isOnline = true,
    title = 'Value Analyst',
    subtitle = 'AI Online',
    quickActions,
    onSendMessage,
    onInputChange,
    onClose,
    className,
  }, ref) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
      if (inputValue.trim() && !isLoading && onSendMessage) {
        onSendMessage(inputValue.trim());
        onInputChange?.('');
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          'w-[380px] flex-shrink-0 bg-md-surface-container-lowest',
          'border-l border-md-outline-variant',
          'flex flex-col h-full overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <div className="p-6 bg-md-surface-container-low border-b border-md-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <MaterialIcon icon="smart_toy" size="lg" className="text-md-tertiary-container" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-md-on-surface uppercase tracking-wider">
                {title}
              </h3>
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isOnline ? 'bg-emerald-500' : 'bg-red-500'
                )} />
                {isOnline ? subtitle : 'AI Offline'}
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-md-outline hover:text-md-on-surface transition-colors"
              aria-label="Close panel"
            >
              <MaterialIcon icon="close" size="sm" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-8 text-md-on-surface-variant">
              <MaterialIcon icon="chat" size="xl" className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">Start a conversation with your AI assistant</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm border',
                message.role === 'user'
                  ? 'bg-md-primary-container text-white border-transparent'
                  : 'bg-md-surface-container-high text-md-tertiary-container border-md-outline-variant'
              )}>
                <MaterialIcon
                  icon={message.role === 'user' ? 'person' : 'smart_toy'}
                  size="sm"
                  filled={message.role === 'user'}
                />
              </div>

              {/* Content */}
              <div className={cn(
                'max-w-[calc(100%-48px)]',
                message.role === 'user' ? 'text-right' : 'text-left'
              )}>
                <div className={cn(
                  'p-4 rounded-xl text-xs leading-relaxed shadow-sm border',
                  message.role === 'user'
                    ? 'bg-md-primary-container text-white border-transparent'
                    : 'bg-md-surface-container-high text-md-on-surface border-md-outline-variant'
                )}>
                  {message.content}

                  {/* Action buttons for assistant messages */}
                  {message.role === 'assistant' && message.metadata?.actions && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {message.metadata.actions.map((action, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            // Handle action
                            console.log('Action:', action.action);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-md-outline-variant text-[10px] font-bold text-md-on-surface-variant hover:bg-md-surface-container-high transition-colors"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <span className="text-[10px] text-md-outline mt-1 inline-block">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-md-surface-container-high border border-md-outline-variant flex items-center justify-center">
                <MaterialIcon icon="smart_toy" size="sm" className="text-md-tertiary-container" />
              </div>
              <div className="flex items-center gap-1 p-4">
                <span className="w-2 h-2 bg-md-tertiary-container rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-md-tertiary-container rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-md-tertiary-container rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions */}
        {quickActions && quickActions.length > 0 && (
          <div className="px-6 py-3 border-t border-md-outline-variant flex gap-2 overflow-x-auto">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                type="button"
                onClick={action.action}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-md-surface-container-high hover:bg-md-surface-container rounded-lg text-[10px] font-bold text-md-on-surface-variant transition-colors whitespace-nowrap"
              >
                <MaterialIcon icon={action.icon} size="sm" />
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-6 bg-md-surface-container-lowest border-t border-md-outline-variant">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => onInputChange?.(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about FY25 projections..."
              rows={3}
              className={cn(
                'w-full bg-md-surface-container-high rounded-xl px-4 py-3 pr-12',
                'border border-md-outline-variant focus:border-md-tertiary-container',
                'text-xs text-md-on-surface placeholder:text-md-outline',
                'resize-none focus:outline-none focus:ring-0',
                'transition-colors'
              )}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className={cn(
                'absolute bottom-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center',
                'bg-md-tertiary-container text-white shadow-lg shadow-violet-500/20',
                'hover:bg-violet-700 transition-colors',
                (!inputValue.trim() || isLoading) && 'opacity-50 cursor-not-allowed'
              )}
              aria-label="Send message"
            >
              <MaterialIcon icon="send" size="sm" />
            </button>
          </div>

          {/* Input actions */}
          <div className="mt-4 flex justify-center gap-4">
            <button
              type="button"
              className="text-[10px] font-bold text-md-outline hover:text-md-on-surface transition-colors flex items-center gap-1"
            >
              <MaterialIcon icon="history" size="sm" />
              History
            </button>
            <div className="w-px h-3 bg-md-outline-variant" />
            <button
              type="button"
              className="text-[10px] font-bold text-md-outline hover:text-md-on-surface transition-colors flex items-center gap-1"
            >
              <MaterialIcon icon="mic" size="sm" />
              Voice
            </button>
          </div>
        </div>
      </div>
    );
  }
);

AIChatPanel.displayName = 'AIChatPanel';
