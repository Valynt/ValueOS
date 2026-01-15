/**
 * CaseWorkspace - Split-pane workspace for value cases
 * 
 * Left: Conversation panel with agent messages
 * Right: Canvas with Builder/Presenter/Tracker modes
 */

import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Circle,
  PlayCircle,
  ExternalLink,
  Edit2,
  Clock,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Types
type ViewMode = "builder" | "presenter" | "tracker";
type StepStatus = "completed" | "running" | "pending";

interface Message {
  id: string;
  role: "agent" | "user";
  content: string;
  reasoning?: string;
  options?: string[];
  selectedOption?: string;
}

interface WorkflowStep {
  id: string;
  label: string;
  status: StepStatus;
  progress?: number;
}

interface Assumption {
  id: string;
  label: string;
  value: string | number;
  verified: boolean;
}

// Mock data
const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "agent",
    content: "I've analyzed Acme Corp's latest 10-K filing. They have 2,400 employees and approximately $340M in annual revenue.",
    reasoning: "Extracted from Page 12, Item 6: Selected Financial Data.",
  },
  {
    id: "2",
    role: "agent",
    content: "Based on their industry (SaaS) and size, I recommend targeting a 15% efficiency gain in the sales organization.",
    options: ["10% (Conservative)", "15% (Recommended)", "20% (Aggressive)"],
  },
];

const INITIAL_STEPS: WorkflowStep[] = [
  { id: "1", label: "Research company", status: "completed" },
  { id: "2", label: "Identify drivers", status: "completed" },
  { id: "3", label: "Calculate ROI", status: "running", progress: 65 },
  { id: "4", label: "Generate summary", status: "pending" },
];

const INITIAL_ASSUMPTIONS: Assumption[] = [
  { id: "1", label: "Employees", value: 2400, verified: true },
  { id: "2", label: "Revenue", value: "$340M", verified: true },
  { id: "3", label: "Efficiency", value: "15%", verified: false },
];

// Chart data based on efficiency selection
const CHART_DATA = {
  "10%": [1.2, 1.45, 1.8],
  "15%": [1.8, 2.175, 2.7],
  "20%": [2.4, 2.9, 3.6],
};

export function CaseWorkspace() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<ViewMode>("builder");
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [steps, setSteps] = useState<WorkflowStep[]>(INITIAL_STEPS);
  const [assumptions, setAssumptions] = useState<Assumption[]>(INITIAL_ASSUMPTIONS);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedEfficiency, setSelectedEfficiency] = useState<string>("15%");
  const [chartData, setChartData] = useState(CHART_DATA["15%"]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Handle option selection
  const handleOptionSelect = (messageId: string, option: string) => {
    // Update message with selection
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, selectedOption: option } : m
      )
    );

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: option,
    };
    setMessages((prev) => [...prev, userMsg]);

    // Simulate agent response
    setIsTyping(true);
    setTimeout(() => {
      // Update efficiency
      const effValue = option.split("%")[0] + "%";
      setSelectedEfficiency(effValue);
      setChartData(CHART_DATA[effValue as keyof typeof CHART_DATA] || CHART_DATA["15%"]);

      // Update assumptions
      setAssumptions((prev) =>
        prev.map((a) =>
          a.label === "Efficiency" ? { ...a, value: effValue, verified: true } : a
        )
      );

      // Update workflow
      setSteps((prev) =>
        prev.map((s) => {
          if (s.id === "3") return { ...s, status: "completed" as StepStatus, progress: 100 };
          if (s.id === "4") return { ...s, status: "running" as StepStatus, progress: 30 };
          return s;
        })
      );

      // Add agent response
      const responseMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: `Got it. I've updated the model with a ${effValue} efficiency target. Your projected 3-year ROI has been recalculated.`,
        reasoning: "Recalculating cash flows based on updated efficiency driver.",
      };
      setMessages((prev) => [...prev, responseMsg]);
      setIsTyping(false);
    }, 1500);
  };

  // Handle send message
  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    setIsTyping(true);
    setTimeout(() => {
      const responseMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: "I understand. Let me analyze that for you...",
      };
      setMessages((prev) => [...prev, responseMsg]);
      setIsTyping(false);
    }, 1000);
  };

  // Calculate totals
  const totalROI = chartData.reduce((a, b) => a + b, 0).toFixed(1);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="h-14 border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/app/cases")}
            className="p-1 hover:bg-slate-100 rounded text-slate-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Cases</span>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900">Acme Corp Value Case</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">Draft</Badge>
          <Button variant="ghost" size="sm">Share</Button>
          <Button size="sm">Export</Button>
        </div>
      </header>

      {/* Main Content - Split Pane */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Conversation Panel */}
        <div className="w-[35%] min-w-[320px] max-w-[480px] border-r border-slate-200 flex flex-col bg-slate-50">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[90%] rounded-2xl px-4 py-3 shadow-sm",
                    msg.role === "user"
                      ? "bg-primary text-white"
                      : "bg-white border border-slate-200 text-slate-800"
                  )}
                >
                  {msg.role === "agent" && (
                    <div className="text-xs font-semibold text-primary mb-1">VALUEOS AGENT</div>
                  )}
                  <div className="text-sm leading-relaxed">{msg.content}</div>

                  {msg.reasoning && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                      <span className="font-medium">Reasoning:</span> {msg.reasoning}
                    </div>
                  )}

                  {msg.options && !msg.selectedOption && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.options.map((option) => (
                        <button
                          key={option}
                          onClick={() => handleOptionSelect(msg.id, option)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-primary border border-slate-200 hover:border-primary/30 rounded-lg text-xs font-medium transition-colors"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex items-center gap-2">
              <UserAvatar name="Sarah K." size="sm" />
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask agent to research or adjust..."
                  className="w-full pl-4 pr-10 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Canvas Panel */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {/* Mode Selector */}
          <div className="flex items-center justify-between mb-6">
            <div className="bg-white p-1 rounded-lg border border-slate-200 inline-flex shadow-sm">
              {(["builder", "presenter", "tracker"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize",
                    mode === m
                      ? "bg-slate-100 text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={12} />
              <span>Auto-saved 2m ago</span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left Column: Plan + Assumptions */}
            <div className="col-span-4 space-y-6">
              {/* Plan Card */}
              <Card className="p-4 bg-white border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800">PLAN</h3>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Running</Badge>
                </div>
                <div className="space-y-3">
                  {steps.map((step) => (
                    <div key={step.id} className="flex items-center gap-3">
                      <div className="w-5 flex justify-center">
                        {step.status === "completed" && <CheckCircle2 size={18} className="text-emerald-500" />}
                        {step.status === "running" && <PlayCircle size={18} className="text-primary animate-pulse" />}
                        {step.status === "pending" && <Circle size={18} className="text-slate-300" />}
                      </div>
                      <div className="flex-1">
                        <span className={cn(
                          "text-sm",
                          step.status === "pending" ? "text-slate-400" : "text-slate-700"
                        )}>
                          {step.label}
                        </span>
                        {step.status === "running" && step.progress && (
                          <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${step.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Assumptions Card */}
              <Card className="bg-white border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assumptions</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {assumptions.map((item) => (
                    <div key={item.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 group">
                      <div>
                        <span className="text-sm text-slate-600">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                        {item.verified ? (
                          <Check size={14} className="text-emerald-500" />
                        ) : (
                          <Edit2 size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 cursor-pointer" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right Column: Chart + Metrics */}
            <div className="col-span-8">
              <Card className="p-6 bg-white border border-slate-200 h-full">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Projected Value Realization</h2>
                    <p className="text-sm text-slate-500">3-Year ROI Analysis based on {selectedEfficiency} efficiency gain.</p>
                  </div>
                </div>

                {/* Simple Bar Chart */}
                <div className="h-64 flex items-end justify-center gap-8 mb-6 px-8">
                  {chartData.map((value, index) => (
                    <div key={index} className="flex flex-col items-center gap-2">
                      <span className="text-sm font-medium text-slate-600">${value}M</span>
                      <div
                        className="w-16 bg-primary rounded-t-md transition-all duration-500"
                        style={{ height: `${(value / 3) * 100}%` }}
                      />
                      <span className="text-sm text-slate-500">Y{index + 1}</span>
                    </div>
                  ))}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-100">
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total ROI</div>
                    <div className="text-xl font-bold text-slate-900">${totalROI}M</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Payback</div>
                    <div className="text-xl font-bold text-slate-900">7.2 Mo</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">NPV</div>
                    <div className="text-xl font-bold text-slate-900">$4.1M</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CaseWorkspace;
