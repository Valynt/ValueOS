import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bot, 
  Send, 
  Sparkles, 
  TrendingUp, 
  DollarSign, 
  Target,
  FileText,
  Lightbulb,
  Loader2
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import Streamdown from "streamdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AgenticTutorProps {
  context?: {
    pillarNumber?: number;
    role?: string;
    maturityLevel?: number;
  };
}

export default function AgenticTutor({ context }: AgenticTutorProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hello! I'm your VOS AI Tutor. I can help you with:

**🎯 KPI Hypothesis Generation** - Identify and quantify value metrics
**💰 ROI Narrative Composition** - Build compelling business cases
**📊 Value Case Library** - Create reusable value models
**💡 Insight Framing** - Transform data into strategic insights

What would you like to work on today?`
    }
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeMode, setActiveMode] = useState<"chat" | "kpi" | "roi" | "valuecase">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (response) => {
      const content = typeof response.content === 'string' 
        ? response.content 
        : 'I received a response in an unexpected format.';
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content
      }]);
      setIsStreaming(false);
    },
    onError: (error) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `I apologize, but I encountered an error: ${error.message}. Please try again.`
      }]);
      setIsStreaming(false);
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      role: "user",
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    // Build context-aware system prompt
    const systemPrompt = buildSystemPrompt(activeMode, context);

    chatMutation.mutate({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(1), // Exclude initial greeting
        userMessage
      ]
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
  };

  return (
    <Card className="h-[700px] flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                VOS AI Tutor
                <Sparkles className="h-4 w-4 text-primary" />
              </CardTitle>
              <CardDescription>
                Your agentic learning companion
              </CardDescription>
            </div>
          </div>
          {context && (
            <div className="flex gap-2">
              {context.role && (
                <Badge variant="secondary">{context.role}</Badge>
              )}
              {context.maturityLevel !== undefined && (
                <Badge variant="outline">L{context.maturityLevel}</Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      {/* Mode Selector */}
      <div className="px-6 pt-4">
        <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as typeof activeMode)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="kpi" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              KPI
            </TabsTrigger>
            <TabsTrigger value="roi" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              ROI
            </TabsTrigger>
            <TabsTrigger value="valuecase" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Value Case
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Messages Area */}
      <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {message.role === "assistant" ? (
                <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: Streamdown(message.content) }} />
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      {/* Quick Actions */}
      {activeMode !== "chat" && (
        <div className="px-6 pb-2">
          <div className="flex flex-wrap gap-2">
            {getQuickActions(activeMode).map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action)}
                className="text-xs"
              >
                <Lightbulb className="h-3 w-3 mr-1" />
                {action}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={getPlaceholder(activeMode)}
            className="min-h-[60px] resize-none"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            {isStreaming ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function buildSystemPrompt(
  mode: "chat" | "kpi" | "roi" | "valuecase",
  context?: { pillarNumber?: number; role?: string; maturityLevel?: number }
): string {
  const basePrompt = `You are an expert VOS (Value Operating System) AI Tutor. You help professionals master value-based selling, customer success, and strategic enablement.`;

  const contextInfo = context
    ? `\n\nContext: The learner is in the ${context.role || "unknown"} role at maturity level L${context.maturityLevel || 0}.`
    : "";

  const modePrompts = {
    chat: `${basePrompt}${contextInfo}\n\nProvide helpful, actionable guidance on VOS concepts, methodologies, and best practices. Use markdown formatting for clarity.`,
    kpi: `${basePrompt}${contextInfo}\n\nYou are in KPI Hypothesis Generation mode. Help the learner:
- Identify relevant value metrics for their customer
- Quantify potential impact
- Create measurable success criteria
- Frame metrics in business terms

Provide specific, actionable KPI hypotheses with quantification frameworks.`,
    roi: `${basePrompt}${contextInfo}\n\nYou are in ROI Narrative Composition mode. Help the learner:
- Structure compelling business cases
- Calculate ROI with clear assumptions
- Build value stories that resonate with executives
- Address risk and implementation considerations

Provide structured ROI narratives with specific calculations and storytelling elements.`,
    valuecase: `${basePrompt}${contextInfo}\n\nYou are in Value Case Library mode. Help the learner:
- Create reusable value models
- Document successful value delivery patterns
- Build industry-specific value frameworks
- Capture lessons learned and best practices

Provide structured value case templates with clear components and examples.`
  };

  return modePrompts[mode];
}

function getPlaceholder(mode: "chat" | "kpi" | "roi" | "valuecase"): string {
  const placeholders = {
    chat: "Ask me anything about VOS...",
    kpi: "Describe your customer's business challenge...",
    roi: "Tell me about the value opportunity...",
    valuecase: "Describe the value scenario you want to document..."
  };
  return placeholders[mode];
}

function getQuickActions(mode: "chat" | "kpi" | "roi" | "valuecase"): string[] {
  const actions = {
    chat: [],
    kpi: [
      "Help me identify KPIs for cost reduction",
      "What metrics matter for revenue growth?",
      "How do I quantify time savings?"
    ],
    roi: [
      "Build a 3-year ROI model",
      "Calculate payback period",
      "Create an executive summary"
    ],
    valuecase: [
      "Create a SaaS value case template",
      "Document a successful implementation",
      "Build an industry benchmark"
    ]
  };
  return actions[mode];
}
