/**
 * ClarifyCard Component
 *
 * Displays a clarification question from the agent with input options.
 * Features amber glow visual treatment and auto-focus input.
 */

import { useState, useEffect, useRef } from "react";
import { HelpCircle, Clock, Send } from "lucide-react";
import type { ClarifyQuestion, ClarifyOption } from "../../lib/agent/types";
import { cn } from "../../lib/utils";

interface ClarifyCardProps {
  question: ClarifyQuestion;
  onSubmit: (answer: string) => void;
  onTimeout?: () => void;
  className?: string;
}

export function ClarifyCard({ question, onSubmit, onTimeout, className }: ClarifyCardProps) {
  const [answer, setAnswer] = useState(question.defaultValue || "");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(question.timeoutSeconds || 60);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!question.timeoutSeconds) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [question.timeoutSeconds, onTimeout]);

  const handleSubmit = () => {
    if (question.type === "multi-choice") {
      onSubmit(selectedOptions.join(","));
    } else if (question.type === "choice") {
      onSubmit(selectedOptions[0] || "");
    } else {
      onSubmit(answer);
    }
  };

  const handleOptionClick = (value: string) => {
    if (question.type === "multi-choice") {
      setSelectedOptions((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else {
      setSelectedOptions([value]);
      // Auto-submit for single choice
      if (question.type === "choice") {
        setTimeout(() => onSubmit(value), 150);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isValid = question.required
    ? question.type === "text" || question.type === "confirm"
      ? answer.trim().length > 0
      : selectedOptions.length > 0
    : true;

  return (
    <div
      className={cn(
        "relative rounded-xl border p-5",
        "bg-amber-500/5 border-amber-500/20",
        "shadow-[0_0_20px_rgba(245,158,11,0.1)]",
        "animate-fade-in",
        className
      )}
      role="dialog"
      aria-labelledby="clarify-question"
    >
      {/* Amber glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 id="clarify-question" className="text-base font-semibold text-white mb-1">
            {question.question}
          </h3>
          {question.context && <p className="text-sm text-gray-400">{question.context}</p>}
        </div>
        {question.timeoutSeconds && (
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs",
              timeRemaining <= 10 ? "text-red-400" : "text-gray-500"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{timeRemaining}s</span>
          </div>
        )}
      </div>

      {/* Input based on type */}
      <div className="relative space-y-3">
        {(question.type === "text" || question.type === "confirm") && (
          <div className="relative">
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                question.type === "confirm"
                  ? "Type 'yes' to confirm or 'no' to cancel..."
                  : "Type your answer..."
              }
              className={cn(
                "w-full px-4 py-3 rounded-lg",
                "bg-gray-800/50 border border-gray-700",
                "text-white placeholder-gray-500",
                "focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50",
                "resize-none min-h-[80px]"
              )}
              rows={3}
            />
          </div>
        )}

        {(question.type === "choice" || question.type === "multi-choice") && question.options && (
          <div className="space-y-2">
            {question.options.map((option) => (
              <OptionButton
                key={option.value}
                option={option}
                isSelected={selectedOptions.includes(option.value)}
                onClick={() => handleOptionClick(option.value)}
                isMulti={question.type === "multi-choice"}
              />
            ))}
          </div>
        )}

        {/* Submit button */}
        {question.type !== "choice" && (
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "text-sm font-medium transition-all duration-150",
                isValid
                  ? "bg-amber-500 hover:bg-amber-400 text-black"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              )}
            >
              <Send className="w-4 h-4" />
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface OptionButtonProps {
  option: ClarifyOption;
  isSelected: boolean;
  onClick: () => void;
  isMulti: boolean;
}

function OptionButton({ option, isSelected, onClick, isMulti }: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg text-left",
        "border transition-all duration-150",
        isSelected
          ? "bg-amber-500/10 border-amber-500/50 text-white"
          : "bg-gray-800/30 border-gray-700 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center",
          isMulti ? "rounded" : "rounded-full",
          isSelected ? "border-amber-500 bg-amber-500" : "border-gray-600"
        )}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 12 12">
            <path d="M10.28 2.28L4 8.56 1.72 6.28a.75.75 0 00-1.06 1.06l3 3a.75.75 0 001.06 0l7-7a.75.75 0 00-1.06-1.06z" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{option.label}</div>
        {option.description && (
          <div className="text-sm text-gray-500 mt-0.5">{option.description}</div>
        )}
      </div>
    </button>
  );
}

export default ClarifyCard;
